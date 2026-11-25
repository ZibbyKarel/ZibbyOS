import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

/**
 * Shared cache key for the account list. Exported so mutations can invalidate it; the
 * `["integrations"]` prefix also clears every narrowed variant (company / personal / detail).
 */
export function getIntegrationsQueryKey() {
  return ["integrations"] as const;
}

/**
 * Every account (`Integration`) from `GET /api/integrations` — company and personal alike.
 * `select` unwraps the response envelope so `data` is `Integration[]`. A project's serving
 * accounts come from `useResolvedProjectQuery` instead.
 */
export function useIntegrationsQuery() {
  return apiClient.integrations.listIntegrations.useQuery({
    queryKey: getIntegrationsQueryKey(),
    queryData: { query: {} },
    select: selectApiResponseBody,
  });
}
