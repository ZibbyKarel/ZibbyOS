import type { RunView } from "../runs/run";

const DAY_MS = 86_400_000;
export const STATS_WINDOW_DAYS = 30;
const BUCKETS = 10;

export interface AgentRunSeries {
  runs: number[];
  successRate: number[];
  avgCost: number[];
  avgDurationMs: number[];
  spend: number[];
}

export interface AgentRunStats {
  runs: number;
  /** 0–100, `null` while no run in the window has finished. */
  successRate: number | null;
  avgCost: number | null;
  avgDurationMs: number | null;
  spend: number;
  series: AgentRunSeries;
  /** Newest first, every run of this agent in the feed (not just the window). */
  recent: RunView[];
}

/** An agent's own run: the unified feed row routed to this agent id. */
export function isRunOfAgent(run: RunView, agentId: string): boolean {
  return run.kind === "agent" && (run.owner === agentId || run.processor?.id === agentId);
}

const isFinished = (r: RunView) => r.status === "done" || r.status === "error";
const isSuccess = (r: RunView) => r.status === "done" && r.taskOutcome !== "error";

/** Wall-clock duration when the feed carries an end time, else `null`. */
export function runDurationMs(run: RunView): number | null {
  if (!run.taskOutcomeFinishedAt) return null;
  const ms = Date.parse(run.taskOutcomeFinishedAt) - Date.parse(run.startedAt);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/**
 * Client-side aggregation of the runs feed for one agent (cut line B-AG-13): totals over
 * the last 30 days plus a 10-bucket series per metric (3 days each, oldest first).
 * The feed is the live window only — archived runs are not included.
 */
export function aggregateAgentRuns(
  runs: readonly RunView[],
  agentId: string,
  now: number = Date.now(),
): AgentRunStats {
  const mine = runs
    .filter((r) => isRunOfAgent(r, agentId))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const from = now - STATS_WINDOW_DAYS * DAY_MS;
  const inWindow = mine.filter((r) => Date.parse(r.startedAt) >= from);

  const stats = (rs: RunView[]) => {
    const done = rs.filter(isFinished);
    const costs = rs.flatMap((r) => (r.costUsd !== undefined ? [r.costUsd] : []));
    return {
      successRate: done.length ? (done.filter(isSuccess).length / done.length) * 100 : null,
      avgCost: mean(costs),
      avgDurationMs: mean(rs.flatMap((r) => runDurationMs(r) ?? [])),
      spend: costs.reduce((a, b) => a + b, 0),
    };
  };

  const span = (STATS_WINDOW_DAYS * DAY_MS) / BUCKETS;
  const buckets: RunView[][] = Array.from({ length: BUCKETS }, () => []);
  for (const r of inWindow) {
    const i = Math.min(BUCKETS - 1, Math.floor((Date.parse(r.startedAt) - from) / span));
    buckets[Math.max(0, i)]?.push(r);
  }
  const per = buckets.map(stats);

  return {
    runs: inWindow.length,
    ...stats(inWindow),
    series: {
      runs: buckets.map((b) => b.length),
      successRate: per.map((s) => s.successRate ?? 0),
      avgCost: per.map((s) => s.avgCost ?? 0),
      avgDurationMs: per.map((s) => s.avgDurationMs ?? 0),
      spend: per.map((s) => s.spend),
    },
    recent: mine,
  };
}

/** "1m 54s" style duration; `—` when unknown. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export const formatUsd = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `$${v < 10 ? v.toFixed(2) : v.toFixed(1)}`;
