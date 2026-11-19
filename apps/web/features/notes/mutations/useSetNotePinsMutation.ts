import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getNotePinsQueryKey } from "../queries/useNotePinsQuery";

/** Replace the pinned notes (`PUT /api/notes/pins`). */
export const useSetNotePinsMutation = makeInvalidatingMutation(
  apiClient.notes.putNotePins.useMutation,
  getNotePinsQueryKey,
);
