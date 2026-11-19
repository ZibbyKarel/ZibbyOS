import { describe, expect, it } from "vitest";
import type { RunView } from "../runs/run";
import { aggregateAgentRuns, formatDuration, formatUsd, isRunOfAgent } from "./agentRunStats";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function run(over: Partial<RunView>): RunView {
  return {
    runId: "r",
    kind: "agent",
    owner: "reviewer",
    status: "done",
    pct: null,
    title: "",
    prompt: "",
    project: "",
    startedAt: daysAgo(1),
    logBase: "agents",
    ...over,
  } as RunView;
}

describe("aggregateAgentRuns", () => {
  it("only counts this agent's own runs inside the 30-day window", () => {
    const runs = [
      run({ runId: "a", startedAt: daysAgo(1) }),
      run({ runId: "old", startedAt: daysAgo(40) }),
      run({ runId: "other", owner: "someone" }),
      run({ runId: "wf", kind: "workflow" }),
    ];
    const s = aggregateAgentRuns(runs, "reviewer", NOW);
    expect(s.runs).toBe(1);
    expect(s.recent.map((r) => r.runId)).toEqual(["a", "old"]);
    expect(s.series.runs.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("derives success rate, cost and duration", () => {
    const runs = [
      run({
        runId: "a",
        costUsd: 0.2,
        startedAt: daysAgo(2),
        taskOutcomeFinishedAt: new Date(NOW - 2 * 86_400_000 + 60_000).toISOString(),
      }),
      run({ runId: "b", status: "error", costUsd: 0.4, startedAt: daysAgo(3) }),
      run({ runId: "c", status: "running", startedAt: daysAgo(0.1) }),
    ];
    const s = aggregateAgentRuns(runs, "reviewer", NOW);
    expect(s.successRate).toBe(50);
    expect(s.avgCost).toBeCloseTo(0.3);
    expect(s.spend).toBeCloseTo(0.6);
    expect(s.avgDurationMs).toBe(60_000);
  });

  it("reports nulls for an agent without runs", () => {
    const s = aggregateAgentRuns([], "reviewer", NOW);
    expect(s).toMatchObject({ runs: 0, successRate: null, avgCost: null, avgDurationMs: null });
    expect(s.series.runs).toHaveLength(10);
  });
});

describe("helpers", () => {
  it("matches by owner or processor id", () => {
    expect(
      isRunOfAgent(
        run({ owner: "", processor: { kind: "agent", id: "reviewer", name: "R" } }),
        "reviewer",
      ),
    ).toBe(true);
  });
  it("formats", () => {
    expect(formatDuration(114_000)).toBe("1m 54s");
    expect(formatDuration(null)).toBe("—");
    expect(formatUsd(0.346)).toBe("$0.35");
    expect(formatUsd(30.94)).toBe("$30.9");
  });
});
