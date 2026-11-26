import { describe, expect, it } from "vitest";
import {
  CreateGoalSchema,
  GOAL_PRESETS,
  type GoalInstance,
  GoalSchema,
  type GoalState,
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
