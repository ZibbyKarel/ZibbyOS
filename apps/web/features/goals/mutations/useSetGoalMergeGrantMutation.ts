import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getGoalsQueryKey } from "../queries/useGoalsQuery";

/** Set a goal's merge grant (`PUT /api/goals/:id/merge-grant`, operator token); refreshes every goal query. */
export const useSetGoalMergeGrantMutation = makeInvalidatingMutation(
  apiClient.goals.setGoalMergeGrant.useMutation,
  getGoalsQueryKey,
);
