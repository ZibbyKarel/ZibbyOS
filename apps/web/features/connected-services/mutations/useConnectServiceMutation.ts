import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getConnectedServicesQueryKey } from "../queries/useConnectedServicesQuery";

/** Open a service's login in system Chrome (`POST /api/connected-services/:id/connect`); refreshes the list. */
export const useConnectServiceMutation = makeInvalidatingMutation(
  apiClient.connectedServices.connectService.useMutation,
  getConnectedServicesQueryKey,
);
