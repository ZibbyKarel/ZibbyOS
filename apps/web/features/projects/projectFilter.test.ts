import { describe, expect, it } from "vitest";
import type { Project, ProjectBudgetStatus } from "@zibby/contracts";
import { matchesChip, matchesSearch } from "./projectFilter";

const p = {
  id: "a",
  name: "ZibbyOS",
  path: "~/code/zibby/os",
  budget: { dailyRuns: 2 },
} as Project;
const ctx = {
  live: new Map([["a", { running: 2, needsYou: 0 }]]),
  budget: new Map([
    [
      "a",
      { projectId: "a", daily: { used: 3, cap: 2 }, weekly: { used: 0 } } as ProjectBudgetStatus,
    ],
  ]),
};

describe("project filters", () => {
  it("matches chips from live counts and budget", () => {
    expect(matchesChip(p, "all", ctx)).toBe(true);
    expect(matchesChip(p, "running", ctx)).toBe(true);
    expect(matchesChip(p, "needsYou", ctx)).toBe(false);
    expect(matchesChip(p, "overBudget", ctx)).toBe(true);
  });
  it("searches name and path", () => {
    expect(matchesSearch(p, "zibby/os")).toBe(true);
    expect(matchesSearch(p, "nope")).toBe(false);
  });
});
