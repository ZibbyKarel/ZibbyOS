import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getConnectedServicesQueryKey } from "../queries/useConnectedServicesQuery";

/** Add a connected service (`POST /api/connected-services`); refreshes the list. */
export const useCreateConnectedServiceMutation = makeInvalidatingMutation(
  apiClient.connectedServices.createConnectedService.useMutation,
  getConnectedServicesQueryKey,
);
