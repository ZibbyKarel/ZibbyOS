import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

export function getNotePinsQueryKey() {
  return ["notes", "pins"] as const;
}

/** The pinned note paths (`GET /api/notes/pins`). */
export function useNotePinsQuery() {
  return apiClient.notes.getNotePins.useQuery({
    queryKey: getNotePinsQueryKey(),
    select: selectApiResponseBody,
  });
}
