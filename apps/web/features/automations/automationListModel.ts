import type { Automation, AutomationFire } from "@zibby/contracts";
import { nextCronRun } from "./schedule";

const DAY_MS = 86_400_000;
export const FIRE_WINDOW_DAYS = 7;

/** Where "now" sits between the last and the next run, 0-100 (the mini timeline's tick). */
export function timelinePosition(
  lastMs: number | null,
  nextMs: number | null,
  nowMs: number,
): number | undefined {
  if (lastMs === null || nextMs === null || nextMs <= lastMs) return undefined;
  return Math.min(100, Math.max(0, ((nowMs - lastMs) / (nextMs - lastMs)) * 100));
}

/** Fire dots over the last 7 days as 0-100 positions (oldest left); older fires are dropped. */
export function fireDots(
  fires: readonly Pick<AutomationFire, "startedAt">[],
  nowMs: number,
): number[] {
  const from = nowMs - FIRE_WINDOW_DAYS * DAY_MS;
  return fires
    .map((f) => Date.parse(f.startedAt))
    .filter((t) => t >= from && t <= nowMs)
    .map((t) => ((t - from) / (nowMs - from)) * 100)
    .sort((a, b) => a - b);
}

/** Next scheduled fire of an enabled cron automation, else `null`. */
export function nextRunMs(a: Automation, now: Date): number | null {
  if (!a.enabled || a.trigger.type !== "cron") return null;
  return nextCronRun(a.trigger.expr, now)?.getTime() ?? null;
}

export type AutomationFilter = "all" | "on" | "off";

/** Chip + search filter over name, description and id. */
export function automationMatches(a: Automation, filter: AutomationFilter, query: string): boolean {
  if (filter === "on" && !a.enabled) return false;
  if (filter === "off" && a.enabled) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [a.name, a.description, a.id].some((h) => h?.toLowerCase().includes(q));
}
