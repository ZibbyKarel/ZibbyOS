import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getWorkflowsQueryKey } from "../queries/useWorkflowsQuery";

/** Delete a workflow (`DELETE /api/workflows/:id`); refreshes the list on success. */
export const useDeleteWorkflowMutation = makeInvalidatingMutation(
  apiClient.workflows.deleteWorkflow.useMutation,
  getWorkflowsQueryKey,
);
