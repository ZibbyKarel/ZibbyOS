import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ActivityRefs, CreateGoalInput, ScheduledTask } from "@zibby/contracts";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityEventsService } from "../activity/activity-events.service";
import { BudgetLedgerStore } from "../budget/ledger.store";
import { fakeSystemConfigStore } from "../system/system-config.fixture";
import { GoalActionExecutor } from "./goal-action-executor";
import { GoalEngineService } from "./goal-engine.service";
import { GoalFactsService, TaskFactsSource } from "./goal-facts";
import type { GoalPlanner, GoalPlannerContext } from "./goal-planner";
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

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "goal-engine-"));
    goals = new GoalsStorageService(dir);
    store = new GoalStateStore(dir);
    tasks = new Map();
    projectList = [];
    planner = { plan: vi.fn(async () => ({ plan: "", actions: [] })) };
    activity = { record: vi.fn(async () => undefined) };
    systemConfig = fakeSystemConfigStore();
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
      new GoalActionExecutor(),
      new BudgetLedgerStore(path.join(dir, "ledger")),
      activity as never,
      new ActivityEventsService(),
      { settled: () => new Subject() } as never,
      systemConfig,
      { register: vi.fn() } as never,
      fakeLogger as never,
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
    await engine.tick(later(1));
    expect((await state()).instances._?.status).toBe("acting");
    tasks.set("t1", {
      id: "t1",
      status: "dispatched",
      outcome: { status: "error", summary: "boom", finishedAt: later(2).toISOString() },
    });
    await engine.tick(later(3));
    const s = await state();
    expect(s.instances._?.status).toBe("parked");
    expect(s.instances._?.parkedReason).toBe("budget");
    const ctx = planner.plan.mock.calls[2]?.[0] as GoalPlannerContext;
    expect(ctx.remainingBudget).toEqual({ runs: 0 });
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
      actions: [
        { type: "start-task", text: "fix it" },
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
      actions: [{ type: "start-task", text: "fix it" }],
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
      return { plan: "", actions: [{ type: "done", summary: "ok" }] };
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
});
