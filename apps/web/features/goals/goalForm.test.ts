import { describe, expect, it } from "vitest";
import type { Goal } from "@zibby/contracts";
import {
  EMPTY_GOAL_FORM,
  buildCreateGoalInput,
  buildUpdateGoalInput,
  goalToFormValues,
  isGoalFormValid,
} from "./goalForm";

const base = { ...EMPTY_GOAL_FORM, name: "Moje PR", outcome: "Všechny PR jsou zelené." };

describe("buildCreateGoalInput", () => {
  it("creates a paused goal with a slug id and only the one-off side", () => {
    const input = buildCreateGoalInput({ ...base, deadline: "2026-12-01T10:00" });
    expect(input).toMatchObject({ id: "moje-pr", enabled: false, scope: { kind: "none" } });
    expect(input.deadline).toBeDefined();
    expect(input).not.toHaveProperty("cadence");
    expect(input).not.toHaveProperty("cycleHours");
  });

  it("emits cadence (and cycleHours) but no deadline for a standing goal", () => {
    const input = buildCreateGoalInput({
      ...base,
      timing: "standing",
      deadline: "2026-12-01T10:00",
      cadenceHour: "7",
      cycleHours: "6",
    });
    expect(input.cadence).toEqual({ every: "weekday", hour: 7 });
    expect(input.cycleHours).toBe(6);
    expect(input).not.toHaveProperty("deadline");
  });
});

describe("buildUpdateGoalInput", () => {
  it("sends null for every emptied clearable field", () => {
    expect(buildUpdateGoalInput(base)).toMatchObject({
      predicate: null,
      deadline: null,
      cadence: null,
      cycleHours: null,
      budget: null,
    });
  });

  it("nulls the deadline when switching a one-off goal to standing", () => {
    const body = buildUpdateGoalInput({ ...base, timing: "standing", cadenceHour: "8" });
    expect(body.deadline).toBeNull();
    expect(body.cadence).toEqual({ every: "weekday", hour: 8 });
  });

  it("nulls cadence and cycleHours when switching standing to one-off", () => {
    const body = buildUpdateGoalInput({ ...base, timing: "oneoff", cycleHours: "6" });
    expect(body.cadence).toBeNull();
    expect(body.cycleHours).toBeNull();
  });

  it("round-trips a goal through the form values", () => {
    const goal: Goal = {
      id: "g",
      name: "G",
      outcome: "O",
      scope: { kind: "projects", projectIds: ["a"] },
      cadence: { every: "day", hour: 7 },
      cycleHours: 4,
      budget: { maxRunsPerCycle: 3 },
      ceiling: "tier1",
      enabled: true,
      createdAt: "2026-11-26T10:00:00.000Z",
      updatedAt: "2026-11-26T10:00:00.000Z",
    };
    const body = buildUpdateGoalInput(goalToFormValues(goal));
    expect(body).toMatchObject({
      scope: goal.scope,
      cadence: goal.cadence,
      cycleHours: 4,
      budget: { maxRunsPerCycle: 3 },
      ceiling: "tier1",
      deadline: null,
    });
  });
});

describe("isGoalFormValid", () => {
  it("needs a name, an outcome, and a project when the scope is projects", () => {
    expect(isGoalFormValid(EMPTY_GOAL_FORM)).toBe(false);
    expect(isGoalFormValid(base)).toBe(true);
    expect(isGoalFormValid({ ...base, scopeKind: "projects" })).toBe(false);
    expect(isGoalFormValid({ ...base, scopeKind: "projects", projectIds: ["a"] })).toBe(true);
  });
});
