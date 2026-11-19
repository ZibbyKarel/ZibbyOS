import type { ProjectBudget, ProjectBudgetStatus, TaskRun, TaskRunStatus } from "@zibby/contracts";
import { formatCostUsd } from "../../utils/cost";

/** Run states that block on the operator (approval / park / pause / held over budget). */
export const NEEDS_YOU_STATUSES: readonly TaskRunStatus[] = [
  "awaiting-approval",
  "parked",
  "paused",
  "held",
];

export interface ProjectLiveCounts {
  running: number;
  needsYou: number;
}

/** Per-project live counts from the unified runs feed (running now / waiting on the operator). */
export function countLiveByProject(runs: readonly TaskRun[]): Map<string, ProjectLiveCounts> {
  const out = new Map<string, ProjectLiveCounts>();
  for (const r of runs) {
    if (!r.projectId) continue;
    const isRunning = r.status === "running";
    const needsYou = NEEDS_YOU_STATUSES.includes(r.status);
    if (!isRunning && !needsYou) continue;
    const c = out.get(r.projectId) ?? { running: 0, needsYou: 0 };
    if (isRunning) c.running += 1;
    if (needsYou) c.needsYou += 1;
    out.set(r.projectId, c);
  }
  return out;
}

export type BudgetWindowId = "day" | "week" | "month";

export interface BudgetWindowBar {
  id: BudgetWindowId;
  /** Used percentage of the tightest known cap (dollar cap wins over run-count cap). */
  pct: number;
  /** Exact numbers for the tooltip, e.g. "1/2 · $1.50 / $5.00". */
  detail: string;
}

/**
 * The day/week/month usage bars of the design, derived from the existing budget readout:
 * a window shows when it has a dollar cap or a run-count cap; the percentage follows the
 * dollar cap when set, else the run-count cap.
 */
export function budgetWindowBars(
  status: ProjectBudgetStatus | undefined,
  budget: ProjectBudget | undefined,
): BudgetWindowBar[] {
  if (!status || !budget) return [];
  const windows: [
    BudgetWindowId,
    ProjectBudgetStatus["daily"] | undefined,
    ProjectBudgetStatus["dailyCost"],
  ][] = [
    ["day", status.daily, status.dailyCost],
    ["week", status.weekly, status.weeklyCost],
    ["month", status.monthly, status.monthlyCost],
  ];
  const bars: BudgetWindowBar[] = [];
  for (const [id, runs, cost] of windows) {
    const parts: string[] = [];
    let pct: number | undefined;
    if (runs?.cap) {
      parts.push(`${runs.used}/${runs.cap}`);
      pct = (runs.used / runs.cap) * 100;
    }
    if (cost?.capUsd) {
      parts.push(`${formatCostUsd(cost.spentUsd)} / ${formatCostUsd(cost.capUsd)}`);
      pct = (cost.spentUsd / cost.capUsd) * 100;
    }
    if (pct !== undefined) bars.push({ id, pct, detail: parts.join(" · ") });
  }
  return bars;
}

/** True when any capped window is at or over its cap. */
export function isOverBudget(
  status: ProjectBudgetStatus | undefined,
  budget: ProjectBudget | undefined,
): boolean {
  return budgetWindowBars(status, budget).some((b) => b.pct >= 100);
}
