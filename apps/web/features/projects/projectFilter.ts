import type { Project, ProjectBudgetStatus } from "@zibby/contracts";
import { isOverBudget } from "./projectListStats";
import type { ProjectLiveCounts } from "./projectListStats";

export type ProjectChip = "all" | "running" | "needsYou" | "overBudget";

export interface ProjectFilterContext {
  live: ReadonlyMap<string, ProjectLiveCounts>;
  budget: ReadonlyMap<string, ProjectBudgetStatus>;
}

/** Whether a project passes a filter chip, derived only from the live runs feed and budget readout. */
export function matchesChip(p: Project, chip: ProjectChip, ctx: ProjectFilterContext): boolean {
  switch (chip) {
    case "all":
      return true;
    case "running":
      return (ctx.live.get(p.id)?.running ?? 0) > 0;
    case "needsYou":
      return (ctx.live.get(p.id)?.needsYou ?? 0) > 0;
    case "overBudget":
      return isOverBudget(ctx.budget.get(p.id), p.budget);
  }
}

/** Whether a project matches the search text (name, path, category). */
export function matchesSearch(p: Project, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [p.name, p.path, p.category].some((v) => v?.toLowerCase().includes(q));
}
