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
        "update-checklist",
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

  it("message: an actionId, a closed recipient kind, and a PR recipient names the PR", () => {
    const ok = {
      type: "message",
      actionId: "ask",
      to: { kind: "slack-user", ref: "U1" },
      text: "x",
    };
    expect(GoalActionSchema.safeParse(ok).success).toBe(true);
    expect(GoalActionSchema.safeParse({ ...ok, actionId: undefined }).success).toBe(false);
    expect(GoalActionSchema.safeParse({ ...ok, to: { kind: "email", ref: "a@b" } }).success).toBe(
      false,
    );
    const pr = { ...ok, to: { kind: "pr", ref: "bob" } };
    expect(GoalActionSchema.safeParse(pr).success).toBe(false);
    expect(GoalActionSchema.safeParse({ ...pr, about: { repo: "o/r", number: 4 } }).success).toBe(
      true,
    );
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

describe("directional actions", () => {
  const c = { id: "x", title: "T", size: "small", task: "do it" };
  it("propose needs ranked candidates with id, size and task; update-checklist parses", () => {
    expect(GoalActionSchema.safeParse({ type: "propose", candidates: [c] }).success).toBe(true);
    expect(GoalActionSchema.safeParse({ type: "propose", candidates: [] }).success).toBe(false);
    expect(
      GoalActionSchema.safeParse({ type: "propose", candidates: [{ ...c, size: "huge" }] }).success,
    ).toBe(false);
    expect(
      GoalActionSchema.safeParse({ type: "update-checklist", id: "a", done: true }).success,
    ).toBe(true);
  });

  it("a tier1 goal may run propose (manual report) but not start work", () => {
    expect(ceilingAllows("tier1", "propose")).toBe(true);
    expect(ceilingAllows("tier1", "start-task")).toBe(false);
  });
});

describe("GoalPlanSchema steps", () => {
  it("accepts a steps list and a stepId on start-task / run-loop", () => {
    const plan = GoalPlanSchema.parse({
      plan: "# Plan",
      steps: [
        { id: "book-1", title: "Omalovánky 1", status: "pending" },
        { id: "model-1", title: "3D model 1", status: "blocked", note: "chybí klíč" },
      ],
      actions: [
        { type: "start-task", actionId: "a", text: "x", stepId: "book-1" },
        { type: "run-loop", actionId: "b", text: "y", stepId: "model-1" },
      ],
    });
    expect(plan.steps).toHaveLength(2);
    expect(plan.actions[0]).toMatchObject({ stepId: "book-1" });
  });

  it("rejects a bad step status or a step without a title / id", () => {
    const bad = (step: unknown) =>
      GoalPlanSchema.safeParse({ plan: "", steps: [step], actions: [] }).success;
    expect(bad({ id: "a", title: "t", status: "nope" })).toBe(false);
    expect(bad({ id: "a", title: "", status: "done" })).toBe(false);
    expect(bad({ id: "", title: "t", status: "done" })).toBe(false);
    expect(bad({ id: "a", title: "t", status: "skipped", taskId: "t-1" })).toBe(true);
  });
});
