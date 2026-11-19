import { apiClient } from "../../../state/api";
import { makeInvalidatingMutation } from "../../../state/makeInvalidatingMutation";

/** Save a note's markdown (`PUT /api/notes/file`); refreshes every cached note file. */
export const useSaveNoteMutation = makeInvalidatingMutation(
  apiClient.notes.putNoteFile.useMutation,
  () => ["notes", "file"] as const,
);
