import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getGoalsQueryKey } from "../queries/useGoalsQuery";

/** Put a parked instance back to planning (`POST /api/goals/:id/instances/:instance/resume`); refreshes every goal query. */
export const useResumeGoalInstanceMutation = makeInvalidatingMutation(
  apiClient.goals.resumeGoalInstance.useMutation,
  getGoalsQueryKey,
);
