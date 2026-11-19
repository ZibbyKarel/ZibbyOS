import type { BudgetStatus, Company } from "@zibby/contracts";

export type CapWindow = "daily" | "weekly" | "monthly";

export interface CapRow {
  window: CapWindow;
  runsUsed: number;
  runsCap?: number;
  spendUsed: number;
  spendCap?: number;
}

export interface CompanyUsage {
  rows: CapRow[];
  /** Month-to-date spend over the monthly dollar cap, 0-100; null without a monthly dollar cap. */
  monthlyPct: number | null;
  monthlySpend: number;
}

const WINDOWS: CapWindow[] = ["daily", "weekly", "monthly"];

/**
 * Client sum of the per-project budget status for the company's projects, set against the
 * company's own caps (no company-level usage endpoint exists).
 */
export function companyUsage(
  budget: Company["budget"],
  status: BudgetStatus | undefined,
  projectIds: ReadonlySet<string>,
): CompanyUsage {
  const mine = (status?.projects ?? []).filter((p) => projectIds.has(p.projectId));
  const rows = WINDOWS.map((window): CapRow => {
    const cost = `${window}Cost` as const;
    return {
      window,
      runsUsed: mine.reduce((n, p) => n + (p[window]?.used ?? 0), 0),
      runsCap: budget?.[`${window}Runs`],
      spendUsed: mine.reduce((n, p) => n + (p[cost]?.spentUsd ?? 0), 0),
      spendCap: budget?.[`${window}CostCapUsd`],
    };
  });
  const month = rows[2] as CapRow;
  return {
    rows,
    monthlySpend: month.spendUsed,
    monthlyPct: month.spendCap
      ? Math.min(100, Math.round((month.spendUsed / month.spendCap) * 100))
      : null,
  };
}

export function pctOf(used: number, cap?: number): number | undefined {
  return cap ? Math.min(100, Math.round((used / cap) * 100)) : undefined;
}
