import { describe, expect, it } from "vitest";
import { type WorkflowLike, phaseUsesAgent, workflowsUsingAgent } from "./agentWorkflows";

const wf = (id: string, agents: (string | undefined)[]) =>
  ({ id, phases: agents.map((agent, i) => ({ id: `p${i}`, agent })) }) satisfies WorkflowLike;

describe("workflowsUsingAgent", () => {
  it("matches by id, falls back to the display name, and lists every owned phase", () => {
    const agent = { id: "reviewer", name: "Kodér Review" };
    const uses = workflowsUsingAgent(
      [wf("a", ["x", "reviewer", "reviewer"]), wf("b", ["Kodér Review"]), wf("c", [undefined])],
      agent,
    );
    expect(uses.map((u) => [u.workflow.id, u.phaseIndexes])).toEqual([
      ["a", [1, 2]],
      ["b", [0]],
    ]);
  });

  it("never matches a phase without an agent", () => {
    expect(phaseUsesAgent({}, { id: "x" })).toBe(false);
  });
});
