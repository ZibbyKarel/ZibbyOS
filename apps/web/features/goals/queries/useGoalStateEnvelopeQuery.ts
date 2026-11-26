import { apiClient } from "../../../state/api";
import { getGoalStateQueryKey } from "./useGoalStateQuery";

/** `GET /api/goals/:id/state` with the `{ status, body }` envelope kept (see `useGoalEnvelopeQuery`). */
export function useGoalStateEnvelopeQuery(id: string) {
  return apiClient.goals.getGoalState.useQuery({
    queryKey: getGoalStateQueryKey(id),
    queryData: { params: { id } },
    retry: false,
  });
}
