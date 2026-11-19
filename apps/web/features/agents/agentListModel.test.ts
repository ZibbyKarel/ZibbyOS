import { describe, expect, it } from "vitest";
import type { Agent } from "@zibby/contracts";
import type { RunView } from "../runs/run";
import { agentMatches, agentPresence, agentWeekStats, toolGlyphs } from "./agentListModel";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const run = (over: Partial<RunView>) =>
  ({
    runId: "r",
    kind: "agent",
    owner: "kodér",
    status: "done",
    pct: null,
    title: "",
    prompt: "",
    project: "",
    startedAt: daysAgo(1),
    logBase: "agents",
    ...over,
  }) as RunView;

describe("agentPresence", () => {
  it("is working with the run title while one of its runs runs", () => {
    const runs = [run({ status: "running", title: "feat/queue" }), run({ owner: "x" })];
    expect(agentPresence(runs, "kodér")).toEqual({ presence: "working", task: "feat/queue" });
  });
  it("is error when the latest run failed, idle after a later success", () => {
    const failed = run({ status: "error", startedAt: daysAgo(1) });
    expect(agentPresence([failed], "kodér").presence).toBe("error");
    expect(agentPresence([failed, run({ startedAt: daysAgo(0.5) })], "kodér").presence).toBe(
      "idle",
    );
  });
});

describe("agentWeekStats", () => {
  it("aggregates the last 7 days only", () => {
    const runs = [
      run({ costUsd: 1.5 }),
      run({ status: "error", costUsd: 0.5 }),
      run({ startedAt: daysAgo(9), costUsd: 100 }),
    ];
    expect(agentWeekStats(runs, "kodér", NOW)).toEqual({ runs: 2, successRate: 50, cost: 2 });
  });
  it("has no success rate without finished runs", () => {
    expect(agentWeekStats([], "kodér", NOW).successRate).toBeNull();
  });
});

describe("tools and search", () => {
  it("dedupes glyphs", () => {
    expect(toolGlyphs(["Read", "Glob", "Grep", "Bash"])).toEqual(["file", "search", "terminal"]);
  });
  it("matches by name or tool", () => {
    const a = { id: "kodér", name: "Kodér", tools: ["Bash"] } as Agent;
    expect(agentMatches(a, "bas")).toBe(true);
    expect(agentMatches(a, "zzz")).toBe(false);
  });
});
