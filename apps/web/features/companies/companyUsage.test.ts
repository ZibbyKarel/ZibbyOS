import { describe, expect, it } from "vitest";
import type { BudgetStatus } from "@zibby/contracts";
import { companyUsage } from "./companyUsage";

const status = {
  global: {},
  projects: [
    {
      projectId: "a",
      name: "a",
      daily: { used: 2 },
      weekly: { used: 5 },
      monthly: { used: 9 },
      monthlyCost: { spentUsd: 40 },
    },
    {
      projectId: "b",
      name: "b",
      daily: { used: 1 },
      weekly: { used: 1 },
      monthly: { used: 1 },
      monthlyCost: { spentUsd: 10 },
    },
    { projectId: "x", name: "x", daily: { used: 99 }, weekly: { used: 99 } },
  ],
} as unknown as BudgetStatus;

describe("companyUsage", () => {
  it("sums only the company's projects and derives the monthly dollar share", () => {
    const u = companyUsage({ monthlyCostCapUsd: 100, dailyRuns: 10 }, status, new Set(["a", "b"]));
    expect(u.rows[0]).toMatchObject({ runsUsed: 3, runsCap: 10 });
    expect(u.rows[2]).toMatchObject({ runsUsed: 10, spendUsed: 50, spendCap: 100 });
    expect(u.monthlyPct).toBe(50);
  });
  it("has no percentage without a monthly dollar cap", () => {
    expect(companyUsage(undefined, status, new Set(["a"])).monthlyPct).toBeNull();
  });
});
