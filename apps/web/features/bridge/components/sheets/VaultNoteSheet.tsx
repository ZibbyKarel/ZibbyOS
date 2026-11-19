"use client";

import {
  AnchoredSheet,
  Markdown,
  MarkdownEditor,
  SheetAction,
  SheetBlock,
  SheetSection,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSaveNoteMutation, useSetNotePinsMutation } from "../../../notes/mutations";
import { useNoteFileQuery, useNotePinsQuery } from "../../../notes/queries";
import { type SheetProps, geometry } from "./sheetTypes";

export enum VaultNoteSheetTestId {
  Edit = "vault-note-sheet-edit",
  Save = "vault-note-sheet-save",
  Cancel = "vault-note-sheet-cancel",
  Pin = "vault-note-sheet-pin",
}

/** The note without its leading YAML frontmatter (reading view only; the editor shows the file as is). */
const withoutFrontmatter = (body: string) => body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

/**
 * A pinned vault note (Kartotéka widget; the id is its vault path): rendered markdown with Edit →
 * the DS markdown editor over the whole file → Save (`PUT /api/notes/file`), and Pin / Unpin.
 */
export function VaultNoteSheet({ id, anchor, onClose, frame }: SheetProps) {
  const t = useTranslations();
  const n = useTranslations("bridge.sheet.vaultNote");
  const { data: note } = useNoteFileQuery(id);
  const { data: pins } = useNotePinsQuery();
  const setPins = useSetNotePinsMutation();
  const save = useSaveNoteMutation();
  const [draft, setDraft] = useState<string | null>(null);

  if (!note) return null;
  const pinned = pins?.paths.includes(id) ?? false;
  const name = (id.split("/").pop() ?? id).replace(/\.md$/, "");

  return (
    <AnchoredSheet
      {...geometry(anchor, frame)}
      actions={
        draft === null ? (
          <>
            <SheetAction
              data-testid={VaultNoteSheetTestId.Pin}
              disabled={!pins || setPins.isPending}
              onClick={() =>
                setPins.mutate({
                  body: {
                    paths: pinned
                      ? (pins?.paths ?? []).filter((p) => p !== id)
                      : [...(pins?.paths ?? []), id],
                  },
                })
              }
            >
              {pinned ? n("unpin") : n("pin")}
            </SheetAction>
            <SheetAction
              data-testid={VaultNoteSheetTestId.Edit}
              intent="primary"
              onClick={() => setDraft(note.body)}
            >
              {n("edit")}
            </SheetAction>
          </>
        ) : (
          <>
            <SheetAction
              data-testid={VaultNoteSheetTestId.Cancel}
              disabled={save.isPending}
              onClick={() => setDraft(null)}
            >
              {n("cancel")}
            </SheetAction>
            <SheetAction
              data-testid={VaultNoteSheetTestId.Save}
              disabled={save.isPending || draft === note.body}
              intent="primary"
              onClick={() =>
                save.mutate(
                  { body: { path: id, body: draft } },
                  { onSuccess: () => setDraft(null) },
                )
              }
            >
              {n("save")}
            </SheetAction>
          </>
        )
      }
      closeLabel={t("bridge.sheet.close")}
      copyId={id}
      footerNote={save.isError ? n("saveFailed") : undefined}
      glyph="pen"
      kind={t("bridge.sheet.kind.vaultNote")}
      meta={
        <Typography as="span" type="labelSm" variant="secondary">
          {id}
        </Typography>
      }
      onClose={onClose}
      title={name}
    >
      <SheetSection>
        {draft === null ? (
          <SheetBlock label={t("bridge.sheet.description")}>
            <Markdown escapeHtml source={withoutFrontmatter(note.body)} />
          </SheetBlock>
        ) : (
          <MarkdownEditor ariaLabel={n("editorLabel")} onChange={setDraft} value={draft} />
        )}
      </SheetSection>
    </AnchoredSheet>
  );
}
