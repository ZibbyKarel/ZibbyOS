import { describe, expect, it } from "vitest";
import type { BudgetStatus, Company, Project, Team } from "@zibby/contracts";
import { summarizeCompany } from "./companySummary";

const company = { id: "acme", name: "Acme", budget: { dailyCostCapUsd: 40 } } as Company;
const teams = [
  { id: "t1", name: "Platforma", companyId: "acme" },
  { id: "t2", name: "Jiný", companyId: "other" },
] as Team[];
const projects = [
  { id: "p1", companyId: "acme", teamId: "t1" },
  { id: "p2", companyId: "acme" },
  { id: "p3", companyId: "other" },
] as Project[];
const budget = {
  projects: [
    { projectId: "p1", dailyCost: { spentUsd: 6 } },
    { projectId: "p2", dailyCost: { spentUsd: 6.4 } },
    { projectId: "p3", dailyCost: { spentUsd: 99 } },
  ],
} as BudgetStatus;

describe("summarizeCompany", () => {
  it("groups teams and counts projects", () => {
    const s = summarizeCompany(company, teams, projects, budget);
    expect(s.teams).toEqual([{ id: "t1", name: "Platforma", projectCount: 1 }]);
    expect(s.projectCount).toBe(2);
  });
  it("sums today's spend over the daily cap", () => {
    const g = summarizeCompany(company, teams, projects, budget).gauge;
    expect(g?.spentUsd).toBeCloseTo(12.4);
    expect(g?.pct).toBeCloseTo(31);
  });
  it("omits the gauge without a cap or budget data", () => {
    expect(
      summarizeCompany({ ...company, budget: undefined }, teams, projects, budget).gauge,
    ).toBeUndefined();
    expect(summarizeCompany(company, teams, projects, undefined).gauge).toBeUndefined();
  });
});
