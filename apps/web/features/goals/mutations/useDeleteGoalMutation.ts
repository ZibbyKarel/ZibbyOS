import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getGoalsQueryKey } from "../queries/useGoalsQuery";

/** Delete a goal and its state (`DELETE /api/goals/:id`); refreshes every goal query. */
export const useDeleteGoalMutation = makeInvalidatingMutation(
  apiClient.goals.deleteGoal.useMutation,
  getGoalsQueryKey,
);
