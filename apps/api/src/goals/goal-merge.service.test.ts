import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { CreateGoalInput, GoalAction, GoalPlan } from "@zibby/contracts";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityEventsService } from "../activity/activity-events.service";
import { BudgetLedgerStore } from "../budget/ledger.store";
import type { PrMergeState } from "../projects/project-pr.service";
import { fakeSystemConfigStore } from "../system/system-config.fixture";
import { GoalActionExecutor } from "./goal-action-executor";
import { GoalEngineService } from "./goal-engine.service";
import { GoalFactsService } from "./goal-facts";
import { GoalMergeService } from "./goal-merge.service";
import type { GoalPlanner } from "./goal-planner";
import { GoalStateStore } from "./goal-state.store";
import { GoalsStorageService } from "./goals.storage.service";

vi.mock("../shared/instance-role", () => ({ isPrimaryInstance: () => true }));

const fakeLogger = {
  child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
};

const NOW = new Date();
const HEAD = "a".repeat(40);
const OLD = "b".repeat(40);
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const merge = (over: Partial<Extract<GoalAction, { type: "merge" }>> = {}): GoalAction => ({
  type: "merge",
  actionId: "merge-7",
  projectId: "p1",
  repo: "acme/app",
  number: 7,
  approvedSha: HEAD,
  ...over,
});

