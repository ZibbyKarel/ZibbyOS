import { apiClient } from "../../../state/api";
import { getGoalQueryKey } from "./useGoalQuery";

/**
 * `GET /api/goals/:id` with the ts-rest `{ status, body }` envelope kept: non-2xx statuses resolve
 * as ordinary data (only network/throw failures set `isError`), so a consumer that must tell a
 * 404 from a 500 reads `data.status`. Shares `useGoalQuery`'s cache entry.
 */
export function useGoalEnvelopeQuery(id: string) {
  return apiClient.goals.getGoal.useQuery({
    queryKey: getGoalQueryKey(id),
    queryData: { params: { id } },
    retry: false,
  });
}
