import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getGoalsQueryKey } from "../queries/useGoalsQuery";

/** Patch a goal (a null clears a clearable field) (`PATCH /api/goals/:id`); refreshes every goal query. */
export const useUpdateGoalMutation = makeInvalidatingMutation(
  apiClient.goals.updateGoal.useMutation,
  getGoalsQueryKey,
);
