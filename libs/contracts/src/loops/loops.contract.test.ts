import { describe, expect, it } from "vitest";
import * as contracts from "../index";
import {
  LoopRunSchema,
  LoopSchema,
  TaskTargetSchema,
  VerifierSpecSchema,
  loopsContract,
} from "../index";

const baseLoop = {
  id: "ship-feature",
  objective: "Ship feature Y green",
  maker: { kind: "workflow" as const, id: "delivery" },
  verifier: { kind: "claude" as const, agent: "code-reviewer" },
  maxIterations: 5,
  instructions: "Keep iterating until the reviewer passes it.",
};

describe("loopsContract", () => {
  it("exposes CRUD over loop definitions", () => {
    expect(loopsContract.createLoop.path).toBe("/api/loops");
    expect(loopsContract.getLoop.path).toBe("/api/loops/:id");
  });

  it("has no per-kind run contract (loops run only via a task; ops live on /api/tasks/runs)", () => {
    expect(contracts).not.toHaveProperty("loopRunsContract");
  });
});

describe("LoopSchema", () => {
  it("accepts a well-formed loop with a claude verifier", () => {
    expect(LoopSchema.safeParse(baseLoop).success).toBe(true);
  });

  it("accepts a claude verifier with model + thinking", () => {
    const loop = {
      ...baseLoop,
      verifier: { kind: "claude" as const, agent: "reviewer", model: "haiku", thinking: "low" },
    };
    expect(LoopSchema.safeParse(loop).success).toBe(true);
  });

  it("rejects maxIterations of zero", () => {
    expect(LoopSchema.safeParse({ ...baseLoop, maxIterations: 0 }).success).toBe(false);
  });

  it("rejects a maker kind that is not agent or workflow", () => {
    expect(LoopSchema.safeParse({ ...baseLoop, maker: { kind: "loop", id: "x" } }).success).toBe(
      false,
    );
  });

  it("accepts an optional projectId (O-16), and still parses without one", () => {
    expect(LoopSchema.safeParse({ ...baseLoop, projectId: "client-portal" }).success).toBe(true);
    expect(LoopSchema.safeParse(baseLoop).success).toBe(true);
  });
});

describe("VerifierSpecSchema", () => {
  it("accepts claude and rejects the removed shell checks verifier (D-024)", () => {
    expect(VerifierSpecSchema.safeParse({ kind: "claude", agent: "judge" }).success).toBe(true);
    expect(VerifierSpecSchema.safeParse({ kind: "checks", commands: ["pnpm test"] }).success).toBe(
      false,
    );
  });

  it("rejects a claude verifier without an agent", () => {
    expect(VerifierSpecSchema.safeParse({ kind: "claude" }).success).toBe(false);
  });
});

describe("LoopRunSchema", () => {
  it("round-trips an aggregate with an iteration record", () => {
    const parsed = LoopRunSchema.safeParse({
      loopRunId: "ship-feature_1",
      loopId: "ship-feature",
      status: "running",
      currentIteration: 0,
      iterations: [
        {
          index: 0,
          makerKind: "workflow",
          makerRunRef: "delivery_1",
          verifier: { kind: "claude", satisfied: false, output: "1 failing" },
          startedAt: new Date().toISOString(),
          status: "running",
        },
      ],
      startedAt: new Date().toISOString(),
      cwd: "/tmp/ship-feature_1",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a parked loop with reason iterations", () => {
    const parsed = LoopRunSchema.safeParse({
      loopRunId: "g_1",
      loopId: "g",
      status: "parked",
      currentIteration: 2,
      iterations: [],
      startedAt: new Date().toISOString(),
      cwd: "/tmp/g_1",
      parkedReason: "iterations",
      parked: { iteration: 2, attempts: 3, verdictFile: "/tmp/g_1/iteration-2.verdict.txt" },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("TaskTargetSchema with loop arm", () => {
  it("round-trips a loop task target", () => {
    const target = { kind: "loop", id: "ship-feature", name: "Ship feature Y", glyph: "target" };
    expect(TaskTargetSchema.safeParse(target).success).toBe(true);
  });

  it("still round-trips the agent / workflow / orchestrator arms", () => {
    expect(TaskTargetSchema.safeParse({ kind: "agent", id: "a", name: "A" }).success).toBe(true);
    expect(TaskTargetSchema.safeParse({ kind: "workflow", id: "p", name: "P" }).success).toBe(true);
    expect(TaskTargetSchema.safeParse({ kind: "orchestrator", name: "Orchestrator" }).success).toBe(
      true,
    );
  });

  it("rejects an unknown target kind", () => {
    expect(TaskTargetSchema.safeParse({ kind: "wizard", id: "x", name: "X" }).success).toBe(false);
  });
});
