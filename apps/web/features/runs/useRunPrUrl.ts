import { apiClient } from "../../state/api";
import { selectApiResponseBody } from "../../state/selectApiResponseBody";
import { getStageRunLogQueryKey } from "./queries/useStageRunLogQuery";
import type { RunView } from "./run";
import { findPrUrl } from "./prUrl";

/**
 * The PR a run opened: the structured `prOutput` when the task's `pr` output made it, else a PR URL
 * in the outcome summary, else one printed in a phase log (a coder that ran `gh pr create` itself).
 * The log scan only runs when `enabled` for a workflow run with nothing found yet — one-shot reads
 * of terminal logs, newest phase first.
 */
export function useRunPrUrl(run: RunView, enabled: boolean): string | undefined {
  const direct = run.prOutput?.url ?? findPrUrl(run.taskOutcomeSummary);
  const stages =
    enabled && !direct && run.kind === "workflow"
      ? [...(run.stageRuns ?? [])].reverse().filter((s) => s.runId && !s.childRunId)
      : [];
  const fromLogs = apiClient.taskRuns.getTaskRunStageLogs.useQueries({
    queries: stages.map((s) => ({
      queryKey: getStageRunLogQueryKey(run.runId, s.phaseId, s.runId),
      queryData: {
        params: { runId: run.runId, phaseId: s.phaseId },
        query: { stageRunId: s.runId },
      },
      select: selectApiResponseBody,
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    })),
    combine: (results) => results.map((r) => findPrUrl(r.data?.content)).find(Boolean),
  });
  return direct ?? fromLogs;
}