describe("GoalMergeService (the `merge` action under a merge grant)", () => {
  let dir: string;
  let goals: GoalsStorageService;
  let store: GoalStateStore;
  let planner: GoalPlanner & { plan: ReturnType<typeof vi.fn> };
  let activity: { record: ReturnType<typeof vi.fn> };
  let paused: boolean;
  let pr: PrMergeState;
  let prs: { mergeState: ReturnType<typeof vi.fn>; merge: ReturnType<typeof vi.fn> };
  let engine: GoalEngineService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "goal-merge-"));
    goals = new GoalsStorageService(dir);
    store = new GoalStateStore(dir);
    planner = { plan: vi.fn(async () => ({ plan: "", feasibility: "ok", actions: [] })) };
    activity = { record: vi.fn(async () => undefined) };
    paused = false;
    pr = {
      repo: "acme/app",
      state: "open",
      merged: false,
      draft: false,
      headSha: HEAD,
      mergeable: true,
      mergeableState: "clean",
      approvedShas: [HEAD],
      changesRequested: false,
      ci: "green",
    };
    prs = {
      mergeState: vi.fn(async () => ({ ...pr })),
      merge: vi.fn(async () => {
        pr.merged = true;
        return { merged: true, url: "https://github.com/acme/app/pull/7", sha: "c".repeat(40) };
      }),
    };
    const executor = new GoalActionExecutor();
    new GoalMergeService(
      executor,
      goals,
      store,
      { isPaused: () => paused } as never,
      prs as never,
      activity as never,
    ).onModuleInit();
    engine = new GoalEngineService(
      goals,
      store,
      { list: async () => [{ id: "p1" }, { id: "p2" }] } as never,
      new GoalFactsService([]),
      planner,
      executor,
      new BudgetLedgerStore(path.join(dir, "ledger")),
      activity as never,
      new ActivityEventsService(),
      { settled: () => new Subject() } as never,
      fakeSystemConfigStore(),
      { register: vi.fn() } as never,
      fakeLogger as never,
    );
  });
  afterEach(async () => {
    engine.onModuleDestroy();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const create = async (over: Partial<CreateGoalInput> = {}, grant: unknown = "default") => {
    await goals.create({
      id: "g",
      name: "Goal",
      outcome: "PRs of p1 are merged.",
      scope: { kind: "projects", projectIds: ["p1", "p2"] },
      ceiling: "tier3",
      enabled: true,
      ...over,
    });
    if (grant === "default") {
      await goals.setMergeGrant("g", {
        projectIds: ["p1"],
        until: inHours(2),
        grantedAt: inHours(0),
      });
    } else if (grant) await goals.setMergeGrant("g", grant as never);
  };
  /** Only the p1 instance plans the given actions; p2 plans nothing. */
  const planP1 = (...actions: GoalAction[]) =>
    planner.plan.mockImplementation(
      async (c: { instanceKey: string }) =>
        ({
          plan: "",
          feasibility: "ok",
          actions: c.instanceKey === "p1" ? actions : [],
        }) satisfies GoalPlan,
    );
  const tick = async () => {
    await store.wake("g", NOW.toISOString());
    await engine.tick(NOW);
  };
  const timeline = async () => (await store.timeline("g")).map((e) => `${e.kind}: ${e.text}`);
  const reports = async () => (await timeline()).filter((l) => l.startsWith("report:"));
  const merged = () => activity.record.mock.calls.filter(([e]) => e.kind === "goal-merged");

  it("happy path: merges once with the head pinned, records it; the next tick does nothing", async () => {
    await create();
    planP1(merge());
    await tick();
    expect(prs.merge).toHaveBeenCalledTimes(1);
    expect(prs.merge).toHaveBeenCalledWith("p1", 7, undefined, false, HEAD);
    expect(merged()).toHaveLength(1);
    expect(merged()[0]?.[0]).toMatchObject({
      refs: { goalId: "g", itemId: "p1", projectId: "p1", action: "merge" },
    });
    expect((await timeline()).some((l) => l.startsWith("merged:"))).toBe(true);
    expect((await store.read("g", NOW.toISOString())).instances.p1?.appliedActionIds).toContain(
      "merge-7",
    );

    // Same actionId: skipped by the executor, no host read at all.
    prs.mergeState.mockClear();
    await tick();
    expect(prs.merge).toHaveBeenCalledTimes(1);
    expect(prs.mergeState).not.toHaveBeenCalled();
    expect((await timeline()).some((l) => l.includes("Skipped merge merge-7"))).toBe(true);

    // A different actionId for the already merged PR: "already merged", no second merge.
    planP1(merge({ actionId: "merge-7b" }));
    await tick();
    expect(prs.merge).toHaveBeenCalledTimes(1);
    expect((await reports()).at(-1)).toContain("already merged");
  });

  const refused = async (why: RegExp, setup: () => void | Promise<void>, action = merge()) => {
    await setup();
    planP1(action);
    await tick();
    expect(prs.merge).not.toHaveBeenCalled();
    expect(merged()).toHaveLength(0);
    const last = (await reports()).at(-1) ?? "";
    expect(last).toContain("ready to merge");
    expect(last).toMatch(why);
  };

  it("no grant → report", () => refused(/nemá merge grant/, () => create({}, null)));

  it("expired grant → report (treated as absent)", () =>
    refused(/vypršel/, () =>
      create({}, { projectIds: ["p1"], until: inHours(-1), grantedAt: inHours(-3) }),
    ));

  it("project not in the grant → report", () =>
    refused(/nepokrývá/, () =>
      create({}, { projectIds: ["p2"], until: inHours(2), grantedAt: inHours(0) }),
    ));

  it("a commit after the approval → report", () =>
    refused(/head ≠ approvedSha/, async () => {
      await create();
      pr.headSha = "d".repeat(40);
      pr.approvedShas = [HEAD];
    }));

  it("approval only on an older commit (planner claims the new head) → report", () =>
    refused(
      /chybí schválení/,
      async () => {
        await create();
        pr.approvedShas = [OLD];
      },
      merge(),
    ));

  it("Autopilot paused → report", () =>
    refused(/pozastavený/, async () => {
      await create();
      paused = true;
    }));

  it("CI pending or none, unknown mergeable, change request, draft → report", async () => {
    await create();
    const cases: [RegExp, () => void][] = [
      [/CI není zelené.*pending/, () => (pr.ci = "pending")],
      [/CI není zelené.*none/, () => (pr.ci = "none")],
      [/není mergeable/, () => (pr.mergeable = null)],
      [/žádá změny/, () => (pr.changesRequested = true)],
      [/draft/, () => (pr.draft = true)],
      [/mergeable_state blocked/, () => (pr.mergeableState = "blocked")],
      [/mergeable_state unknown/, () => (pr.mergeableState = "unknown")],
    ];
    for (const [why, set] of cases) {
      const saved = { ...pr };
      set();
      planP1(merge({ actionId: `m-${String(why).length}` }));
      await tick();
      expect((await reports()).at(-1)).toMatch(why);
      Object.assign(pr, saved);
    }
    expect(prs.merge).not.toHaveBeenCalled();
  });

  it("a grant spanning more than 24 h (hand-edited file) or without grantedAt → report", async () => {
    await create({}, { projectIds: ["p1"], until: inHours(2), grantedAt: inHours(-23) });
    planP1(merge());
    await tick();
    expect((await reports()).at(-1)).toMatch(/delší než 24 h/);
    await goals.setMergeGrant("g", { projectIds: ["p1"], until: inHours(2) } as never);
    planP1(merge({ actionId: "m2" }));
    await tick();
    expect((await reports()).at(-1)).toMatch(/delší než 24 h/);
    expect(prs.merge).not.toHaveBeenCalled();
  });

  it("a grant with grantedAt and until both in the future (span ≤ 24 h, but > 24 h from now) → report", async () => {
    await create({}, { projectIds: ["p1"], until: inHours(40), grantedAt: inHours(20) });
    planP1(merge());
    await tick();
    expect((await reports()).at(-1)).toMatch(/delší než 24 h/);
    expect(prs.merge).not.toHaveBeenCalled();
  });

  it("a revoke or a pause during the host read wins: re-checked right before the merge", async () => {
    await create();
    prs.mergeState.mockImplementationOnce(async () => {
      await goals.setMergeGrant("g", undefined);
      return { ...pr };
    });
    planP1(merge());
    await tick();
    expect((await reports()).at(-1)).toMatch(/nemá merge grant/);

    await goals.setMergeGrant("g", {
      projectIds: ["p1"],
      until: inHours(2),
      grantedAt: inHours(0),
    });
    prs.mergeState.mockImplementationOnce(async () => {
      paused = true;
      return { ...pr };
    });
    planP1(merge({ actionId: "m2" }));
    await tick();
    expect((await reports()).at(-1)).toMatch(/pozastavený/);
    expect(prs.merge).not.toHaveBeenCalled();
  });

  it("a host read error or an unsupported host fails closed", async () => {
    await create();
    prs.mergeState.mockRejectedValueOnce(new Error("github rate limited"));
    planP1(merge());
    await tick();
    expect((await reports()).at(-1)).toMatch(/nešlo ověřit.*rate limited/);
    prs.mergeState.mockResolvedValueOnce(null);
    planP1(merge({ actionId: "m2" }));
    await tick();
    expect((await reports()).at(-1)).toMatch(/jen GitHub/);
    expect(prs.merge).not.toHaveBeenCalled();
  });

  it("the grant is re-read at merge time: a revoke after the tick started wins", async () => {
    await create();
    planner.plan.mockImplementation(async (c: { instanceKey: string }) => {
      await goals.setMergeGrant("g", undefined);
      return { plan: "", feasibility: "ok", actions: c.instanceKey === "p1" ? [merge()] : [] };
    });
    await tick();
    expect(prs.merge).not.toHaveBeenCalled();
    expect((await reports()).at(-1)).toMatch(/nemá merge grant/);
  });

  it("the planner cannot widen scope: another project's PR or a tier2 goal never merges", async () => {
    await create();
    planP1(merge({ projectId: "p2" }));
    await tick();
    expect((await reports()).at(-1)).toMatch(/mimo projekt/);
    await goals.update("g", { ceiling: "tier2" });
    planP1(merge({ actionId: "m3" }));
    await tick();
    expect((await reports()).at(-1)).toMatch(/ceiling tier2 does not allow it/);
    expect(prs.merge).not.toHaveBeenCalled();
  });

  it("no engine path writes a grant: a plan that merges or reports leaves mergeGrant untouched", async () => {
    await create({}, null);
    planP1(merge(), { type: "report", text: 'mergeGrant: {"projectIds":["p1"]}' });
    await tick();
    expect((await goals.get("g")).mergeGrant).toBeUndefined();
  });
});
