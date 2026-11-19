import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

export function getDayOverviewQueryKey() {
  return ["briefing", "day"] as const;
}

/** Today's text overview (`GET /api/briefing/day`) — written by the server on first read of the day. */
export function useDayOverviewQuery() {
  return apiClient.briefing.getDayOverview.useQuery({
    queryKey: getDayOverviewQueryKey(),
    select: selectApiResponseBody,
    retry: false,
    staleTime: 10 * 60_000,
  });
}
