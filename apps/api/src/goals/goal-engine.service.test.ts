import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  type ActivityRefs,
  type AutomationLevel,
  type AutopilotAutomation,
  type CreateGoalInput,
  NO_AUTOMATION,
  type ScheduledTask,
  emptyGoalState,
  resolveAutopilotLevels,
} from "@zibby/contracts";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityEventsService } from "../activity/activity-events.service";
import { BudgetLedgerStore } from "../budget/ledger.store";
import { fakeSystemConfigStore } from "../system/system-config.fixture";
import { GoalActionExecutor } from "./goal-action-executor";
import { GoalEngineService, PLAN_TIMEOUT_MS } from "./goal-engine.service";
import { GoalFactsService, TaskFactsSource } from "./goal-facts";
import type { GoalPlanner, GoalPlannerContext } from "./goal-planner";
import { GoalWorkHandlers } from "./goal-work-handlers";
import { GoalStateStore } from "./goal-state.store";
import { GoalsStorageService } from "./goals.storage.service";

const primary = vi.hoisted(() => ({ value: true }));
vi.mock("../shared/instance-role", () => ({ isPrimaryInstance: () => primary.value }));

const fakeLogger = {
  child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
};

const NOW = new Date("2026-11-26T10:00:00.000Z");
const later = (min: number) => new Date(NOW.getTime() + min * 60_000);

