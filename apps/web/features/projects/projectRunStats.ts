import type { RunView } from "../runs/run";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface ProjectRunStats {
  /** Runs started in the last 30 days. */
  runs30d: number;
  /** Finished-ok share of finished runs in the last 30 days, 0-100; null with nothing finished. */
  successPct: number | null;
  /** Runs started per hour over the last 24 h, oldest first (24 buckets). */
  pulse24h: number[];
  /** Runs started in the last 24 h. */
  runs24h: number;
  running: number;
  /** Runs per day over the last 14 days, oldest first. */
  trend14d: number[];
}

/** Client-side aggregation of the unified runs feed for one project (no new endpoint). */
export function projectRunStats(
  runs: readonly RunView[],
  projectId: string,
  now: number,
): ProjectRunStats {
  const mine = runs.filter((r) => r.projectId === projectId);
  const age = (r: RunView) => now - Date.parse(r.startedAt);
  const in30 = mine.filter((r) => age(r) >= 0 && age(r) < 30 * DAY_MS);
  const finished = in30.filter((r) => r.status === "done" || r.status === "error");
  const pulse24h = Array.from({ length: 24 }, () => 0);
  const trend14d = Array.from({ length: 14 }, () => 0);
  for (const r of mine) {
    const a = age(r);
    if (a >= 0 && a < 24 * HOUR_MS) pulse24h[23 - Math.floor(a / HOUR_MS)]! += 1;
    if (a >= 0 && a < 14 * DAY_MS) trend14d[13 - Math.floor(a / DAY_MS)]! += 1;
  }
  return {
    runs30d: in30.length,
    successPct: finished.length
      ? Math.round((finished.filter((r) => r.status === "done").length / finished.length) * 100)
      : null,
    pulse24h,
    runs24h: pulse24h.reduce((a, b) => a + b, 0),
    running: mine.filter((r) => r.status === "running").length,
    trend14d,
  };
}
