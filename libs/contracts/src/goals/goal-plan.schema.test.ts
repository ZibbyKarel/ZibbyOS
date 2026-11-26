import { describe, expect, it } from "vitest";
import { GOAL_ACTION_MIN_CEILING, GoalActionSchema, GoalPlanSchema, ceilingAllows } from "../index";

describe("GoalActionSchema", () => {
  it("covers exactly the spec's action table", () => {
    expect(Object.keys(GOAL_ACTION_MIN_CEILING).sort()).toEqual(
      [
        "done",
        "merge",
        "message",
        "note",
        "park",
        "pr-action",
        "propose",
        "report",
        "run-loop",
        "start-task",
        "wait",
      ].sort(),
    );
  });

  it("rejects an unknown action and a wait with nothing to wait on", () => {
    expect(GoalActionSchema.safeParse({ type: "deploy" }).success).toBe(false);
    expect(GoalActionSchema.safeParse({ type: "wait" }).success).toBe(false);
    expect(
      GoalActionSchema.safeParse({ type: "wait", wakeAt: "2026-12-01T08:00:00.000Z" }).success,
    ).toBe(true);
  });

  it("parses a plan", () => {
    const plan = GoalPlanSchema.parse({
      plan: "# Plan",
      actions: [
        { type: "note", text: "x" },
        { type: "start-task", text: "fix it" },
      ],
    });
    expect(plan.actions).toHaveLength(2);
  });
});

describe("ceilingAllows", () => {
  it("follows the minimum ceilings", () => {
    expect(ceilingAllows("tier1", "report")).toBe(true);
    expect(ceilingAllows("tier1", "start-task")).toBe(false);
    expect(ceilingAllows("tier2", "start-task")).toBe(true);
    expect(ceilingAllows("tier2", "merge")).toBe(false);
    expect(ceilingAllows("tier3", "merge")).toBe(true);
  });
});
