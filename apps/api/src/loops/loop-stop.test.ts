import { describe, expect, it } from "vitest";
import type { LoopRun } from "@zibby/contracts";
import { decideStop, renderLoopProgress } from "./loop-stop";

describe("decideStop", () => {
  it("parks on budget regardless of everything else", () => {
    expect(decideStop({ satisfied: true, index: 0, maxIterations: 5, budgetOk: false })).toBe(
      "park-budget",
    );
  });

  it("finishes when the verifier is satisfied", () => {
    expect(decideStop({ satisfied: true, index: 0, maxIterations: 5, budgetOk: true })).toBe(
      "satisfied",
    );
  });

  it("continues when unsatisfied and attempts remain", () => {
    expect(decideStop({ satisfied: false, index: 0, maxIterations: 3, budgetOk: true })).toBe(
      "continue",
    );
    expect(decideStop({ satisfied: false, index: 1, maxIterations: 3, budgetOk: true })).toBe(
      "continue",
    );
  });

  it("parks on iterations when the last attempt failed verification", () => {
    expect(decideStop({ satisfied: false, index: 2, maxIterations: 3, budgetOk: true })).toBe(
      "park-iterations",
    );
    expect(decideStop({ satisfied: false, index: 0, maxIterations: 1, budgetOk: true })).toBe(
      "park-iterations",
    );
  });
});

describe("renderLoopProgress", () => {
  const run = (iterations: LoopRun["iterations"], currentIteration: number | null): LoopRun => ({
    loopRunId: "g_1",
    loopId: "g",
    status: "running",
    currentIteration,
    iterations,
    startedAt: new Date().toISOString(),
    cwd: "/tmp/g_1",
  });

  it("notes when no iterations have run", () => {
    const md = renderLoopProgress(run([], 0), "Ship Y", 3);
    expect(md).toContain("No iterations completed yet");
    expect(md).toContain("Iteration 1 of 3");
  });

  it("lists each iteration with its verifier verdict", () => {
    const iterations: LoopRun["iterations"] = [
      {
        index: 0,
        makerKind: "workflow",
        verifier: { kind: "claude", satisfied: false, output: "red" },
        startedAt: new Date().toISOString(),
        status: "failed",
      },
    ];
    const md = renderLoopProgress(run(iterations, 1), "Ship Y", 3);
    expect(md).toContain("Iteration 1: maker failed, verifier NOT satisfied");
  });
});
