import type { Goal, GoalIteration, TaskRun, TaskRunStatus } from "@zibby/contracts";
import type { StateTone } from "@zibby/design-system";

/**
 * A goal (loop definition) has no state of its own — the state shown in
 * the detail header is its latest run's `TaskRunStatus`, or
 * `idle` when the goal has never run. A goal run's status is drawn from the
 * shared `RunStatus` set plus `parked`/`paused-limit` (never `scheduled`/`held`/
 * `queued`/`pending`/`awaiting-approval`, which don't apply to a goal). Maps onto
 * the canonical {@link StateTone} vocabulary (DS.md §2.2) the same way
 * `runStateTone` narrows the legacy tone set.
 */
export function goalStateTone(status: TaskRunStatus | undefined): StateTone {
  switch (status) {
    case "running":
      return "working";
    case "paused-limit":
      return "thinking";
    case "parked":
      return "blocked";
    case "error":
      return "error";
    case "done":
      return "done";
    case "interrupted":
    case undefined:
    default:
      return "idle";
  }
}

/**
 * The one-line summary of a goal run's latest iteration — the mock's `{{ g.iter }}`
 * line, e.g. `"Iteration 3 · verifier failed"`. `undefined` when there is no
 * iteration yet (a run that hasn't started its first maker pass).
 */
export function latestIterationSummary(iterations: readonly GoalIteration[]): string | undefined {
  const last = iterations[iterations.length - 1];
  if (!last) return undefined;
  const outcome =
    last.status === "running" ? "running" : last.verifier.satisfied ? "passed" : "failed";
  return `Iteration ${last.index + 1} · verifier ${outcome}`;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
export const DAY_MS = 24 * HOUR;

/** Every run of one goal, newest first. */
export function goalRunsFor(goalId: string, runs: readonly TaskRun[]): TaskRun[] {
  return runs
    .filter((r) => r.kind === "goal" && r.goalId === goalId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** The run the detail opens on: a live (running/parked) one, else the newest. */
export function defaultGoalRun(runsNewestFirst: readonly TaskRun[]): TaskRun | undefined {
  return (
    runsNewestFirst.find((r) => r.status === "running" || r.status === "parked") ??
    runsNewestFirst[0]
  );
}

/** "3m 12s" / "45s" / "1h 5m" — a span in ms. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / SECOND));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Wall-clock span of one iteration; an unfinished one runs until `nowMs`. */
export function iterationDurationMs(it: GoalIteration, nowMs: number): number {
  const end = it.endedAt ? new Date(it.endedAt).getTime() : nowMs;
  return Math.max(0, end - new Date(it.startedAt).getTime());
}

/** Header totals of a run: iteration count, summed duration, run cost when the run carries one. */
export function runTotals(run: TaskRun, nowMs: number) {
  const iterations = run.iterations ?? [];
  return {
    count: iterations.length,
    durationMs: iterations.reduce((sum, it) => sum + iterationDurationMs(it, nowMs), 0),
    costUsd: run.costUsd,
  };
}

/** Iterations (across all runs) started within the last `windowMs` — the run-count budget windows. */
export function iterationsSince(runs: readonly TaskRun[], nowMs: number, windowMs: number): number {
  return runs.reduce(
    (sum, r) =>
      sum +
      (r.iterations ?? []).filter((it) => nowMs - new Date(it.startedAt).getTime() < windowMs)
        .length,
    0,
  );
}

/**
 * Spend of the runs started in the same calendar month as `nowMs` (client time) —
 * `undefined` when none of them reports a cost, so the UI omits the meter instead of showing $0.
 */
export function monthSpendUsd(runs: readonly TaskRun[], nowMs: number): number | undefined {
  const now = new Date(nowMs);
  const costs = runs
    .filter((r) => {
      const d = new Date(r.startedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .map((r) => r.costUsd)
    .filter((c): c is number => c !== undefined);
  return costs.length === 0 ? undefined : costs.reduce((a, b) => a + b, 0);
}

/** `n / cap` as a 0–100 percentage; 0 when there is no cap. */
export function percentOf(n: number, cap: number | undefined): number {
  return cap && cap > 0 ? Math.min(100, (n / cap) * 100) : 0;
}

/** Which loop arrow is live: the maker is working (`forward`) or the verifier is judging (`back`). */
export function activeLoopArrow(run: TaskRun | undefined): "forward" | "back" | null {
  if (run?.status !== "running") return null;
  const current = (run.iterations ?? []).find((it) => it.status === "running");
  return current?.verifier.runRef ? "back" : "forward";
}

/** First non-empty line of a verdict, shortened for a one-line timeline row. */
export function verdictLine(output: string, max = 140): string {
  const line = output.split("\n").find((l) => l.trim().length > 0) ?? "";
  const trimmed = line.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** Fresh id for a goal created from the form (same scheme as the Loop dialog). */
export { makeGoalId } from "../tasks/loop";

/** `POST /api/tasks` body that runs a stored goal — the only way a goal run starts. */
export function goalRunTaskBody(goal: Pick<Goal, "id" | "name" | "objective">) {
  return {
    title: goal.name,
    text: goal.objective,
    scheduledAt: null,
    target: { kind: "goal" as const, id: goal.id, name: goal.name ?? goal.objective.slice(0, 80) },
  };
}

/**
 * Average cost of one iteration over every past run of goals driven by `makerId` —
 * `undefined` unless some of those runs report a cost and have iterations (no invented numbers).
 */
export function avgCostPerIteration(
  runs: readonly TaskRun[],
  goals: readonly Goal[],
  makerId: string,
): number | undefined {
  const ids = new Set(goals.filter((g) => g.maker.id === makerId).map((g) => g.id));
  let cost = 0;
  let iterations = 0;
  for (const r of runs) {
    if (r.kind !== "goal" || !r.goalId || !ids.has(r.goalId) || r.costUsd === undefined) continue;
    const n = r.iterations?.length ?? 0;
    if (n === 0) continue;
    cost += r.costUsd;
    iterations += n;
  }
  return iterations === 0 ? undefined : cost / iterations;
}
