import { describe, expect, it } from "vitest";
import type { Goal, GoalIteration } from "@zibby/contracts";
import { goalStateTone, latestIterationSummary } from "./goal";

describe("goalStateTone", () => {
  it("maps every goal-run TaskRunStatus onto the canonical StateTone vocabulary", () => {
    expect(goalStateTone("running")).toBe("working");
    expect(goalStateTone("paused-limit")).toBe("thinking");
    expect(goalStateTone("parked")).toBe("blocked");
    expect(goalStateTone("error")).toBe("error");
    expect(goalStateTone("done")).toBe("done");
    expect(goalStateTone("interrupted")).toBe("idle");
  });

  it("defaults to idle when the goal has never run", () => {
    expect(goalStateTone(undefined)).toBe("idle");
  });
});

describe("latestIterationSummary", () => {
  const base: GoalIteration = {
    index: 0,
    makerKind: "agent",
    verifier: { kind: "claude", satisfied: false, output: "" },
    startedAt: "2026-01-01T00:00:00.000Z",
    status: "done",
  };

  it("returns undefined with no iterations", () => {
    expect(latestIterationSummary([])).toBeUndefined();
  });

  it("summarizes the latest iteration's outcome", () => {
    expect(latestIterationSummary([base])).toBe("Iteration 1 · verifier failed");
    expect(
      latestIterationSummary([{ ...base, verifier: { ...base.verifier, satisfied: true } }]),
    ).toBe("Iteration 1 · verifier passed");
    expect(latestIterationSummary([{ ...base, status: "running" }])).toBe(
      "Iteration 1 · verifier running",
    );
  });

  it("reads the last iteration, not the first", () => {
    const second: GoalIteration = { ...base, index: 1, status: "running" };
    expect(latestIterationSummary([base, second])).toBe("Iteration 2 · verifier running");
  });
});

import type { TaskRun } from "@zibby/contracts";
import {
  activeLoopArrow,
  defaultGoalRun,
  formatDuration,
  goalRunsFor,
  iterationsSince,
  monthSpendUsd,
  percentOf,
  runTotals,
  verdictLine,
} from "./goal";

const iter = (i: number, over: Partial<GoalIteration> = {}): GoalIteration => ({
  index: i,
  makerKind: "agent",
  verifier: { kind: "claude", satisfied: false, output: "" },
  startedAt: "2026-11-19T10:00:00.000Z",
  endedAt: "2026-11-19T10:03:12.000Z",
  status: "done",
  ...over,
});
const run = (over: Partial<TaskRun>): TaskRun =>
  ({
    runId: "r",
    kind: "goal",
    goalId: "g",
    status: "done",
    startedAt: "2026-11-19T09:00:00.000Z",
    ...over,
  }) as TaskRun;

describe("goal run helpers", () => {
  it("lists a goal's runs newest first and prefers a live one", () => {
    const runs = [
      run({ runId: "a", startedAt: "2026-11-01T00:00:00Z" }),
      run({ runId: "b", startedAt: "2026-11-05T00:00:00Z" }),
      run({ runId: "x", goalId: "other" }),
    ];
    expect(goalRunsFor("g", runs).map((r) => r.runId)).toEqual(["b", "a"]);
    const live = [run({ runId: "new" }), run({ runId: "old", status: "parked" })];
    expect(defaultGoalRun(live)?.runId).toBe("old");
    expect(defaultGoalRun([])).toBeUndefined();
  });

  it("formats durations", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(192_000)).toBe("3m 12s");
    expect(formatDuration(3_900_000)).toBe("1h 5m");
  });

  it("sums iteration time and passes the run cost through only when present", () => {
    const totals = runTotals(run({ iterations: [iter(0), iter(1)], costUsd: 1.08 }), 0);
    expect(totals).toEqual({ count: 2, durationMs: 384_000, costUsd: 1.08 });
    expect(runTotals(run({ iterations: [] }), 0).costUsd).toBeUndefined();
  });

  it("counts iterations inside a window across runs", () => {
    const now = new Date("2026-11-19T12:00:00Z").getTime();
    const runs = [
      run({ iterations: [iter(0), iter(1, { startedAt: "2026-11-10T00:00:00Z" })] }),
      run({ iterations: [iter(0)] }),
    ];
    expect(iterationsSince(runs, now, 24 * 3600 * 1000)).toBe(2);
    expect(iterationsSince(runs, now, 30 * 24 * 3600 * 1000)).toBe(3);
  });

  it("sums this month's cost, undefined without any cost data", () => {
    const now = new Date("2026-11-19T12:00:00Z").getTime();
    const runs = [
      run({ startedAt: "2026-11-02T10:00:00Z", costUsd: 1 }),
      run({ startedAt: "2026-11-03T10:00:00Z", costUsd: 2.5 }),
      run({ startedAt: "2026-10-03T10:00:00Z", costUsd: 9 }),
    ];
    expect(monthSpendUsd(runs, now)).toBe(3.5);
    expect(monthSpendUsd([run({ startedAt: "2026-11-02T10:00:00Z" })], now)).toBeUndefined();
  });

  it("percentOf clamps and handles a missing cap", () => {
    expect(percentOf(2, 5)).toBe(40);
    expect(percentOf(9, 5)).toBe(100);
    expect(percentOf(2, undefined)).toBe(0);
  });

  it("tells which arrow is live", () => {
    expect(activeLoopArrow(undefined)).toBeNull();
    expect(activeLoopArrow(run({ status: "parked" }))).toBeNull();
    const maker = run({ status: "running", iterations: [iter(0, { status: "running" })] });
    expect(activeLoopArrow(maker)).toBe("forward");
    const judging = run({
      status: "running",
      iterations: [
        iter(0, {
          status: "running",
          verifier: { kind: "claude", runRef: "v1", satisfied: false, output: "" },
        }),
      ],
    });
    expect(activeLoopArrow(judging)).toBe("back");
  });

  it("verdictLine takes the first non-empty line and shortens it", () => {
    expect(verdictLine("\n\n  Session lost.\nmore")).toBe("Session lost.");
    expect(verdictLine("x".repeat(200), 10)).toHaveLength(10);
  });
});

import { avgCostPerIteration, goalRunTaskBody } from "./goal";

describe("goalRunTaskBody / avgCostPerIteration", () => {
  const g = { id: "g", objective: "Do it", maker: { kind: "agent" as const, id: "m" } } as Goal;
  it("targets the goal", () => {
    expect(goalRunTaskBody({ id: "g", objective: "Do it" }).target).toEqual({
      kind: "goal",
      id: "g",
      name: "Do it",
    });
  });
  it("averages only costed runs of the same maker, else undefined", () => {
    const runs = [
      run({ goalId: "g", costUsd: 1, iterations: [iter(0), iter(1)] }),
      run({ goalId: "g", iterations: [iter(0)] }),
      run({ goalId: "other", costUsd: 9, iterations: [iter(0)] }),
    ];
    expect(avgCostPerIteration(runs, [g], "m")).toBe(0.5);
    expect(avgCostPerIteration(runs, [g], "nobody")).toBeUndefined();
  });
});
