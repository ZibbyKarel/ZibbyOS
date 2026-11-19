import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorSchema } from "../common.schema";

const c = initContract();

/** Vault-relative posix path of a markdown note, e.g. `projects/zibby/notes.md`. */
export const NotePathSchema = z.string().min(1).max(500);

export const NoteTreeSchema = z.object({ paths: z.array(NotePathSchema) });
export type NoteTree = z.infer<typeof NoteTreeSchema>;

export const NoteFileSchema = z.object({ path: NotePathSchema, body: z.string() });
export type NoteFile = z.infer<typeof NoteFileSchema>;

export const NotePinsSchema = z.object({ paths: z.array(NotePathSchema).max(200) });
export type NotePins = z.infer<typeof NotePinsSchema>;

/**
 * Vault notes by path (the "Plachty" widget): the folder tree, read / save one markdown file and
 * the operator's pinned set. Paths are vault-relative, `.md` only, and resolved under the vault
 * root (anything else is a 422).
 */
export const notesContract = c.router(
  {
    getNoteTree: {
      method: "GET",
      path: "/notes/tree",
      responses: { 200: NoteTreeSchema },
      summary: "Every markdown note in the vault, as vault-relative paths",
    },
    getNoteFile: {
      method: "GET",
      path: "/notes/file",
      query: z.object({ path: NotePathSchema }),
      responses: { 200: NoteFileSchema, 404: ErrorSchema, 422: ErrorSchema },
      summary: "Read one note's raw markdown",
    },
    putNoteFile: {
      method: "PUT",
      path: "/notes/file",
      body: NoteFileSchema,
      responses: { 200: NoteFileSchema, 404: ErrorSchema, 422: ErrorSchema },
      summary: "Overwrite an existing note's markdown",
    },
    getNotePins: {
      method: "GET",
      path: "/notes/pins",
      responses: { 200: NotePinsSchema },
      summary: "The pinned notes",
    },
    putNotePins: {
      method: "PUT",
      path: "/notes/pins",
      body: NotePinsSchema,
      responses: { 200: NotePinsSchema },
      summary: "Replace the pinned notes",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type NotesContract = typeof notesContract;
