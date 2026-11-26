import { describe, expect, it } from "vitest";
import {
  CreateGoalSchema,
  GOAL_PRESETS,
  GoalActionSchema,
  type GoalInstance,
  GoalSchema,
  type GoalState,
  SetMergeGrantSchema,
  UpdateGoalSchema,
  emptyGoalState,
  goalsContract,
  rollupGoal,
} from "../index";

const base = {
  id: "my-goal",
  name: "My goal",
  outcome: "Everything is fine.",
  scope: { kind: "none" as const },
  enabled: true,
};

describe("goalsContract", () => {
  it("mounts under /api/goals", () => {
    expect(goalsContract.createGoal.path).toBe("/api/goals");
    expect(goalsContract.resumeGoalInstance.path).toBe("/api/goals/:id/instances/:instance/resume");
    expect(goalsContract.setGoalMergeGrant.path).toBe("/api/goals/:id/merge-grant");
    expect(goalsContract.clearGoalMergeGrant.method).toBe("DELETE");
  });
});

describe("merge grant", () => {
  it("SetMergeGrantSchema needs projects, takes no grantedAt (the server sets it)", () => {
    const until = "2026-12-01T00:00:00.000Z";
    expect(SetMergeGrantSchema.safeParse({ projectIds: ["p"], until }).success).toBe(true);
    expect(SetMergeGrantSchema.safeParse({ projectIds: [], until }).success).toBe(false);
    expect(
      SetMergeGrantSchema.safeParse({ projectIds: ["p"], until, grantedAt: until }).success,
    ).toBe(false);
  });

  it("the merge action carries an actionId, the project and a full approved SHA", () => {
    const merge = {
      type: "merge",
      actionId: "m1",
      projectId: "p",
      repo: "o/r",
      number: 1,
      approvedSha: "a".repeat(40),
    };
    expect(GoalActionSchema.safeParse(merge).success).toBe(true);
    expect(GoalActionSchema.safeParse({ ...merge, actionId: undefined }).success).toBe(false);
    expect(GoalActionSchema.safeParse({ ...merge, approvedSha: "abc" }).success).toBe(false);
  });
});

describe("CreateGoalSchema", () => {
  it("defaults ceiling to tier2", () => {
    expect(CreateGoalSchema.parse(base).ceiling).toBe("tier2");
  });

  it("rejects deadline together with cadence", () => {
    const r = CreateGoalSchema.safeParse({
      ...base,
      deadline: "2026-12-01T00:00:00.000Z",
      cadence: { every: "day", hour: 9 },
    });
    expect(r.success).toBe(false);
  });

  it("rejects cycleHours without cadence, accepts it with cadence", () => {
    expect(CreateGoalSchema.safeParse({ ...base, cycleHours: 6 }).success).toBe(false);
    expect(
      CreateGoalSchema.safeParse({ ...base, cadence: { every: "day", hour: 9 }, cycleHours: 6 })
        .success,
    ).toBe(true);
  });

  it("rejects mergeGrant on create and update", () => {
    const mergeGrant = {
      projectIds: ["p"],
      until: "2026-12-01T00:00:00.000Z",
      grantedAt: "2026-11-30T00:00:00.000Z",
    };
    expect(CreateGoalSchema.safeParse({ ...base, mergeGrant }).success).toBe(false);
    expect(UpdateGoalSchema.safeParse({ mergeGrant }).success).toBe(false);
  });

  it("update applies no defaults: a lone enabled patch carries only enabled", () => {
    expect(Object.keys(UpdateGoalSchema.parse({ enabled: true }))).toEqual(["enabled"]);
    expect(Object.keys(UpdateGoalSchema.parse({}))).toEqual([]);
    expect(UpdateGoalSchema.parse({ ceiling: "tier3" })).toEqual({ ceiling: "tier3" });
  });

  it("update accepts a lone cycleHours (timing is checked on the merged goal) and null clears", () => {
    expect(UpdateGoalSchema.safeParse({ cycleHours: 12 }).success).toBe(true);
    expect(
      UpdateGoalSchema.safeParse({ deadline: null, cadence: { every: "day", hour: 9 } }).success,
    ).toBe(true);
    expect(UpdateGoalSchema.safeParse({ outcome: null }).success).toBe(false);
  });

  it("GoalSchema accepts mergeGrant", () => {
    const r = GoalSchema.safeParse({
      ...base,
      ceiling: "tier3",
      createdAt: "2026-11-26T00:00:00.000Z",
      updatedAt: "2026-11-26T00:00:00.000Z",
      mergeGrant: {
        projectIds: ["p"],
        until: "2026-12-01T00:00:00.000Z",
        grantedAt: "2026-11-30T00:00:00.000Z",
      },
    });
    expect(r.success).toBe(true);
  });
});

describe("GOAL_PRESETS", () => {
  it("has 11 unique, disabled presets that all parse through CreateGoalSchema", () => {
    expect(GOAL_PRESETS).toHaveLength(11);
    expect(new Set(GOAL_PRESETS.map((p) => p.id)).size).toBe(11);
    for (const { group, ...preset } of GOAL_PRESETS) {
      expect(["pr-ci", "maintenance", "brain", "directional"]).toContain(group);
      expect(preset.enabled).toBe(false);
      const r = CreateGoalSchema.safeParse(preset);
      expect(r.success, preset.id).toBe(true);
    }
  });
});

describe("rollupGoal", () => {
  const inst = (status: GoalInstance["status"], parkedReason?: GoalInstance["parkedReason"]) =>
    ({ status, taskIds: [], parkedReason }) satisfies GoalInstance;
  const stateOf = (instances: Record<string, GoalInstance>): GoalState => ({
    ...emptyGoalState("g", "2026-11-26T00:00:00.000Z"),
    instances,
  });

  it("is paused when disabled", () => {
    expect(rollupGoal({ enabled: false }, stateOf({ a: inst("acting") })).status).toBe("paused");
  });

  it("is planning with no instances", () => {
    const r = rollupGoal({ enabled: true }, emptyGoalState("g", "2026-11-26T00:00:00.000Z"));
    expect(r).toEqual({
      status: "planning",
      counts: { total: 0, done: 0, parked: 0, active: 0 },
      needsYou: 0,
    });
  });

  it("7/9 done + 1 needs-you + 1 failed", () => {
    const instances: Record<string, GoalInstance> = {
      u: inst("parked", "needs-operator"),
      f: inst("parked", "failed"),
    };
    for (let i = 0; i < 7; i++) instances[`d${i}`] = inst("done");
    const r = rollupGoal({ enabled: true }, stateOf(instances));
    expect(r.status).toBe("needs-you");
    expect(r.counts).toEqual({ total: 9, done: 7, parked: 2, active: 0 });
    expect(r.needsYou).toBe(2);
  });

  it("is done when all done", () => {
    expect(
      rollupGoal({ enabled: true }, stateOf({ a: inst("done"), b: inst("done") })).status,
    ).toBe("done");
  });

  it("picks the busiest status when mixed", () => {
    const s = (...st: GoalInstance["status"][]) =>
      rollupGoal(
        { enabled: true },
        stateOf(Object.fromEntries(st.map((x, i) => [`i${i}`, inst(x)]))),
      ).status;
    expect(s("done", "waiting", "planning", "acting")).toBe("acting");
    expect(s("done", "waiting", "planning")).toBe("planning");
    expect(s("done", "waiting")).toBe("waiting");
  });
});
