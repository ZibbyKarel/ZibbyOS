import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

export function getNoteFileQueryKey(path: string) {
  return ["notes", "file", path] as const;
}

/** One note's raw markdown (`GET /api/notes/file`). */
export function useNoteFileQuery(path: string) {
  return apiClient.notes.getNoteFile.useQuery({
    queryKey: getNoteFileQueryKey(path),
    queryData: { query: { path } },
    select: selectApiResponseBody,
  });
}
