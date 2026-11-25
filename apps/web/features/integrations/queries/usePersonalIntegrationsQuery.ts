import { type Integration, isPersonalAccount } from "@zibby/contracts";
import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

/**
 * Cache key for the operator's personal accounts. Nested under the `["integrations"]`
 * prefix, so every integration mutation's bare invalidation refreshes it too.
 */
export function getPersonalIntegrationsQueryKey() {
  return ["integrations", "personal"] as const;
}

/** Narrows the account list to the operator's personal accounts (no `companyId`). */
export function selectPersonalIntegrations(res: { body: Integration[] }): Integration[] {
  return selectApiResponseBody(res).filter(isPersonalAccount);
}

/**
 * The operator's PERSONAL accounts — integrations with no owning company. The list
 * endpoint has no owner filter, so this fetches the catalog and narrows it in `select`.
 */
export function usePersonalIntegrationsQuery() {
  return apiClient.integrations.listIntegrations.useQuery({
    queryKey: getPersonalIntegrationsQueryKey(),
    queryData: { query: {} },
    select: selectPersonalIntegrations,
  });
}
