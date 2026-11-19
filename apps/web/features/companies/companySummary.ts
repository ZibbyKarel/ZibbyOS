import type { BudgetStatus, Company, Project, Team } from "@zibby/contracts";

export interface CompanyTeamRow {
  id: string;
  name: string;
  projectCount: number;
}

export interface CompanyGauge {
  pct: number;
  spentUsd: number;
  capUsd: number;
}

export interface CompanySummary {
  teams: CompanyTeamRow[];
  projectCount: number;
  /** Today's spend vs the company's default daily dollar cap; absent when no cap or no budget data. */
  gauge?: CompanyGauge;
}

/**
 * Card data for one company, composed client-side from the existing team/project/budget
 * queries: its teams with their project counts, and the gauge = sum of its projects'
 * today-spend over the default daily dollar cap (only when both exist).
 */
export function summarizeCompany(
  company: Company,
  teams: readonly Team[],
  projects: readonly Project[],
  budget: BudgetStatus | undefined,
): CompanySummary {
  const mine = projects.filter((p) => p.companyId === company.id);
  const rows = teams
    .filter((t) => t.companyId === company.id)
    .map((t) => ({
      id: t.id,
      name: t.name,
      projectCount: mine.filter((p) => p.teamId === t.id).length,
    }));
  const capUsd = company.budget?.dailyCostCapUsd;
  let gauge: CompanyGauge | undefined;
  if (capUsd && budget) {
    const byId = new Map(budget.projects.map((b) => [b.projectId, b]));
    const spentUsd = mine.reduce((sum, p) => sum + (byId.get(p.id)?.dailyCost?.spentUsd ?? 0), 0);
    gauge = { pct: (spentUsd / capUsd) * 100, spentUsd, capUsd };
  }
  return { teams: rows, projectCount: mine.length, gauge };
}
