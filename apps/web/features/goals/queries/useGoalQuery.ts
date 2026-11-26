import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

/** Prefix-nested under the `["goals"]` family so list invalidation refreshes it too. */
export function getGoalQueryKey(id: string) {
  return ["goals", "detail", id] as const;
}

/** One goal (`GET /api/goals/:id`). */
export function useGoalQuery(id: string) {
  return apiClient.goals.getGoal.useQuery({
    queryKey: getGoalQueryKey(id),
    queryData: { params: { id } },
    retry: false,
    select: selectApiResponseBody,
  });
}
