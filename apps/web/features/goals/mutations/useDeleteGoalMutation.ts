import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getGoalsQueryKey } from "../queries/useGoalsQuery";

/** Delete a goal definition (`DELETE /api/goals/:id`); refreshes the goal list. */
export const useDeleteGoalMutation = makeInvalidatingMutation(
  apiClient.goals.deleteGoal.useMutation,
  getGoalsQueryKey,
);
