import type { StateTone } from "@zibby/design-system";
import type { RunView } from "./run";

/** `runId` of the synthesized live row (the running attempt is not in `stageRuns` yet). */
export const LIVE_STAGE_RUN_ID = "";

export type StageRunEntry = NonNullable<RunView["stageRuns"]>[number];

/**
 * One node of the vertical timeline: a workflow PHASE (not a single attempt). `main`
 * is the phase's latest recorded (or live) attempt; `priorAttempts` are earlier
 * attempts of the same phase from a loop back-edge (Phase 45's qualify retries, or a
 * plain phase re-run) — folded into a nested retry block instead of their own node,
 * mirroring the design. `main` is `null` for a not-yet-reached phase, synthesized
 * from the workflow definition only while the run is still open (see
 * {@link buildPhaseNodes}).
 */
export interface PhaseNode {
  phaseId: string;
  main: StageRunEntry | null;
  priorAttempts: StageRunEntry[];
}

/**
 * Groups `stageRuns` by `phaseId` — the runner records one entry per (phase, attempt),
 * so a phase retried by a loop back-edge (or re-qualified) has several entries under the
 * same id. Entries stay in recorded (execution) order — a loop resets `attempt`, so it is
 * not a sort key. Each group's last entry is the phase's current node; earlier entries
 * become its nested retry rows. When the workflow DEFINITION is known, phases are laid out in
 * its declared order and any not-yet-reached phase (after the furthest one with a
 * recorded attempt) gets a placeholder ("waiting") node — but only while the run hasn't
 * finished (`currentStage` still set; the backend nulls it once done/errored/interrupted,
 * even while parked or paused-limit). Without a definition (still loading, or an unknown
 * owner) this degrades to plain chronological order with no placeholders.
 */
export function buildPhaseNodes(
  stageRuns: RunView["stageRuns"],
  currentStage: string | null | undefined,
  live: boolean,
  definedPhaseIds: string[] | undefined,
): PhaseNode[] {
  const terminalStages = stageRuns ?? [];
  // The phase executing right now isn't in `stageRuns` yet (that append is
  // terminal-only) — synthesize a live row for it, one attempt past whatever
  // terminal attempts are already recorded for that phase.
  const liveRow: StageRunEntry | null =
    live && currentStage
      ? {
          phaseId: currentStage,
          runId: LIVE_STAGE_RUN_ID,
          attempt: terminalStages.filter((s) => s.phaseId === currentStage).length + 1,
          status: "running",
        }
      : null;
  const allRuns = liveRow ? [...terminalStages, liveRow] : terminalStages;

  const order: string[] = [];
  const groups = new Map<string, StageRunEntry[]>();
  for (const r of allRuns) {
    if (!groups.has(r.phaseId)) {
      groups.set(r.phaseId, []);
      order.push(r.phaseId);
    }
    groups.get(r.phaseId)?.push(r);
  }

  if (!definedPhaseIds || definedPhaseIds.length === 0) {
    return order.map((phaseId) => {
      const g = groups.get(phaseId) ?? [];
      return { phaseId, main: g[g.length - 1] ?? null, priorAttempts: g.slice(0, -1) };
    });
  }

  let lastReachedIdx = -1;
  definedPhaseIds.forEach((id, i) => {
    if (groups.has(id)) lastReachedIdx = i;
  });

  const nodes: PhaseNode[] = [];
  definedPhaseIds.forEach((id, i) => {
    const g = groups.get(id);
    if (g) {
      nodes.push({ phaseId: id, main: g[g.length - 1] ?? null, priorAttempts: g.slice(0, -1) });
    } else if (i > lastReachedIdx && currentStage != null) {
      nodes.push({ phaseId: id, main: null, priorAttempts: [] });
    }
  });
  return nodes;
}

export type PendingBranches = NonNullable<RunView["pendingBranches"]>;
export type BranchStatus = NonNullable<PendingBranches["branches"][number]["status"]> | "queued";

/** One branch of a `parallel` phase, as the run detail shows it (indented under its stage). */
export interface BranchRow {
  id: string;
  workflow: string;
  childRunId?: string;
  /** A joined branch's terminal state; live ones read `running` (child spawned) or `queued`. */
  status: BranchStatus;
  costUsd?: number;
}

/**
 * The branches of a `parallel` phase: live from `pendingBranches` while the parent waits on
 * the fan-out, from the joined StageRun's `branches` afterwards; empty for any other phase.
 */
export function phaseBranches(
  stageRuns: RunView["stageRuns"],
  pendingBranches: PendingBranches | undefined,
  phaseId: string,
): BranchRow[] {
  if (pendingBranches?.phaseId === phaseId) {
    return pendingBranches.branches.map((b) => ({
      id: b.id,
      workflow: b.workflow,
      ...(b.childRunId ? { childRunId: b.childRunId } : {}),
      status: b.status ?? (b.childRunId ? "running" : "queued"),
      ...(b.costUsd != null ? { costUsd: b.costUsd } : {}),
    }));
  }
  const joined = (stageRuns ?? []).filter((s) => s.phaseId === phaseId && s.branches).at(-1);
  return (joined?.branches ?? []).map((b) => ({
    id: b.id,
    workflow: b.workflow,
    ...(b.childRunId ? { childRunId: b.childRunId } : {}),
    status: b.status,
    ...(b.costUsd != null ? { costUsd: b.costUsd } : {}),
  }));
}

export const BRANCH_TONE: Record<BranchRow["status"], StateTone> = {
  done: "done",
  running: "working",
  parked: "blocked",
  failed: "error",
  skipped: "idle",
  interrupted: "idle",
  "paused-limit": "idle",
  queued: "idle",
};
