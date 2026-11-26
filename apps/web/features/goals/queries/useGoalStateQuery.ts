import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

export function getGoalStateQueryKey(id: string) {
  return ["goals", "state", id] as const;
}

/** A goal's instances and roll-up (`GET /api/goals/:id/state`). */
export function useGoalStateQuery(id: string) {
  return apiClient.goals.getGoalState.useQuery({
    queryKey: getGoalStateQueryKey(id),
    queryData: { params: { id } },
    retry: false,
    select: selectApiResponseBody,
  });
}
