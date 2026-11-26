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
        { type: "start-task", actionId: "fix-1", text: "fix it" },
        {
          type: "pr-action",
          actionId: "rev:web-4",
          op: "review",
          projectId: "web",
          repo: "o/web",
          number: 4,
        },
      ],
    });
    expect(plan.actions).toHaveLength(3);
  });

  it("requires a bounded actionId on the work-starting actions", () => {
    expect(GoalActionSchema.safeParse({ type: "start-task", text: "x" }).success).toBe(false);
    expect(GoalActionSchema.safeParse({ type: "run-loop", text: "x" }).success).toBe(false);
    for (const actionId of ["", "a b", "x".repeat(65), "<goal-plan>"]) {
      expect(GoalActionSchema.safeParse({ type: "start-task", actionId, text: "x" }).success).toBe(
        false,
      );
    }
    expect(
      GoalActionSchema.safeParse({
        type: "pr-action",
        actionId: "a",
        op: "review",
        repo: "o/r",
        number: 1,
      }).success,
    ).toBe(false); // projectId required
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
