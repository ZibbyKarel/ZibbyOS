import type { ConnectedService } from "@zibby/contracts";
import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

export const CONNECTED_SERVICES_POLL_MS = 5_000;

/** Cache key for the connected services. Exported so mutations can invalidate it. */
export function getConnectedServicesQueryKey() {
  return ["connected-services"] as const;
}

/**
 * The connected services from `GET /api/connected-services`. Refetches on window focus (the
 * operator signs in in Chrome and comes back — the app default is off), and every 5s while
 * `shouldPoll(services)` is true.
 */
export function useConnectedServicesQuery(shouldPoll?: (services: ConnectedService[]) => boolean) {
  return apiClient.connectedServices.listConnectedServices.useQuery({
    queryKey: getConnectedServicesQueryKey(),
    select: selectApiResponseBody,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const res = query.state.data;
      return shouldPoll && res?.status === 200 && shouldPoll(res.body)
        ? CONNECTED_SERVICES_POLL_MS
        : false;
    },
  });
}
