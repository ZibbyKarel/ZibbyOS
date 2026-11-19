import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

/** Cache key for the autopilot state. Exported so mutations can invalidate it. */
export function getAutopilotQueryKey() {
  return ["autopilot"] as const;
}

/** Autonomy levels, paused flag + pending-approval count from `GET /api/autopilot`. */
export function useAutopilotQuery() {
  return apiClient.autopilot.getAutopilot.useQuery({
    queryKey: getAutopilotQueryKey(),
    select: selectApiResponseBody,
  });
}
