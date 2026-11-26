import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../state/api";
import { taskRunsRootKey } from "../../runs/queries/keys";

/** Resume a parked loop run with an operator note
 * (`POST /api/tasks/runs/:runId/resume`); refreshes the feed. */
export function useResumeLoopRunMutation() {
  const qc = useQueryClient();
  return apiClient.taskRuns.resumeTaskRun.useMutation({
    onSuccess: () => qc.invalidateQueries({ queryKey: taskRunsRootKey }),
  });
}
