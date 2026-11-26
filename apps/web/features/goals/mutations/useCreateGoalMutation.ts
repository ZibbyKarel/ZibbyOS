import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getGoalsQueryKey } from "../queries/useGoalsQuery";

/** Create a goal (`POST /api/goals`); refreshes every goal query. */
export const useCreateGoalMutation = makeInvalidatingMutation(
  apiClient.goals.createGoal.useMutation,
  getGoalsQueryKey,
);