describe("GoalEngineService", () => {
  let dir: string;
  let goals: GoalsStorageService;
  let store: GoalStateStore;
  let tasks: Map<string, Partial<ScheduledTask>>;
  let planner: GoalPlanner & { plan: ReturnType<typeof vi.fn> };
  let activity: { record: ReturnType<typeof vi.fn> };
  let engine: GoalEngineService;
  let projectList: { id: string; companyId?: string }[];
  let systemConfig: ReturnType<typeof fakeSystemConfigStore>;
  let executor: GoalActionExecutor;
  let paused: boolean;
  /** The effective `autoDecideGoals` per instance key (what `goalStartLevel` resolves). */
  let startLevel: (key: string) => Promise<AutomationLevel>;

  beforeEach(async () => {
    paused = false;
    startLevel = async () => "auto";
    const autopilot = { isPaused: () => paused };
    const messages = {
      goalStartLevel: (key: string) => startLevel(key),
      communicationLevel: async () => "manual",
      rejectStale: async () => undefined,
    };
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "goal-engine-"));
    goals = new GoalsStorageService(dir);
    store = new GoalStateStore(dir);
    tasks = new Map();
    projectList = [];
    planner = { plan: vi.fn(async () => ({ plan: "", feasibility: "ok", actions: [] })) };
    activity = { record: vi.fn(async () => undefined) };
    systemConfig = fakeSystemConfigStore();
    executor = new GoalActionExecutor(autopilot as never);
    const taskStore = {
      get: async (id: string) => {
        const t = tasks.get(id);
        if (!t) throw new Error("not found");
        return t;
      },
    };
    engine = new GoalEngineService(
      goals,
      store,
      { list: async () => projectList } as never,
      new GoalFactsService([new TaskFactsSource(taskStore as never)]),
      planner,
      executor,
      new BudgetLedgerStore(path.join(dir, "ledger")),
      activity as never,
      new ActivityEventsService(),
      { settled: () => new Subject() } as never,
      systemConfig,
      { register: vi.fn() } as never,
      fakeLogger as never,
      messages as never,
      undefined,
      autopilot as never,
    );
  });
  afterEach(async () => {
    engine.onModuleDestroy();
    primary.value = true;
    vi.useRealTimers();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const create = (over: Partial<CreateGoalInput> = {}) =>
    goals.create({
      id: "g",
      name: "Goal",
      outcome: "It is done.",
      scope: { kind: "none" },
      enabled: true,
      ...over,
    });
  const state = () => store.read("g", NOW.toISOString());
  const setInstance = async (patch: Record<string, unknown>) =>
    store.update("g", NOW.toISOString(), (s) => {
      const inst = s.instances._;
      if (inst) Object.assign(inst, patch);
    });
  const recorded = (kind: string) =>
    activity.record.mock.calls
      .map(([e]) => e as { kind: string; summary: string; refs: ActivityRefs })
      .filter((e) => e.kind === kind);

  it("creates the instance, plans once, then costs no planner call while facts are unchanged", async () => {
    await create();
    await engine.tick(NOW);
    expect(planner.plan).toHaveBeenCalledTimes(1);
    expect((await state()).instances._?.fingerprint).toBeDefined();
    expect(recorded("goal-started")).toHaveLength(1);
    const changes = vi.fn();
    store.onChange(changes);
    await engine.tick(later(1));
    await engine.tick(later(2));
    expect(planner.plan).toHaveBeenCalledTimes(1);
    // An idle tick writes nothing, so no `goals` SSE event either.
    expect(changes).not.toHaveBeenCalled();
  });

  it("skips a disabled goal entirely", async () => {
    await create({ enabled: false });
    await engine.tick(NOW);
    expect(planner.plan).not.toHaveBeenCalled();
    expect((await state()).instances).toEqual({});
  });

  it("calls the planner again after a task outcome changes", async () => {
    await create();
    await engine.tick(NOW);
    tasks.set("t1", { id: "t1", status: "dispatched" });
    await setInstance({ taskIds: ["t1"] });
    await engine.tick(later(1)); // taskIds changed → new facts
    expect(planner.plan).toHaveBeenCalledTimes(2);
    expect((await state()).instances._?.status).toBe("acting");
    await engine.tick(later(2));
    expect(planner.plan).toHaveBeenCalledTimes(2);
    tasks.set("t1", {
      id: "t1",
      status: "dispatched",
      outcome: { status: "done", summary: "ok", finishedAt: later(3).toISOString() },
    });
    await engine.tick(later(4));
    expect(planner.plan).toHaveBeenCalledTimes(3);
    const ctx = planner.plan.mock.calls[2]?.[0] as GoalPlannerContext;
    expect(ctx.facts.tasks).toEqual({
      tasks: [{ id: "t1", status: "dispatched", outcome: "done" }],
      wakeAt: null,
    });
  });

  it("a dirty ref of the instance forces a plan; an unrelated one does not", async () => {
    await create();
    await engine.tick(NOW);
    await setInstance({ taskIds: ["t1"] });
    await engine.tick(later(1));
    expect(planner.plan).toHaveBeenCalledTimes(2);
    engine.markDirty("someone-else");
    await engine.tick(later(2));
    expect(planner.plan).toHaveBeenCalledTimes(2);
    engine.markDirty("t1");
    await engine.tick(later(3));
    expect(planner.plan).toHaveBeenCalledTimes(3);
  });

  it("wake (cleared fingerprint) and a passed wakeAt re-plan; a consumed wakeAt does not re-fire", async () => {
    await create();
    planner.plan.mockResolvedValueOnce({
      plan: "",
      feasibility: "ok",
      actions: [{ type: "wait", wakeAt: later(30).toISOString() }],
    });
    await engine.tick(NOW);
    expect((await state()).instances._?.status).toBe("waiting");
    await engine.tick(later(10));
    expect(planner.plan).toHaveBeenCalledTimes(1);
    await engine.tick(later(31));
    expect(planner.plan).toHaveBeenCalledTimes(2);
    expect((await state()).instances._?.wakeAt).toBeUndefined();
    await engine.tick(later(32));
    expect(planner.plan).toHaveBeenCalledTimes(2);
    await store.wake("g", NOW.toISOString());
    await engine.tick(later(33));
    expect(planner.plan).toHaveBeenCalledTimes(3);
  });

  it("parks at the deadline and notifies; a parked instance is never re-planned", async () => {
    await create({ deadline: later(60).toISOString() });
    await engine.tick(NOW);
    await engine.tick(later(61));
    const s = await state();
    expect(s.instances._?.status).toBe("parked");
    expect(s.instances._?.parkedReason).toBe("deadline");
    expect(recorded("goal-parked")[0]?.refs).toMatchObject({ goalId: "g", status: "deadline" });
    await store.wake("g", NOW.toISOString());
    await engine.tick(later(62));
    expect(planner.plan).toHaveBeenCalledTimes(1);
    expect(recorded("goal-parked")).toHaveLength(1);
  });

  it("parks on the runs budget once its tasks have finished", async () => {
    await create({ budget: { maxRunsPerCycle: 1 } });
    await engine.tick(NOW);
    tasks.set("t1", { id: "t1", status: "dispatched" });
    await setInstance({ taskIds: ["t1"] });
    // Budget used up with t1 in flight: no paid re-plan, the instance just waits.
    await engine.tick(later(1));
    expect(planner.plan).toHaveBeenCalledTimes(1);
    tasks.set("t1", {
      id: "t1",
      status: "dispatched",
      outcome: { status: "error", summary: "boom", finishedAt: later(2).toISOString() },
    });
    await engine.tick(later(3));
    const s = await state();
    expect(s.instances._?.status).toBe("parked");
    expect(s.instances._?.parkedReason).toBe("budget");
    // Spec step 2: the budget park comes before planning.
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });

  it("never plans again while the budget is used up and a task is still running", async () => {
    executor.register("start-task", async (a, ctx) => {
      await ctx.recordTask(a.text);
    });
    await create({ budget: { maxRunsPerCycle: 2 } });
    planner.plan.mockImplementationOnce(async (ctx: GoalPlannerContext) => {
      await ctx.recordRun("goal-planner_1");
      return {
        plan: "",
        feasibility: "ok",
        actions: [{ type: "start-task", actionId: "a1", text: "t1" }],
      };
    });
    tasks.set("t1", { id: "t1", status: "dispatched" });
    await engine.tick(NOW);
    expect((await state()).instances._?.taskIds).toEqual(["goal-planner_1", "t1"]);
    tasks.set("t1", { id: "t1", status: "awaiting-output" });
    await engine.tick(later(1));
    await engine.tick(later(2));
    expect(planner.plan).toHaveBeenCalledTimes(1);
    expect((await state()).instances._?.status).toBe("acting");
  });

  it("refuses a spending action centrally once the budget is used up", async () => {
    const handler = vi.fn();
    executor.register("start-task", handler);
    await create({ budget: { maxRunsPerCycle: 2 } });
    await engine.tick(NOW);
    tasks.set("t1", { id: "t1", status: "dispatched" });
    await setInstance({ taskIds: ["t1"] });
    // One run left before this plan; the planner's own run takes it.
    planner.plan.mockImplementationOnce(async (ctx: GoalPlannerContext) => {
      await ctx.recordRun("goal-planner_1");
      return {
        plan: "",
        feasibility: "ok",
        actions: [{ type: "start-task", actionId: "a1", text: "one more" }],
      };
    });
    await engine.tick(later(1));
    expect(handler).not.toHaveBeenCalled();
    expect(recorded("goal-acted").map((e) => e.summary)).toEqual([
      expect.stringContaining("Not done: start-task — the cycle's budget is used up."),
    ]);
  });

  it("raises a past wakeAt to the 5 min floor, so the planner is not called every tick", async () => {
    await create();
    planner.plan.mockImplementation(async () => ({
      plan: "",
      feasibility: "ok",
      actions: [{ type: "wait", wakeAt: new Date(0).toISOString() }],
    }));
    for (let m = 0; m < 30; m++) await engine.tick(later(m));
    // Woken at 0, 5, 10, 15, 20, 25 — never once per tick.
    expect(planner.plan).toHaveBeenCalledTimes(6);
    expect((await state()).instances._?.wakeAt).toBe(later(30).toISOString());
  });

  it("a hung planner times out and counts as a failure", async () => {
    await create();
    planner.plan.mockImplementation(() => new Promise(() => undefined));
    // Only the timeout is faked; file I/O needs the real event loop (setImmediate).
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let settled = false;
    const tick = engine.tick(NOW).then(() => (settled = true));
    while (!settled) {
      await new Promise((r) => setImmediate(r));
      vi.advanceTimersByTime(PLAN_TIMEOUT_MS);
    }
    await tick;
    const s = await state();
    expect(s.instances._?.planFailures).toBe(1);
    expect(s.instances._?.status).toBe("planning");
    // The timeout aborts the planner's signal, so the model run is stopped, not abandoned.
    expect((planner.plan.mock.calls[0]?.[0] as GoalPlannerContext).signal.aborted).toBe(true);
  });

  it("requires feasibility on the first plan of a cycle and records it (and the risk) once", async () => {
    await create();
    planner.plan.mockResolvedValueOnce({ plan: "p", actions: [] });
    await engine.tick(NOW);
    expect((await state()).instances._?.planFailures).toBe(1);

    planner.plan.mockResolvedValueOnce({
      plan: "p",
      feasibility: "Do termínu to nestihnu.",
      atRisk: true,
      actions: [],
    });
    await engine.tick(later(1));
    let s = await state();
    expect(s.instances._?.feasibility).toBe("Do termínu to nestihnu.");
    expect(s.instances._?.planFailures).toBeUndefined();
    expect(s.instances._?.planNoteId).toBe("goal-g-_-plan");
    expect((planner.plan.mock.calls[1]?.[0] as GoalPlannerContext).firstPlan).toBe(true);

    planner.plan.mockResolvedValueOnce({
      plan: "p2",
      feasibility: "Jiná věta.",
      atRisk: true,
      actions: [],
    });
    await setInstance({ fingerprint: "stale" });
    await engine.tick(later(2));
    s = await state();
    expect((planner.plan.mock.calls[2]?.[0] as GoalPlannerContext).firstPlan).toBe(false);
    expect(s.instances._?.feasibility).toBe("Do termínu to nestihnu.");
    const timeline = await store.timeline("g");
    expect(timeline.filter((e) => e.kind === "feasibility").map((e) => e.text)).toEqual([
      "Do termínu to nestihnu.",
    ]);
    const reports = recorded("goal-acted");
    expect(reports).toHaveLength(1);
    expect(reports[0]?.summary).toContain("Cíl je ohrožený: Do termínu to nestihnu.");
  });

  it("a recorded planner run is not work in flight: the instance stays planning", async () => {
    await create();
    planner.plan.mockImplementationOnce(async (ctx: GoalPlannerContext) => {
      await ctx.recordRun("goal-planner_1");
      return { plan: "", feasibility: "ok", actions: [] };
    });
    await engine.tick(NOW);
    expect((await state()).instances._?.status).toBe("planning");
    await engine.tick(later(1));
    expect((await state()).instances._?.status).toBe("planning");
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });

  it("the planner's own run counts against maxRunsPerCycle", async () => {
    await create({ budget: { maxRunsPerCycle: 1 } });
    planner.plan.mockImplementationOnce(async (ctx: GoalPlannerContext) => {
      await ctx.recordRun("goal-planner_1");
      return {
        plan: "",
        feasibility: "ok",
        actions: [{ type: "start-task", actionId: "a1", text: "x" }],
      };
    });
    await engine.tick(NOW);
    expect((await state()).instances._?.taskIds).toEqual(["goal-planner_1"]);
    expect(recorded("goal-acted").map((e) => e.summary)).toEqual([
      expect.stringContaining("budget is used up"),
    ]);
    // Nothing in flight and no runs left: the next tick parks without planning.
    await engine.tick(later(1));
    expect((await state()).instances._?.parkedReason).toBe("budget");
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });

  it("recordTask persists a started task even when the tick result is dropped", async () => {
    executor.register("start-task", async (_a, ctx) => {
      await ctx.recordTask("t9");
      // A concurrent park lands before the engine applies its result.
      await store.update("g", NOW.toISOString(), (s) => {
        const inst = s.instances._;
        if (inst) inst.status = "parked";
      });
    });
    await create();
    planner.plan.mockResolvedValueOnce({
      plan: "",
      feasibility: "ok",
      actions: [{ type: "start-task", actionId: "a1", text: "x" }],
    });
    await engine.tick(NOW);
    expect((await state()).instances._?.taskIds).toEqual(["t9"]);
    const timeline = await store.timeline("g");
    expect(timeline.map((e) => e.text)).toContain(
      "Tick result dropped: the instance was parked meanwhile.",
    );
  });

  it("resume overrides a deadline park for the rest of the cycle", async () => {
    await create({ deadline: later(60).toISOString() });
    await engine.tick(NOW);
    await engine.tick(later(61));
    expect((await state()).instances._?.status).toBe("parked");
    await store.resume("g", "_", NOW.toISOString());
    await engine.tick(later(62));
    await engine.tick(later(63));
    const s = await state();
    expect(s.instances._?.status).toBe("planning");
    expect(s.instances._?.resumedCycle).toBe(0);
    expect(recorded("goal-parked")).toHaveLength(1);
  });

  it("resume resets planFailures, so a resumed failed instance gets 3 fresh tries", async () => {
    await create();
    planner.plan.mockRejectedValue(new Error("boom"));
    for (let m = 0; m < 3; m++) await engine.tick(later(m));
    expect((await state()).instances._?.parkedReason).toBe("failed");
    await store.resume("g", "_", NOW.toISOString());
    expect((await state()).instances._?.planFailures).toBeUndefined();
    await engine.tick(later(10));
    expect((await state()).instances._?.status).toBe("planning");
  });

  it("resume over budget buys exactly one more plan, then the budget parks again", async () => {
    let run = 0;
    planner.plan.mockImplementation(async (ctx: GoalPlannerContext) => {
      await ctx.recordRun(`goal-planner_${++run}`);
      return { plan: "", feasibility: "ok", actions: [] };
    });
    await create({ budget: { maxRunsPerCycle: 1 } });
    await engine.tick(NOW);
    await engine.tick(later(1));
    expect((await state()).instances._?.parkedReason).toBe("budget");
    await store.resume("g", "_", NOW.toISOString());
    expect((await state()).instances._?.resumedRuns).toBe(1);
    await engine.tick(later(2));
    expect(planner.plan).toHaveBeenCalledTimes(2);
    // Every later wake would pay for another planner run: the budget parks it instead.
    await store.wake("g", NOW.toISOString());
    await engine.tick(later(10));
    await store.wake("g", NOW.toISOString());
    await engine.tick(later(20));
    expect(planner.plan).toHaveBeenCalledTimes(2);
    const s = await state();
    expect(s.instances._?.status).toBe("parked");
    expect(s.instances._?.parkedReason).toBe("budget");
    expect(recorded("goal-parked")).toHaveLength(2);
  });

  it("while Autopilot is paused nothing plans, parks or counts a failure; resume continues", async () => {
    await create({ deadline: later(60).toISOString() });
    await engine.tick(NOW);
    expect(planner.plan).toHaveBeenCalledTimes(1);
    paused = true;
    planner.plan.mockRejectedValue(new Error("boom"));
    await store.wake("g", NOW.toISOString());
    engine.markDirty("t-during-pause");
    for (let m = 1; m <= 4; m++) await engine.tick(later(m * 30)); // past the deadline too
    expect(planner.plan).toHaveBeenCalledTimes(1);
    let s = await state();
    expect(s.instances._?.status).not.toBe("parked");
    expect(s.instances._?.planFailures).toBeUndefined();
    expect(recorded("goal-parked")).toHaveLength(0);
    // After the resume the goal continues where it was (here: its deadline has passed).
    paused = false;
    await engine.tick(later(130));
    s = await state();
    expect(s.instances._?.parkedReason).toBe("deadline");
  });

  it("resumed Autopilot: a waiting instance plans again on the next tick", async () => {
    await create();
    await engine.tick(NOW);
    paused = true;
    await store.wake("g", NOW.toISOString());
    await engine.tick(later(1));
    expect(planner.plan).toHaveBeenCalledTimes(1);
    paused = false;
    await engine.tick(later(2));
    expect(planner.plan).toHaveBeenCalledTimes(2);
  });

  it("a plan finishing after Autopilot was paused starts no spending action", async () => {
    const handler = vi.fn();
    executor.register("start-task", handler);
    await create();
    planner.plan.mockImplementationOnce(async () => {
      paused = true;
      return {
        plan: "",
        feasibility: "ok",
        actions: [{ type: "start-task", actionId: "a1", text: "x" }],
      };
    });
    await engine.tick(NOW);
    expect(handler).not.toHaveBeenCalled();
    expect(recorded("goal-acted").map((e) => e.summary)).toEqual([
      expect.stringContaining("Not done: start-task — Autopilot is paused."),
    ]);
  });

  describe("autonomy: starting and deciding goals (autoDecideGoals)", () => {
    const timeline = async () => (await store.timeline("g")).map((e) => `${e.kind}: ${e.text}`);
    const startTaskPlan = () =>
      planner.plan.mockResolvedValue({
        plan: "",
        feasibility: "ok",
        actions: [{ type: "start-task", actionId: "a1", text: "Fix the build", title: "Fix" }],
      });

    it("manual: holds the instance quietly — no plan, no task, no park, one timeline event", async () => {
      startLevel = async () => "manual";
      const handler = vi.fn();
      executor.register("start-task", handler);
      startTaskPlan();
      await create({ deadline: later(60).toISOString() });
      for (let m = 0; m <= 4; m++) await engine.tick(later(m * 30)); // past the deadline too
      expect(planner.plan).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      const s = await state();
      expect(s.instances._?.held).toBe("autonomy-manual");
      expect(s.instances._?.status).toBe("planning");
      expect(s.instances._?.planFailures).toBeUndefined();
      expect(s.instances._?.taskIds).toEqual([]);
      expect(recorded("goal-parked")).toHaveLength(0);
      expect(recorded("goal-acted")).toHaveLength(0);
      expect(recorded("goal-started")).toHaveLength(0);
      expect((await timeline()).filter((l) => /started/i.test(l))).toEqual([]);
      expect((await timeline()).filter((l) => l.startsWith("held:"))).toEqual([
        "held: Held: Starting and deciding goals is Manual here, so ZIBBY starts nothing for this goal on its own. Raise the level or wake the goal for one pass that waits for your approval.",
      ]);
    });

    it("manual: a new cycle writes no started activity or timeline line", async () => {
      startLevel = async () => "manual";
      await create({ cadence: { every: "day", hour: 9 } });
      await store.write({
        ...emptyGoalState("g", "2026-11-26T07:00:00.000Z"),
        instances: { _: { status: "planning", taskIds: [], held: "autonomy-manual" } },
      });
      await engine.tick(new Date("2026-11-26T08:05:00.000Z"));
      expect((await state()).cycle.index).toBe(1);
      expect(recorded("goal-started")).toHaveLength(0);
      expect((await timeline()).filter((l) => /started/i.test(l))).toEqual([]);
    });

    it("manual: an idle held tick writes nothing", async () => {
      startLevel = async () => "manual";
      await create();
      await engine.tick(NOW);
      const changes = vi.fn();
      store.onChange(changes);
      await engine.tick(later(1));
      await engine.tick(later(2));
      expect(changes).not.toHaveBeenCalled();
    });

    it("raising the level releases the hold: held clears and the instance plans", async () => {
      startLevel = async () => "manual";
      await create();
      await engine.tick(NOW);
      startLevel = async () => "auto";
      await engine.tick(later(1));
      expect(planner.plan).toHaveBeenCalledTimes(1);
      expect((await state()).instances._?.held).toBeUndefined();
    });

    it("an unresolvable level fails closed (manual)", async () => {
      startLevel = async () => {
        throw new Error("project unreadable");
      };
      await create();
      await engine.tick(NOW);
      expect(planner.plan).not.toHaveBeenCalled();
      expect((await state()).instances._?.held).toBe("autonomy-manual");
    });

    it("semi: plans and reports, but start-task / run-loop / pr-action / merge never execute", async () => {
      startLevel = async () => "semi";
      const handlers = {
        "start-task": vi.fn(),
        "run-loop": vi.fn(),
        "pr-action": vi.fn(),
        merge: vi.fn(),
      };
      for (const [type, h] of Object.entries(handlers)) executor.register(type as "merge", h);
      planner.plan.mockResolvedValue({
        plan: "",
        feasibility: "ok",
        actions: [
          { type: "start-task", actionId: "a1", text: "Fix the build", title: "Fix" },
          { type: "run-loop", actionId: "a2", text: "Run it" },
          {
            type: "pr-action",
            actionId: "a3",
            op: "review",
            projectId: "p",
            repo: "o/r",
            number: 1,
          },
          {
            type: "merge",
            actionId: "a4",
            projectId: "p",
            repo: "o/r",
            number: 1,
            approvedSha: "a".repeat(40),
          },
        ],
      });
      await create({ ceiling: "tier3" });
      await engine.tick(NOW);
      expect(planner.plan).toHaveBeenCalledTimes(1);
      expect((planner.plan.mock.calls[0]?.[0] as GoalPlannerContext).autonomy).toBe("semi");
      for (const h of Object.values(handlers)) expect(h).not.toHaveBeenCalled();
      const acted = recorded("goal-acted").map((e) => e.summary);
      expect(acted).toHaveLength(4);
      expect(acted[0]).toContain(
        "Not started (Semi-auto): start-task (Fix) — start it yourself or raise Starting and deciding goals to Auto.",
      );
      const s = await state();
      expect(s.instances._?.held).toBeUndefined();
      expect(s.instances._?.appliedActionIds).toBeUndefined();
    });

    it("auto: start-task executes", async () => {
      const handler = vi.fn();
      executor.register("start-task", handler);
      startTaskPlan();
      await create();
      await engine.tick(NOW);
      expect(handler).toHaveBeenCalledTimes(1);
      expect((planner.plan.mock.calls[0]?.[0] as GoalPlannerContext).autonomy).toBe("auto");
    });

    it("lowered to manual while the planner ran: the pass starts nothing, the next tick holds", async () => {
      const levels: AutomationLevel[] = ["auto", "manual"];
      startLevel = async () => levels.shift() ?? "manual";
      const handler = vi.fn();
      executor.register("start-task", handler);
      startTaskPlan();
      await create();
      await engine.tick(NOW);
      expect(planner.plan).toHaveBeenCalledTimes(1);
      expect(handler).not.toHaveBeenCalled();
      expect(recorded("goal-acted")[0]?.summary).toContain("Not started (Semi-auto): start-task");
      expect((await state()).instances._?.appliedActionIds).toBeUndefined();
      await engine.tick(later(1));
      expect((await state()).instances._?.held).toBe("autonomy-manual");
    });

    it("lowered to semi while the planner ran: start-task becomes a report", async () => {
      const levels: AutomationLevel[] = ["auto", "semi"];
      startLevel = async () => levels.shift() ?? "semi";
      const handler = vi.fn();
      executor.register("start-task", handler);
      startTaskPlan();
      await create();
      await engine.tick(NOW);
      expect(handler).not.toHaveBeenCalled();
      expect(recorded("goal-acted")[0]?.summary).toContain("Not started (Semi-auto): start-task");
    });

    it("resume clears a stale operatorWake, so it buys no extra semi pass", async () => {
      await create();
      await engine.tick(NOW);
      await store.update("g", NOW.toISOString(), (s) => {
        const i = s.instances._;
        if (i) Object.assign(i, { status: "parked", parkedReason: "failed", operatorWake: true });
      });
      const resumed = await store.resume("g", "_", NOW.toISOString());
      expect(resumed.instances._?.operatorWake).toBeUndefined();
    });

    it("wake on a manual-held instance runs exactly one pass as semi, then it is held again", async () => {
      startLevel = async () => "manual";
      const handler = vi.fn();
      executor.register("start-task", handler);
      startTaskPlan();
      await create();
      await engine.tick(NOW);
      expect(planner.plan).not.toHaveBeenCalled();
      expect((await store.wake("g", NOW.toISOString())).instances._?.operatorWake).toBe(true);
      await engine.tick(later(1));
      expect(planner.plan).toHaveBeenCalledTimes(1);
      expect((planner.plan.mock.calls[0]?.[0] as GoalPlannerContext).autonomy).toBe("semi");
      expect(handler).not.toHaveBeenCalled();
      expect(recorded("goal-acted")[0]?.summary).toContain("Not started (Semi-auto): start-task");
      let s = await state();
      expect(s.instances._?.operatorWake).toBeUndefined();
      expect(s.instances._?.held).toBe("autonomy-manual");
      await engine.tick(later(2));
      await engine.tick(later(3));
      expect(planner.plan).toHaveBeenCalledTimes(1);
      s = await state();
      expect(s.instances._?.held).toBe("autonomy-manual");
      // Still one held event: the wake pass did not release the hold.
      expect((await timeline()).filter((l) => l.startsWith("held:"))).toHaveLength(1);
    });

    it("wake marks only held instances; it grants nothing to a running one", async () => {
      await create();
      await engine.tick(NOW);
      expect((await store.wake("g", NOW.toISOString())).instances._?.operatorWake).toBeUndefined();
    });

    it("resume of a parked instance does not bypass the hold", async () => {
      await create({ deadline: later(60).toISOString() });
      await engine.tick(NOW);
      await engine.tick(later(61));
      expect((await state()).instances._?.status).toBe("parked");
      startLevel = async () => "manual";
      await store.resume("g", "_", NOW.toISOString());
      await engine.tick(later(62));
      expect(planner.plan).toHaveBeenCalledTimes(1);
      expect((await state()).instances._?.held).toBe("autonomy-manual");
    });

    it("pause wins over the level: nothing is held, planned or written", async () => {
      startLevel = async () => "manual";
      paused = true;
      await create();
      await engine.tick(NOW);
      expect((await state()).instances).toEqual({});
    });

    it("global manual (the master switch) holds a goal even where its project cell is auto", async () => {
      const automation: AutopilotAutomation = {
        global: { ...NO_AUTOMATION },
        companies: {},
        teams: {},
        projects: { web: { autoDecideGoals: "auto" } },
      };
      startLevel = async (key) =>
        resolveAutopilotLevels({ automation }, key === "_" ? {} : { projectId: key })
          .autoDecideGoals;
      projectList = [{ id: "web" }];
      await create({ scope: { kind: "projects", projectIds: ["web"] } });
      await engine.tick(NOW);
      expect(planner.plan).not.toHaveBeenCalled();
      expect((await state()).instances.web?.held).toBe("autonomy-manual");
      // Lifting the global row lets the project cell apply.
      automation.global = { ...NO_AUTOMATION, autoReview: "semi" };
      await engine.tick(later(1));
      expect(planner.plan).toHaveBeenCalledTimes(1);
    });
  });

  it("a corrupt state file fails that goal's tick only and is not overwritten", async () => {
    await create();
    await goals.create({
      id: "a",
      name: "A",
      outcome: "x",
      scope: { kind: "none" },
      enabled: true,
    });
    const file = path.join(dir, "state", "a", "state.json");
    await fs.mkdir(path.dirname(file), { recursive: true });
    const corrupt = JSON.stringify({
      goalId: "a",
      instances: { _: { status: "from-the-future" } },
    });
    await fs.writeFile(file, corrupt);
    await expect(engine.tick(NOW)).resolves.toBeUndefined();
    expect(await fs.readFile(file, "utf8")).toBe(corrupt);
    expect(planner.plan).toHaveBeenCalledTimes(1);
    expect((planner.plan.mock.calls[0]?.[0] as GoalPlannerContext).goal.id).toBe("g");
  });

  it("a goal failing every tick does not make another goal re-plan every tick", async () => {
    await create();
    await goals.create({
      id: "a",
      name: "Broken",
      outcome: "x",
      scope: { kind: "projects", projectIds: ["p"] },
      enabled: true,
    });
    await engine.tick(NOW);
    tasks.set("t1", { id: "t1", status: "dispatched" });
    await setInstance({ taskIds: ["t1"] });
    await engine.tick(later(1));
    const calls = planner.plan.mock.calls.filter(
      ([c]) => (c as GoalPlannerContext).goal.id === "g",
    );
    const before = calls.length;
    const update = store.update.bind(store);
    vi.spyOn(store, "update").mockImplementation((id, startedAt, fn) =>
      id === "a" ? Promise.reject(new Error("broken")) : update(id, startedAt, fn),
    );
    engine.markDirty("t1");
    for (let m = 2; m < 8; m++) await engine.tick(later(m));
    const after = planner.plan.mock.calls.filter(
      ([c]) => (c as GoalPlannerContext).goal.id === "g",
    ).length;
    expect(after - before).toBe(1);
  });

  it("one plan cannot overspend: the second start-task sees the run already spent", async () => {
    executor.register("start-task", async (a, ctx) => {
      await ctx.recordTask(`t-${a.text}`);
    });
    await create({ budget: { maxRunsPerCycle: 1 } });
    planner.plan.mockResolvedValueOnce({
      plan: "",
      feasibility: "ok",
      actions: [
        { type: "start-task", actionId: "one", text: "one" },
        { type: "start-task", actionId: "two", text: "two" },
      ],
    });
    await engine.tick(NOW);
    expect((await state()).instances._?.taskIds).toEqual(["t-one"]);
    expect(recorded("goal-acted").map((e) => e.summary)).toEqual([
      expect.stringContaining("Not done: start-task — the cycle's budget is used up."),
    ]);
  });

  it("puts a failed instance's dirty refs back for the next tick", async () => {
    await create();
    await engine.tick(NOW);
    tasks.set("t1", { id: "t1", status: "dispatched" });
    await setInstance({ taskIds: ["t1"] });
    await engine.tick(later(1));
    const collect = vi.spyOn(GoalFactsService.prototype, "collect");
    collect.mockRejectedValueOnce(new Error("disk"));
    engine.markDirty("t1");
    await engine.tick(later(2)); // throws inside the instance
    collect.mockRestore();
    await engine.tick(later(3));
    expect(planner.plan).toHaveBeenCalledTimes(3);
  });

  it("a cadence boundary starts a new cycle, resets taskIds and un-parks", async () => {
    // Created before 09:00 CET; the weekday boundary is 08:00Z.
    const created = await create({ cadence: { every: "day", hour: 9 }, cycleHours: 2 });
    const start = new Date("2026-11-26T07:00:00.000Z");
    await store.write({
      goalId: "g",
      cycle: { index: 0, startedAt: start.toISOString() },
      instances: { _: { status: "parked", parkedReason: "budget", taskIds: ["t1"] } },
      decisionsThisMonth: { month: "2026-11", count: 0 },
      nudges: {},
    });
    await engine.tick(new Date("2026-11-26T07:30:00.000Z"));
    expect(planner.plan).not.toHaveBeenCalled();
    await engine.tick(new Date("2026-11-26T08:05:00.000Z"));
    const s = await state();
    expect(s.cycle).toEqual({
      index: 1,
      startedAt: "2026-11-26T08:00:00.000Z",
      deadlineAt: "2026-11-26T10:00:00.000Z",
    });
    expect(s.instances._?.taskIds).toEqual([]);
    expect(s.instances._?.status).toBe("planning");
    expect(planner.plan).toHaveBeenCalledTimes(1);
    expect(created.id).toBe("g");
    // cycleHours: past the cycle's deadline and not done → parked (deadline).
    await engine.tick(new Date("2026-11-26T10:01:00.000Z"));
    expect((await state()).instances._?.parkedReason).toBe("deadline");
  });

  it("ceiling tier1 downgrades a start-task to a report; an unbuilt tier2 action reports too", async () => {
    await create({ ceiling: "tier1" });
    planner.plan.mockResolvedValueOnce({
      plan: "",
      feasibility: "ok",
      actions: [
        { type: "start-task", actionId: "a1", text: "fix it" },
        { type: "note", text: "noted" },
      ],
    });
    await engine.tick(NOW);
    const reports = recorded("goal-acted");
    expect(reports).toHaveLength(1);
    expect(reports[0]?.refs.action).toBe("report");
    expect(reports[0]?.summary).toContain("start-task");
    expect(reports[0]?.summary).toContain("tier1");
    const timeline = await store.timeline("g");
    expect(timeline.map((e) => e.kind)).toEqual(
      expect.arrayContaining(["report", "note", "instance-started"]),
    );

    await goals.update("g", { ceiling: "tier2" });
    await store.wake("g", NOW.toISOString());
    planner.plan.mockResolvedValueOnce({
      plan: "",
      feasibility: "ok",
      actions: [{ type: "start-task", actionId: "a1", text: "fix it" }],
    });
    await engine.tick(later(1));
    expect(recorded("goal-acted")[1]?.summary).toContain("not available yet");
  });

  it("planner errors retry next tick and park (failed) after 3 in a row", async () => {
    await create();
    planner.plan.mockRejectedValue(new Error("model down"));
    await engine.tick(NOW);
    expect((await state()).instances._?.planFailures).toBe(1);
    planner.plan.mockResolvedValueOnce({ nope: true });
    await engine.tick(later(1));
    await engine.tick(later(2));
    const s = await state();
    expect(planner.plan).toHaveBeenCalledTimes(3);
    expect(s.instances._?.status).toBe("parked");
    expect(s.instances._?.parkedReason).toBe("failed");
  });

  it("a throwing instance does not stop the next one", async () => {
    projectList = [{ id: "alpha", companyId: "c" }, { id: "beta", companyId: "c" }, { id: "x" }];
    await create({ scope: { kind: "company", companyId: "c" } });
    planner.plan.mockImplementation(async (ctx: GoalPlannerContext) => {
      if (ctx.instanceKey === "alpha") throw new Error("boom");
      return { plan: "", feasibility: "ok", actions: [{ type: "done", summary: "ok" }] };
    });
    await engine.tick(NOW);
    const s = await state();
    expect(Object.keys(s.instances).sort()).toEqual(["alpha", "beta"]);
    expect(s.instances.beta?.status).toBe("done");
    expect(recorded("goal-done")[0]?.refs).toMatchObject({ goalId: "g", projectId: "beta" });
  });

  it("a project that left the scope is closed as done, not dropped", async () => {
    projectList = [{ id: "alpha" }, { id: "beta" }];
    await create({ scope: { kind: "all" } });
    await engine.tick(NOW);
    projectList = [{ id: "alpha" }];
    await engine.tick(later(1));
    const s = await state();
    expect(s.instances.beta?.status).toBe("done");
    expect(s.instances.beta?.summary).toBe("Left the goal's scope.");
  });

  it("a secondary instance never arms the timer", async () => {
    vi.useFakeTimers();
    const tick = vi.spyOn(engine, "tick").mockResolvedValue();
    systemConfig = fakeSystemConfigStore({ goalEngineTickMs: 1000 });
    Object.assign(engine, { systemConfig });
    primary.value = false;
    engine.onModuleInit();
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).not.toHaveBeenCalled();
    engine.onModuleDestroy();
    primary.value = true;
    engine.onModuleInit();
    await vi.advanceTimersByTimeAsync(1500);
    expect(tick).toHaveBeenCalled();
  });

  describe("work handlers (start-task, run-loop, pr-action)", () => {
    type Prs = {
      projectId: string;
      repo: string;
      number: number;
      bucket: string;
      headSha?: string;
      title: string;
      draft?: boolean;
      unresolvedThreads?: number;
    }[];
    const prRow = (over: Partial<Prs[number]> = {}): Prs[number] => ({
      projectId: "web",
      repo: "o/web",
      number: 7,
      bucket: "to-review",
      headSha: "a".repeat(40),
      title: "T",
      draft: false,
      unresolvedThreads: 0,
      ...over,
    });
    let scheduled: unknown[];
    let createTask: ReturnType<typeof vi.fn>;
    let review: ReturnType<typeof vi.fn>;
    let addressComments: ReturnType<typeof vi.fn>;
    let fixCi: ReturnType<typeof vi.fn>;
    let toggles: Record<string, boolean>;
    let prs: Prs;
    let atSeen: unknown[];

    beforeEach(() => {
      let n = 0;
      createTask = vi.fn(async () => ({
        outcome: "dispatched",
        task: { id: `t-${++n}`, title: "T" },
      }));
      review = vi.fn(async () => ({ taskId: "rev-1" }));
      addressComments = vi.fn(async () => ({ taskId: "ac-1" }));
      fixCi = vi.fn(async () => ({ taskId: "ci-1" }));
      toggles = { autoReview: true, autoAddressComments: false, autoFixCi: false };
      prs = [];
      atSeen = [];
      scheduled = [];
      new GoalWorkHandlers(
        executor,
        { createTask } as never,
        {
          get: async (id: string) =>
            id === "coder" ? { id, name: "Coder" } : Promise.reject(new Error("no")),
        } as never,
        { get: async () => Promise.reject(new Error("no")) } as never,
        { current: async () => prs } as never,
        { start: review } as never,
        { start: addressComments } as never,
        { start: fixCi } as never,
        {
          automationFor: (at: unknown) => {
            atSeen.push(at);
            return toggles;
          },
        } as never,
        { get: async (id: string) => ({ id }) } as never,
        { resolveCompany: async () => ({ id: "acme" }) } as never,
        { list: async () => [] } as never,
        { list: async () => scheduled } as never,
      ).onModuleInit();
    });

    const plan = (...actions: unknown[]) =>
      planner.plan.mockResolvedValue({ plan: "", feasibility: "ok", actions });
    const acted = () => recorded("goal-acted").map((e) => e.summary);

    it("start-task is idempotent across two ticks and stamps source + goalId", async () => {
      await create();
      plan({ type: "start-task", actionId: "fix-1", text: "Fix the build", targetId: "coder" });
      await engine.tick(NOW);
      expect(createTask).toHaveBeenCalledTimes(1);
      expect(createTask.mock.calls[0]?.slice(0, 5)).toEqual([
        { text: "Fix the build", source: "goal", goalId: "g" },
        expect.any(Number),
        null, // a `_` instance's task has explicitly no project (no text match)
        { kind: "agent", id: "coder", name: "Coder" },
        false,
      ]);
      let inst = (await state()).instances._;
      expect(inst?.taskIds).toEqual(["t-1"]);
      expect(inst?.appliedActionIds).toEqual(["fix-1"]);
      // The task ends; the planner re-plans and restates the same work.
      tasks.set("t-1", {
        id: "t-1",
        status: "dispatched",
        outcome: { status: "error", summary: "x", finishedAt: later(1).toISOString() },
      });
      await engine.tick(later(2));
      expect(planner.plan).toHaveBeenCalledTimes(2);
      expect(createTask).toHaveBeenCalledTimes(1);
      inst = (await state()).instances._;
      expect(inst?.taskIds).toEqual(["t-1"]);
      const lines = await store.timeline("g");
      expect(lines.map((l) => l.text)).toContain(
        "Skipped start-task fix-1: already applied this cycle.",
      );
    });

    it("an unknown target is routed by the classifier, the task still starts in the instance's project", async () => {
      await create({ scope: { kind: "projects", projectIds: ["web"] } });
      plan({ type: "start-task", actionId: "a", text: "x", targetId: "nope" });
      await engine.tick(NOW);
      expect(createTask.mock.calls[0]?.[2]).toBe("web");
      expect(createTask.mock.calls[0]?.[3]).toBeUndefined();
    });

    it("run-loop starts the goal's loop; without a loop it is a report", async () => {
      await create({ loop: { loopId: "polish" } });
      plan({ type: "run-loop", actionId: "l1", text: "polish it" });
      await engine.tick(NOW);
      expect(createTask.mock.calls[0]?.[3]).toEqual({ kind: "loop", id: "polish", name: "polish" });
      await goals.update("g", { loop: null });
      await setInstance({ fingerprint: "stale" });
      plan({ type: "run-loop", actionId: "l2", text: "again" });
      await engine.tick(later(1));
      expect(createTask).toHaveBeenCalledTimes(1);
      expect(acted()).toContainEqual(expect.stringContaining("the goal has no loop"));
    });

    it("pr-action calls the right service with auto: true at the PR's place", async () => {
      await create({ scope: { kind: "projects", projectIds: ["web"] } });
      prs = [prRow()];
      plan({
        type: "pr-action",
        actionId: "r7",
        op: "review",
        projectId: "web",
        repo: "o/web",
        number: 7,
      });
      await engine.tick(NOW);
      expect(review).toHaveBeenCalledWith(
        { projectId: "web", repo: "o/web", number: 7, title: "T" },
        {
          auto: true,
          headSha: "a".repeat(40),
          autopilotAt: [{ companyId: "acme", projectId: "web" }],
        },
      );
      expect((await state()).instances.web?.taskIds).toEqual(["rev-1"]);
      expect(addressComments).not.toHaveBeenCalled();
    });

    it("pr-action where Autopilot does not start that op is reported as prepared, never forced", async () => {
      await create({ scope: { kind: "projects", projectIds: ["web"] } });
      prs = [prRow({ bucket: "mine", unresolvedThreads: 2 })];
      plan({
        type: "pr-action",
        actionId: "c7",
        op: "address-comments",
        projectId: "web",
        repo: "o/web",
        number: 7,
      });
      await engine.tick(NOW);
      expect(addressComments).not.toHaveBeenCalled();
      expect(acted()).toContainEqual(expect.stringContaining("připraveno, čeká na tebe"));
      expect((await state()).instances.web?.taskIds).toEqual([]);
    });

    it("pr-action outside the instance's scope is refused (the planner cannot widen it)", async () => {
      await create({ scope: { kind: "projects", projectIds: ["web"] } });
      plan({
        type: "pr-action",
        actionId: "x",
        op: "review",
        projectId: "api",
        repo: "o/api",
        number: 1,
      });
      prs = [prRow({ projectId: "api", repo: "o/api", number: 1 })];
      await engine.tick(NOW);
      // A `_` instance acts only on my own PRs.
      await goals.update("g", { scope: { kind: "none" } });
      prs = [{ projectId: "api", repo: "o/api", number: 2, bucket: "to-review", title: "T" }];
      plan({
        type: "pr-action",
        actionId: "y",
        op: "review",
        projectId: "api",
        repo: "o/api",
        number: 2,
      });
      await engine.tick(later(1));
      expect(review).not.toHaveBeenCalled();
      expect(acted().filter((t) => t.includes("outside the goal's scope"))).toHaveLength(2);
    });

    it("a throwing service becomes a report, not a plan failure", async () => {
      await create({ scope: { kind: "projects", projectIds: ["web"] } });
      prs = [prRow()];
      review.mockRejectedValueOnce(new Error("review of o/web#7 is out of my teams' scope"));
      plan({
        type: "pr-action",
        actionId: "r7",
        op: "review",
        projectId: "web",
        repo: "o/web",
        number: 7,
      });
      await engine.tick(NOW);
      const inst = (await state()).instances.web;
      expect(inst?.planFailures).toBeUndefined();
      expect(inst?.fingerprint).toBeDefined();
      expect(acted()).toContainEqual(
        expect.stringContaining("Not done: pr-action — review of o/web#7"),
      );
    });

    const prAction = (op: string, actionId: string) =>
      plan({ type: "pr-action", actionId, op, projectId: "web", repo: "o/web", number: 7 });

    it("pr-action only on the PRs the toggle covers: no address-comments on a PR I review, none on an unknown PR", async () => {
      await create({ scope: { kind: "projects", projectIds: ["web"] } });
      toggles = { autoReview: true, autoAddressComments: true, autoFixCi: true };
      prs = [prRow({ bucket: "to-review", unresolvedThreads: 3 })];
      const on = (op: string, actionId: string, number = 7) => ({
        type: "pr-action",
        actionId,
        op,
        projectId: "web",
        repo: "o/web",
        number,
      });
      plan(on("address-comments", "c7"), on("fix-ci", "f7"), on("review", "r9", 9));
      await engine.tick(NOW);
      expect(addressComments).not.toHaveBeenCalled();
      expect(review).not.toHaveBeenCalled();
      expect(fixCi).not.toHaveBeenCalled();
      expect(acted()).toContainEqual(expect.stringContaining("not one Autopilot does that for"));
      expect(acted()).toContainEqual(expect.stringContaining("not in the PR inbox"));
      expect(acted()).toContainEqual(expect.stringContaining("operator's own PRs"));
    });

    it("pr-action review of a head that already has a review run is skipped", async () => {
      await create({ scope: { kind: "projects", projectIds: ["web"] } });
      prs = [prRow()];
      scheduled = [
        {
          id: "old",
          status: "dispatched",
          prReview: { repo: "o/web", number: 7, headSha: "a".repeat(40), state: "done" },
        },
      ];
      prAction("review", "r7-again");
      await engine.tick(NOW);
      expect(review).not.toHaveBeenCalled();
      expect(acted()).toContainEqual(expect.stringContaining("already done or running"));
    });

    it("pr-action address-comments and fix-ci on my own PR start with auto: true", async () => {
      await create({ scope: { kind: "projects", projectIds: ["web"] } });
      toggles = { autoReview: false, autoAddressComments: true, autoFixCi: true };
      prs = [prRow({ bucket: "mine", unresolvedThreads: 1 })];
      plan(
        {
          type: "pr-action",
          actionId: "c7",
          op: "address-comments",
          projectId: "web",
          repo: "o/web",
          number: 7,
        },
        {
          type: "pr-action",
          actionId: "f7",
          op: "fix-ci",
          projectId: "web",
          repo: "o/web",
          number: 7,
        },
      );
      await engine.tick(NOW);
      const input = { projectId: "web", repo: "o/web", number: 7, title: "T" };
      expect(addressComments).toHaveBeenCalledWith(input, {
        auto: true,
        autopilotAt: [{ companyId: "acme", projectId: "web" }],
      });
      expect(fixCi).toHaveBeenCalledWith(input, { auto: true });
      expect((await state()).instances.web?.taskIds).toEqual(["ac-1", "ci-1"]);
    });
  });
});
