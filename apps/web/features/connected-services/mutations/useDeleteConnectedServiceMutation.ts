import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getConnectedServicesQueryKey } from "../queries/useConnectedServicesQuery";

/** Remove a connected service (`DELETE /api/connected-services/:id`); refreshes the list. */
export const useDeleteConnectedServiceMutation = makeInvalidatingMutation(
  apiClient.connectedServices.deleteConnectedService.useMutation,
  getConnectedServicesQueryKey,
);
