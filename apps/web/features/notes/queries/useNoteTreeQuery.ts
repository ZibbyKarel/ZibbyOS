import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

export function getNoteTreeQueryKey() {
  return ["notes", "tree"] as const;
}

/** Every vault note path (`GET /api/notes/tree`). */
export function useNoteTreeQuery(enabled = true) {
  return apiClient.notes.getNoteTree.useQuery({
    queryKey: getNoteTreeQueryKey(),
    select: selectApiResponseBody,
    enabled,
  });
}
