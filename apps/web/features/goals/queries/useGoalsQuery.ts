import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

export function getGoalsQueryKey() {
  return ["goals"] as const;
}

/** Live goal list with roll-ups (`GET /api/goals`). */
export function useGoalsQuery() {
  return apiClient.goals.listGoals.useQuery({
    queryKey: getGoalsQueryKey(),
    select: selectApiResponseBody,
  });
}
