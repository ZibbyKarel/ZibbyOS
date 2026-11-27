import { apiClient } from "../../state/api";
import { selectApiResponseBody } from "../../state/selectApiResponseBody";
import { useWorkflowsQuery } from "../workflows";
import type { RunView } from "./run";
import { getTaskRunQueryKey } from "./queries/useTaskRunQuery";

/** Ids of the sub-runs a workflow run's phases spawned (finished ones from `stageRuns`, the running one from `pendingChild`). */
export function childRunIds(run: Pick<RunView, "stageRuns" | "pendingChild">): string[] {
  const ids = (run.stageRuns ?? []).flatMap((s) => (s.childRunId ? [s.childRunId] : []));
  if (run.pendingChild) ids.push(run.pendingChild.childRunId);
  return [...new Set(ids)];
}

/**
 * The sub-runs of a workflow run (one level), keyed like the single-run query so the SSE
 * invalidations that refresh the parent refresh them too. Returns a `childOf` lookup for
 * `buildStageRailWithChildren`: the child's view plus its workflow's phase ids.
 */
export function useChildRuns(run: RunView) {
  const { data: workflows } = useWorkflowsQuery();
  const ids = run.kind === "workflow" ? childRunIds(run) : [];
  const results = apiClient.taskRuns.getTaskRun.useQueries({
    queries: ids.map((id) => ({
      queryKey: getTaskRunQueryKey(id),
      queryData: { params: { runId: id } },
      select: selectApiResponseBody,
      retry: false,
    })),
  });
  const byId = new Map(
    results.flatMap((r) => (r.data?.kind === "workflow" ? [[r.data.runId, r.data] as const] : [])),
  );
  return (childRunId: string) => {
    const child = byId.get(childRunId);
    if (!child) return undefined;
    const phases = workflows?.find((w) => w.id === child.owner)?.phases;
    return {
      run: child,
      definedPhaseIds: phases?.map((p) => p.id).filter((id): id is string => !!id),
    };
  };
}
