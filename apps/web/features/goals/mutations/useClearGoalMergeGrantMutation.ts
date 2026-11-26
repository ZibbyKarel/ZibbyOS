import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getGoalsQueryKey } from "../queries/useGoalsQuery";

/** Revoke a goal's merge grant (`DELETE /api/goals/:id/merge-grant`, operator token); refreshes every goal query. */
export const useClearGoalMergeGrantMutation = makeInvalidatingMutation(
  apiClient.goals.clearGoalMergeGrant.useMutation,
  getGoalsQueryKey,
);
