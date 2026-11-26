import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getGoalsQueryKey } from "../queries/useGoalsQuery";

/** Wake a goal so the engine re-plans (`POST /api/goals/:id/wake`); refreshes every goal query. */
export const useWakeGoalMutation = makeInvalidatingMutation(
  apiClient.goals.wakeGoal.useMutation,
  getGoalsQueryKey,
);
