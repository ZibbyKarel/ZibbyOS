/** The slice of a workflow this feature reads (structural, so query and contract shapes both fit). */
export interface WorkflowLike {
  id: string;
  name?: string | undefined;
  phases: ReadonlyArray<{ id?: string | undefined; agent?: string | undefined }>;
}

/** A workflow phase "belongs" to an agent by id; the display name is the legacy fallback. */
export function phaseUsesAgent(
  phase: { agent?: string | undefined },
  agent: { id: string; name?: string | undefined },
): boolean {
  return phase.agent !== undefined && (phase.agent === agent.id || phase.agent === agent.name);
}

export interface WorkflowUse {
  workflow: WorkflowLike;
  /** Zero-based indexes of the phases this agent runs. */
  phaseIndexes: number[];
}

/** The workflows that run the agent, with the phase indexes it owns (cut line B-AG-12). */
export function workflowsUsingAgent(
  workflows: readonly WorkflowLike[],
  agent: { id: string; name?: string | undefined },
): WorkflowUse[] {
  return workflows.flatMap((workflow) => {
    const phaseIndexes = workflow.phases.flatMap((p, i) => (phaseUsesAgent(p, agent) ? [i] : []));
    return phaseIndexes.length ? [{ workflow, phaseIndexes }] : [];
  });
}
