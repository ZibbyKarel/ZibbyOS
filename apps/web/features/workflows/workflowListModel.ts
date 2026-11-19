import type { Agent } from "@zibby/contracts";
import type { Workflow, WorkflowOutput, WorkflowPhase } from "../../domain";
import type { RunView } from "../runs/run";

export type PipelineNodeState = "idle" | "done" | "active";

/** The workflow's newest run in the unified feed (workflow-kind rows owned by it). */
export function latestWorkflowRun(runs: readonly RunView[], workflowId: string): RunView | null {
  return (
    runs
      .filter((r) => r.kind === "workflow" && r.owner === workflowId)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] ?? null
  );
}

/**
 * Per-phase pipeline states from a run: only a *running* run lights the pipeline
 * (finished stages `done`, the current stage `active`); any other run leaves it idle.
 */
export function pipelineStates(
  phases: readonly WorkflowPhase[],
  run: RunView | null,
): PipelineNodeState[] {
  if (!run || run.status !== "running") return phases.map(() => "idle");
  return phases.map((p, i) => {
    const id = p.id ?? String(i);
    if (run.currentStage === id) return "active";
    const stage = run.stageRuns?.filter((s) => s.phaseId === id).at(-1);
    return stage?.status === "done" ? "done" : "idle";
  });
}

/** 1-based position of the running stage ("phase 2 of 4"), or `null` when none is running. */
export function activePhaseNumber(
  phases: readonly WorkflowPhase[],
  run: RunView | null,
): number | null {
  const i = pipelineStates(phases, run).indexOf("active");
  return i < 0 ? null : i + 1;
}

/** Duration of a finished run, `null` while it runs or when the feed has no end time. */
export function runMinutes(run: RunView): number | null {
  if (!run.taskOutcomeFinishedAt) return null;
  const ms = Date.parse(run.taskOutcomeFinishedAt) - Date.parse(run.startedAt);
  return Number.isFinite(ms) && ms >= 0 ? Math.max(1, Math.round(ms / 60_000)) : null;
}

/** The agent a phase names (by id, falling back to the legacy display name). */
export function phaseAgent(phase: WorkflowPhase, agents: readonly Agent[]): Agent | undefined {
  return phase.agent
    ? agents.find((a) => a.id === phase.agent || a.name === phase.agent)
    : undefined;
}

/** Display label of a delivery sink for the pipeline's final pill. */
export function outputLabel(out: WorkflowOutput): { kind: "pr" | "file" | "folder"; to?: string } {
  return out.type === "pr" ? { kind: "pr" } : { kind: out.type, to: out.to };
}

/** Case-insensitive match on the workflow name or any phase agent. */
export function workflowMatches(
  workflow: Workflow,
  query: string,
  agents: readonly Agent[],
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    workflow.name,
    workflow.id,
    ...workflow.phases.flatMap((p) => {
      const a = phaseAgent(p, agents);
      return [p.agent, a?.displayName, a?.name];
    }),
  ];
  return hay.some((h) => h?.toLowerCase().includes(q));
}
