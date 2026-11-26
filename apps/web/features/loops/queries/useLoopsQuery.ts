import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

/** Shared cache key for the loop-definitions list; exported so mutations can invalidate it. */
export function getLoopsQueryKey() {
  return ["loops"] as const;
}

/** Live loop catalog from `GET /api/loops`. Returns the `useQuery` result directly. */
export function useLoopsQuery() {
  return apiClient.loops.listLoops.useQuery({
    queryKey: getLoopsQueryKey(),
    select: selectApiResponseBody,
  });
}
