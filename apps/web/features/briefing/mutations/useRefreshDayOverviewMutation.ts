import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getDayOverviewQueryKey } from "../queries/useDayOverviewQuery";

/** Rewrite today's overview now (`POST /api/briefing/day/refresh`). */
export const useRefreshDayOverviewMutation = makeInvalidatingMutation(
  apiClient.briefing.refreshDayOverview.useMutation,
  getDayOverviewQueryKey,
);
