import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getGoalsQueryKey } from "../queries/useGoalsQuery";

/** Partially update a goal definition (`PATCH /api/goals/:id`); refreshes the goal list + detail. */
export const useUpdateGoalMutation = makeInvalidatingMutation(
  apiClient.goals.updateGoal.useMutation,
  getGoalsQueryKey,
);
