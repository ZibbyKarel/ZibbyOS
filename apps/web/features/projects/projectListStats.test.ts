import { describe, expect, it } from "vitest";
import type { ProjectBudgetStatus, TaskRun } from "@zibby/contracts";
import { budgetWindowBars, countLiveByProject, isOverBudget } from "./projectListStats";

const run = (projectId: string | undefined, status: string) =>
  ({ projectId, status }) as unknown as TaskRun;

const status = (over: Partial<ProjectBudgetStatus> = {}) =>
  ({
    projectId: "a",
    name: "A",
    daily: { used: 1, cap: 2 },
    weekly: { used: 1 },
    running: 0,
    queued: 0,
    held: 0,
    ...over,
  }) as ProjectBudgetStatus;

describe("countLiveByProject", () => {
  it("counts running and operator-blocked runs per project", () => {
    const m = countLiveByProject([
      run("a", "running"),
      run("a", "parked"),
      run("a", "awaiting-approval"),
      run("b", "done"),
      run(undefined, "running"),
    ]);
    expect(m.get("a")).toEqual({ running: 1, needsYou: 2 });
    expect(m.get("b")).toBeUndefined();
  });
});

describe("budgetWindowBars", () => {
  it("is empty without a budget or status", () => {
    expect(budgetWindowBars(undefined, {})).toEqual([]);
    expect(budgetWindowBars(status(), undefined)).toEqual([]);
  });
  it("uses the run cap, preferring the dollar cap when both exist", () => {
    const bars = budgetWindowBars(status({ dailyCost: { spentUsd: 1.5, capUsd: 5 } }), {
      dailyRuns: 2,
    });
    expect(bars).toHaveLength(1);
    expect(bars[0]?.pct).toBeCloseTo(30);
    expect(bars[0]?.detail).toBe("1/2 · $1.50 / $5.00");
  });
  it("flags over-budget windows", () => {
    expect(isOverBudget(status({ daily: { used: 3, cap: 2 } }), { dailyRuns: 2 })).toBe(true);
    expect(isOverBudget(status(), { dailyRuns: 2 })).toBe(false);
  });
});
