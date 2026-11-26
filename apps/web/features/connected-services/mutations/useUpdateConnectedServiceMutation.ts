import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getConnectedServicesQueryKey } from "../queries/useConnectedServicesQuery";

/** Edit a connected service (`PATCH /api/connected-services/:id`); refreshes the list. */
export const useUpdateConnectedServiceMutation = makeInvalidatingMutation(
  apiClient.connectedServices.updateConnectedService.useMutation,
  getConnectedServicesQueryKey,
);
