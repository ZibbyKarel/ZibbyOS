# Notes (Kartotéka widget)

Path-based access to the vault's markdown notes (mozek) plus the operator's pinned set, for the
bridge "Kartotéka" widget and its note sheet. Unlike `memory` (id-based, flat per tier) this works
on vault-relative paths so folders are visible.

## Pieces

| Piece      | File                                         | Role                                                                        |
| ---------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| Contract   | `libs/contracts/src/notes/notes.contract.ts` | `notesContract` — tree, file read/save, pins under `/api/notes`             |
| Service    | `apps/api/src/notes/notes.service.ts`        | `NotesService` — tree walk, guarded read/write, pins file                   |
| Controller | `apps/api/src/notes/notes.controller.ts`     | implements `notesContract`, maps errors to 404 / 422                        |
| Module     | `apps/api/src/notes/notes.module.ts`         | `VAULT_DIR` + `NOTE_PINS_FILE` (`$NOTE_PINS_FILE` or `data/note-pins.json`) |

## Endpoints (`/api/notes`)

- `GET /notes/tree` — every visible `.md` path under the vault root (dot-folders skipped, max 5000).
- `GET /notes/file?path=` — raw markdown (including frontmatter). 404 unknown, 422 unsafe path.
- `PUT /notes/file` — overwrite an **existing** note; never creates. Atomic write.
- `GET /notes/pins`, `PUT /notes/pins` — pinned paths (whole-list replace, deduped) plus optional `labels` (per-pin display name, max 120 chars, trimmed; empty or unpinned ones dropped; the note file is never renamed).

## Path safety

A path must be vault-relative, use `/`, end in `.md`, and have no empty, `.`, `..` or dot-prefixed
segment. It is resolved under the vault root and the deepest existing ancestor's `realpath` must stay
inside the root's `realpath`, so symlinks cannot escape. Anything else is a 422.
