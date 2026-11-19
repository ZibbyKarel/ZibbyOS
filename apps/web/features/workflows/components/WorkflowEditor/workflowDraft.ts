/**
 * The workflow-level fields the page edits next to the graph, and the PATCH they compile to.
 * `UpdateWorkflowSchema` is a partial that can't express "unset" (JSON drops `undefined`), so a
 * cleared optional field (budget, project, advisor) is simply not sent — see the inspector hint.
 */
import type {
  PhaseAdvisor,
  UpdateWorkflowInput,
  WorkflowComplexity,
  WorkflowOutput,
} from "@zibby/contracts";
import type { Workflow } from "../../../../domain";

export interface WorkflowDraft {
  name: string;
  desc: string;
  department: string;
  complexity: WorkflowComplexity;
  /** `null` = no spend cap. */
  maxCostUsd: number | null;
  warnAtPct: number;
  project: string;
  requiresWeb: boolean;
  advisor: PhaseAdvisor | undefined;
  instructions: string;
  outputs: WorkflowOutput[];
}

export const draftFromWorkflow = (w: Workflow): WorkflowDraft => ({
  name: w.name,
  desc: w.desc,
  department: w.department ?? "",
  complexity: w.complexity ?? "standard",
  maxCostUsd: w.budget?.maxCostUsd ?? null,
  warnAtPct: w.budget?.warnAtPct ?? 70,
  project: w.project ?? "",
  requiresWeb: w.requires?.includes("web") ?? false,
  advisor: w.advisor,
  instructions: w.instructions ?? "",
  outputs: w.outputs,
});

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only the fields that differ from `initial` — storage merges the partial. */
export function draftPatch(initial: Workflow, draft: WorkflowDraft): UpdateWorkflowInput {
  const before = draftFromWorkflow(initial);
  const patch: UpdateWorkflowInput = {};
  if (draft.name.trim() !== before.name) patch.name = draft.name.trim();
  if (draft.desc.trim() !== before.desc) patch.desc = draft.desc.trim();
  if (draft.department && draft.department !== before.department)
    patch.department = draft.department;
  if (draft.complexity !== before.complexity) patch.complexity = draft.complexity;
  if (
    draft.maxCostUsd !== null &&
    (draft.maxCostUsd !== before.maxCostUsd || draft.warnAtPct !== before.warnAtPct)
  ) {
    patch.budget = { maxCostUsd: draft.maxCostUsd, warnAtPct: draft.warnAtPct };
  }
  if (draft.project && draft.project !== before.project) patch.project = draft.project;
  if (draft.requiresWeb !== before.requiresWeb) patch.requires = draft.requiresWeb ? ["web"] : [];
  if (draft.advisor && !same(draft.advisor, before.advisor)) patch.advisor = draft.advisor;
  if (draft.instructions.trim() && draft.instructions !== before.instructions)
    patch.instructions = draft.instructions;
  if (!same(draft.outputs, before.outputs)) patch.outputs = draft.outputs;
  return patch;
}

export const draftDirty = (initial: Workflow, draft: WorkflowDraft): boolean =>
  Object.keys(draftPatch(initial, draft)).length > 0;
