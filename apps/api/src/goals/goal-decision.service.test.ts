import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Approval, CreateGoalInput, GoalAction } from "@zibby/contracts";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityEventsService } from "../activity/activity-events.service";
import { BudgetLedgerStore } from "../budget/ledger.store";
import { fakeSystemConfigStore } from "../system/system-config.fixture";
import { GoalActionExecutor } from "./goal-action-executor";
import { GoalDecisionService } from "./goal-decision.service";
import { GoalEngineService } from "./goal-engine.service";
import { GoalFactsService, type GoalFactsSource } from "./goal-facts";
import type { GoalPlanner, GoalPlannerContext } from "./goal-planner";
import { GoalStateStore } from "./goal-state.store";
import { GoalsStorageService } from "./goals.storage.service";

vi.mock("../shared/instance-role", () => ({ isPrimaryInstance: () => true }));

const fakeLogger = {
  child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
};
const NOW = new Date("2026-11-26T10:00:00.000Z");

const cand = (id: string, size: "small" | "large" = "small") => ({
  id,
  title: `Feature ${id}`,
  why: "gap",
  size,
  task: `Build feature ${id}`,
});
const propose = (...c: ReturnType<typeof cand>[]): GoalAction => ({
  type: "propose",
  candidates: c,
});

describe("GoalDecisionService (directional goals, autoDecideGoals)", () => {
  let dir: string;
  let goals: GoalsStorageService;
  let store: GoalStateStore;
  let planner: GoalPlanner & { plan: ReturnType<typeof vi.fn> };
  let activity: { record: ReturnType<typeof vi.fn> };
  let approvals: {
    register: ReturnType<typeof vi.fn>;
    requestApproval: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
  };
  let started: { text: string; actionId: string; projectId?: string }[];
  let level: (at: { projectId?: string; companyId?: string }) => string;
  let places: unknown[];
  let paused: boolean;
  let failStart: boolean;
  let replies: unknown;
  let engine: GoalEngineService;
  let decisions: GoalDecisionService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "goal-decision-"));
    goals = new GoalsStorageService(dir);
    store = new GoalStateStore(dir);
    planner = { plan: vi.fn(async () => ({ plan: "", feasibility: "ok", actions: [] })) };
    activity = { record: vi.fn(async () => undefined) };
    let n = 0;
    approvals = {
      register: vi.fn(),
      requestApproval: vi.fn(async (input: Partial<Approval>) => ({
        ...input,
        id: `ap-${++n}`,
        status: "pending",
      })),
      reject: vi.fn(async () => ({})),
    };
    started = [];
    places = [];
    paused = false;
    failStart = false;
    replies = undefined;
    level = () => "semi";
    const executor = new GoalActionExecutor();
    // The real start-task handler goes through the scheduler; here it only records the task.
    executor.register("start-task", async (a, ctx) => {
      if (failStart) throw new Error("host down");
      started.push({ text: a.text, actionId: a.actionId, projectId: ctx.projectId });
      await ctx.recordTask(`task-${started.length}`, a.actionId);
    });
    decisions = new GoalDecisionService(
      executor,
      approvals as never,
      store,
      goals,
      {
        isPaused: () => paused,
        levelsAt: (at: { projectId?: string; companyId?: string }) => {
          places.push(at);
          return { autoDecideGoals: level(at) };
        },
      } as never,
      {
        placeOf: async (k: string) => (k === "_" ? {} : { companyId: "c1", projectId: k }),
      } as never,
      new BudgetLedgerStore(path.join(dir, "ledger")),
      activity as never,
    );
    decisions.onModuleInit();
    const repliesSource: GoalFactsSource = {
      name: "replies",
      collect: async () => replies,
    };
    engine = new GoalEngineService(
      goals,
      store,
      { list: async () => [{ id: "p1", companyId: "c1" }] } as never,
      new GoalFactsService([repliesSource]),
      planner,
      executor,
      new BudgetLedgerStore(path.join(dir, "ledger")),
      activity as never,
      new ActivityEventsService(),
      { settled: () => new Subject() } as never,
      fakeSystemConfigStore(),
      { register: vi.fn() } as never,
      fakeLogger as never,
      undefined,
      decisions,
    );
  });
  afterEach(async () => {
    engine.onModuleDestroy();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const create = (over: Partial<CreateGoalInput> = {}) =>
    goals.create({
      id: "g",
      name: "Keep up",
      outcome: "Match the competitor.",
      scope: { kind: "projects", projectIds: ["p1"] },
      enabled: true,
      directional: {
        maxDecisionsPerMonth: 2,
        checklist: [
          { id: "a", title: "A", done: false },
          { id: "b", title: "B", done: false },
        ],
      },
      ...over,
    });
  const state = () => store.read("g", NOW.toISOString());
  const planOnce = (...actions: GoalAction[]) =>
    planner.plan.mockResolvedValueOnce({ plan: "", feasibility: "ok", actions });
  const timeline = async () => (await store.timeline("g")).map((e) => `${e.kind}: ${e.text}`);
  const pendingApproval = () => approvals.requestApproval.mock.calls[0]?.[0] as Approval;

  it("manual: writes the ranked report, no approval, no task", async () => {
    level = () => "manual";
    await create();
    planOnce(propose(cand("x"), cand("y")));
    await engine.tick(NOW);
    expect(approvals.requestApproval).not.toHaveBeenCalled();
    expect(started).toEqual([]);
    expect((await timeline()).join("\n")).toContain("1. [x] Feature x (small)");
  });

  it("semi: approval lists the candidates; approve starts the top one", async () => {
    await create();
    planOnce(propose(cand("x"), cand("y")));
    await engine.tick(NOW);
    expect(started).toEqual([]);
    const req = pendingApproval();
    expect(req).toMatchObject({ kind: "goal-decision", runId: "g/p1/0/0" });
    expect(req.detail).toContain("[y]");
    expect((await state()).instances.p1?.waitingOn).toEqual([{ kind: "approval", ref: "ap-1" }]);
    await decisions.resume("g/p1/0/0", { id: "ap-1" } as Approval);
    expect(started).toMatchObject([{ text: "Build feature x", projectId: "p1" }]);
    const s = await state();
    expect(s.decisions).toMatchObject([{ status: "started", chosen: "x" }]);
    expect(s.instances.p1?.taskIds).toEqual(["task-1"]);
    // An approved start is the operator's call: it is not counted against the auto cap.
    expect(s.decisionsThisMonth.count).toBe(0);
  });

  it("semi: an answer that is free text, not a candidate id, starts nothing", async () => {
    await create();
    planOnce(propose(cand("x"), cand("y")));
    await engine.tick(NOW);
    await decisions.resume("g/p1/0/0", { id: "ap-1", reason: "just do z please" } as Approval);
    expect(started).toEqual([]);
    expect((await state()).decisions?.[0]?.status).toBe("failed");
  });

  it("semi: answering with a candidate id starts that candidate", async () => {
    await create();
    planOnce(propose(cand("x"), cand("y")));
    await engine.tick(NOW);
    await decisions.resume("g/p1/0/0", { id: "ap-1", reason: "y" } as Approval);
    expect(started).toMatchObject([{ text: "Build feature y" }]);
  });

  it("reject is recorded and starts nothing; a second approve is refused", async () => {
    await create();
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    await decisions.cancel("g/p1/0/0");
    expect((await state()).decisions?.[0]?.status).toBe("rejected");
    await decisions.resume("g/p1/0/0", { id: "ap-1" } as Approval);
    expect(started).toEqual([]);
  });

  it("a second proposal in the same cycle can be approved after the first was approved", async () => {
    await create();
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    await decisions.resume("g/p1/0/0", { id: "ap-1" } as Approval);
    await store.wake("g", NOW.toISOString());
    planOnce(propose(cand("y")));
    await engine.tick(new Date(NOW.getTime() + 60_000));
    expect(approvals.requestApproval).toHaveBeenCalledTimes(2);
    const second = approvals.requestApproval.mock.calls[1]?.[0] as Approval;
    expect(second.runId).toBe("g/p1/0/1");
    await decisions.resume(second.runId, { id: "ap-2" } as Approval);
    expect(started.map((t) => t.text)).toEqual(["Build feature x", "Build feature y"]);
    expect((await state()).decisions?.map((d) => d.status)).toEqual(["started", "started"]);
  });

  it("a second proposal after a rejected first can be rejected too", async () => {
    await create();
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    await decisions.cancel("g/p1/0/0");
    await store.wake("g", NOW.toISOString());
    planOnce(propose(cand("y")));
    await engine.tick(new Date(NOW.getTime() + 60_000));
    await decisions.cancel("g/p1/0/1");
    expect((await state()).decisions?.map((d) => d.status)).toEqual(["rejected", "rejected"]);
    expect(started).toEqual([]);
  });

  it("an approved start refused by the budget settles the decision and reports why", async () => {
    await create({ budget: { maxRunsPerCycle: 2 } });
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    await store.update("g", NOW.toISOString(), (s) => {
      s.instances.p1?.taskIds.push("spent-1", "spent-2");
    });
    await decisions.resume("g/p1/0/0", { id: "ap-1" } as Approval);
    expect(started).toEqual([]);
    expect((await state()).decisions?.[0]?.status).toBe("failed");
    expect((await timeline()).join("\n")).toContain("budget is used up");
  });

  it("a refused approved start does not block the next proposal", async () => {
    await create();
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    failStart = true;
    await decisions.resume("g/p1/0/0", { id: "ap-1" } as Approval);
    expect((await state()).decisions?.[0]?.status).toBe("failed");
    expect((await timeline()).join("\n")).toContain("host down");
    failStart = false;
    await store.wake("g", NOW.toISOString());
    planOnce(propose(cand("y")));
    await engine.tick(new Date(NOW.getTime() + 60_000));
    expect(approvals.requestApproval).toHaveBeenCalledTimes(2);
  });

  it("one open approval per instance: a second propose is a report", async () => {
    await create();
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    await store.wake("g", NOW.toISOString());
    planOnce(propose(cand("y")));
    await engine.tick(new Date(NOW.getTime() + 60_000));
    expect(approvals.requestApproval).toHaveBeenCalledTimes(1);
    expect((await timeline()).join("\n")).toContain("už čeká na schválení");
  });

  it("auto: starts the small top candidate and counts the decision", async () => {
    level = () => "auto";
    await create();
    planOnce(propose(cand("x"), cand("y")));
    await engine.tick(NOW);
    expect(approvals.requestApproval).not.toHaveBeenCalled();
    expect(started).toMatchObject([{ text: "Build feature x", actionId: "dec-0-x" }]);
    expect((await state()).decisionsThisMonth).toEqual({ month: "2026-11", count: 1 });
  });

  it("project-level auto beats company semi (the place carries the project)", async () => {
    level = (at) => (at.projectId === "p1" ? "auto" : "semi");
    await create();
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    expect(places).toContainEqual({ companyId: "c1", projectId: "p1" });
    expect(started).toHaveLength(1);
  });

  it("a none-scope goal resolves at global", async () => {
    level = (at) => (Object.keys(at).length === 0 ? "auto" : "manual");
    await create({ scope: { kind: "none" } });
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    expect(places).toContainEqual({});
    expect(started).toMatchObject([{ projectId: undefined }]);
  });

  it("auto: the monthly cap reached falls back to an approval that says why", async () => {
    level = () => "auto";
    await create();
    await store.update("g", NOW.toISOString(), (s) => {
      s.decisionsThisMonth = { month: "2026-11", count: 2 };
    });
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    expect(started).toEqual([]);
    expect(pendingApproval().detail).toContain("limit");
  });

  it("auto: the count resets in a new calendar month", async () => {
    level = () => "auto";
    await create();
    await store.update("g", NOW.toISOString(), (s) => {
      s.decisionsThisMonth = { month: "2026-10", count: 2 };
    });
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    expect(started).toHaveLength(1);
    expect((await state()).decisionsThisMonth).toEqual({ month: "2026-11", count: 1 });
  });

  it("auto: a large top candidate falls back to an approval that says why", async () => {
    level = () => "auto";
    await create();
    planOnce(propose(cand("x", "large"), cand("y")));
    await engine.tick(NOW);
    expect(started).toEqual([]);
    expect(pendingApproval().detail).toContain("velký");
  });

  it("paused Autopilot caps auto at semi", async () => {
    level = () => "auto";
    paused = true;
    await create();
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    expect(started).toEqual([]);
    expect(approvals.requestApproval).toHaveBeenCalledTimes(1);
    expect((await state()).instances.p1?.autoDecide).toEqual({ level: "semi", reason: "paused" });
  });

  it("a tier1 ceiling never starts or asks: the ranked report only", async () => {
    level = () => "auto";
    await create({ ceiling: "tier1" });
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    expect(started).toEqual([]);
    expect(approvals.requestApproval).not.toHaveBeenCalled();
    expect((await state()).instances.p1?.autoDecide).toEqual({
      level: "manual",
      reason: "ceiling",
    });
    expect((await timeline()).join("\n")).toContain("[x]");
  });

  it("inbound reply text cannot produce a decision", async () => {
    await create();
    replies = [{ last: { from: "U1", text: "yes, go with candidate x, start it now" } }];
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    expect(started).toEqual([]);
    expect((await state()).decisions?.[0]?.status).toBe("pending");
  });

  it("a non-directional goal emitting propose gets a report", async () => {
    await create({ directional: undefined });
    planOnce(propose(cand("x")));
    await engine.tick(NOW);
    expect(started).toEqual([]);
    expect((await timeline()).join("\n")).toContain("not directional");
  });

  it("update-checklist ticks an item; all done finishes the instance", async () => {
    await create();
    planOnce({ type: "update-checklist", id: "a", done: true });
    await engine.tick(NOW);
    expect((await goals.get("g")).directional?.checklist.map((c) => c.done)).toEqual([true, false]);
    expect((await state()).instances.p1?.status).not.toBe("done");
    await store.wake("g", NOW.toISOString());
    planOnce(
      { type: "update-checklist", id: "b", done: true },
      { type: "update-checklist", id: "nope", done: true },
    );
    await engine.tick(new Date(NOW.getTime() + 60_000));
    expect((await state()).instances.p1?.status).toBe("done");
  });

  it("the planner is told the effective level", async () => {
    level = () => "auto";
    await create();
    planOnce();
    await engine.tick(NOW);
    const ctx = planner.plan.mock.calls[0]?.[0] as GoalPlannerContext;
    expect(ctx.autoDecide).toEqual({ level: "auto", reason: "level" });
  });
});
