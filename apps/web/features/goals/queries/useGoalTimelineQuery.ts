import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

export function getGoalTimelineQueryKey(id: string, instance?: string) {
  return ["goals", "timeline", id, instance ?? "all"] as const;
}

/** Timeline events, newest last, optionally narrowed to one instance (`GET /api/goals/:id/timeline`). */
export function useGoalTimelineQuery(id: string, instance?: string) {
  return apiClient.goals.getGoalTimeline.useQuery({
    queryKey: getGoalTimelineQueryKey(id, instance),
    queryData: { params: { id }, query: instance ? { instance } : {} },
    select: selectApiResponseBody,
  });
}
