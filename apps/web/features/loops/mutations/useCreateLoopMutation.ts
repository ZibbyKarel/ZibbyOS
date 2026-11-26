import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";
import { getLoopsQueryKey } from "../queries/useLoopsQuery";

/** Create a loop definition (`POST /api/loops`); refreshes the loops list. */
export const useCreateLoopMutation = makeInvalidatingMutation(
  apiClient.loops.createLoop.useMutation,
  getLoopsQueryKey,
);
