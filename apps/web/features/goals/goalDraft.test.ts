import { describe, expect, it } from "vitest";
import type { Goal } from "@zibby/contracts";
import {
  EMPTY_DRAFT,
  draftFromGoal,
  draftToCreate,
  draftToUpdate,
  isDraftValid,
} from "./goalDraft";

const goal: Goal = {
  id: "g1",
  name: "Remember me",
  objective: "Ship it",
  maker: { kind: "workflow", id: "delivery" },
  verifier: { kind: "claude", agent: "reviewer", model: "opus", thinking: "high" },
  maxIterations: 8,
  budget: { dailyRuns: 5, monthlyCostCapUsd: 40 },
  instructions: "Keep going",
  projectId: "acme",
};

describe("goalDraft", () => {
  it("round-trips a goal through the draft", () => {
    expect(draftToUpdate(draftFromGoal(goal))).toEqual({
      name: "Remember me",
      objective: "Ship it",
      projectId: "acme",
      maker: { kind: "workflow", id: "delivery" },
      verifier: { kind: "claude", agent: "reviewer", model: "opus", thinking: "high" },
      maxIterations: 8,
      budget: { dailyRuns: 5, monthlyCostCapUsd: 40 },
      instructions: "Keep going",
    });
  });

  it("clears emptied optional fields and falls back to the objective for instructions", () => {
    const d = {
      ...draftFromGoal(goal),
      name: " ",
      projectId: "",
      dailyRuns: null,
      monthlyCostCapUsd: null,
      instructions: "",
    };
    const body = draftToUpdate(d);
    expect(body.name).toBeUndefined();
    expect(body.projectId).toBeUndefined();
    expect(body.budget).toBeUndefined();
    expect(body.instructions).toBe("Ship it");
  });

  it("validates the required fields", () => {
    expect(isDraftValid(EMPTY_DRAFT)).toBe(false);
    const ok = { ...EMPTY_DRAFT, objective: "x", makerId: "m", verifierAgent: "v" };
    expect(isDraftValid(ok)).toBe(true);
    expect(isDraftValid({ ...ok, maxIterations: 0 })).toBe(false);
    expect(isDraftValid({ ...ok, maxIterations: null })).toBe(false);
  });

  it("adds the id for a create body", () => {
    expect(draftToCreate(draftFromGoal(goal), "new-id").id).toBe("new-id");
  });
});
