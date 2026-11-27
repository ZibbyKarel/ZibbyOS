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
      ? // ponytail: only the last 3 phases are scanned (the PR is opened late); a phase-agent
        // filter would need the workflow definition — add if a PR opened earlier goes missing.
        [...(run.stageRuns ?? [])]
          .reverse()
          .filter((s) => s.runId && !s.childRunId)
          .slice(0, 3)
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
