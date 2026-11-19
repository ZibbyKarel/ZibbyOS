import { describe, expect, it } from "vitest";
import type { Workflow } from "../../../../domain";
import { draftDirty, draftFromWorkflow, draftPatch } from "./workflowDraft";

const wf = {
  id: "w",
  name: "Feature",
  desc: "d",
  file: "f",
  lastRun: "",
  lastState: "done",
  outputs: [],
  instructions: "go",
  phases: [],
  budget: { maxCostUsd: 5, warnAtPct: 70 },
} as unknown as Workflow;

describe("workflowDraft", () => {
  it("an untouched draft is clean and patches nothing", () => {
    const d = draftFromWorkflow(wf);
    expect(draftPatch(wf, d)).toEqual({});
    expect(draftDirty(wf, d)).toBe(false);
  });

  it("patches only what changed", () => {
    const d = {
      ...draftFromWorkflow(wf),
      name: " New ",
      maxCostUsd: 9,
      complexity: "deep" as const,
    };
    expect(draftPatch(wf, d)).toEqual({
      name: "New",
      complexity: "deep",
      budget: { maxCostUsd: 9, warnAtPct: 70 },
    });
  });

  it("never sends a cleared optional field (the contract cannot unset it)", () => {
    const d = { ...draftFromWorkflow(wf), maxCostUsd: null, project: "", instructions: "  " };
    expect(draftPatch(wf, d)).toEqual({});
  });

  it("toggles requires", () => {
    expect(draftPatch(wf, { ...draftFromWorkflow(wf), requiresWeb: true }).requires).toEqual([
      "web",
    ]);
  });
});
