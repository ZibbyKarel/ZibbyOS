"use client";

import {
  AnchoredSheet,
  Markdown,
  MarkdownEditor,
  SheetAction,
  SheetBlock,
  SheetSection,
  TextInputField,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { noteName } from "../../../notes/noteTree";
import { useSaveNoteMutation, useSetNotePinsMutation } from "../../../notes/mutations";
import { useNoteFileQuery, useNotePinsQuery } from "../../../notes/queries";
import { type SheetProps, geometry } from "./sheetTypes";

export enum VaultNoteSheetTestId {
  Edit = "vault-note-sheet-edit",
  Save = "vault-note-sheet-save",
  Cancel = "vault-note-sheet-cancel",
  Pin = "vault-note-sheet-pin",
  Rename = "vault-note-sheet-rename",
  LabelInput = "vault-note-sheet-label-input",
  LabelSave = "vault-note-sheet-label-save",
}

/** The note without its leading YAML frontmatter (reading view only; the editor shows the file as is). */
const withoutFrontmatter = (body: string) => body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

/**
 * A pinned vault note (Kartotéka widget; the id is its vault path): rendered markdown with Edit →
 * the DS markdown editor over the whole file → Save (`PUT /api/notes/file`), Pin / Unpin, and
 * Rename link (the pin's label in Kartotéka; the note file itself is never touched).
 */
export function VaultNoteSheet({ id, anchor, onClose, frame }: SheetProps) {
  const t = useTranslations();
  const n = useTranslations("bridge.sheet.vaultNote");
  const { data: note } = useNoteFileQuery(id);
  const { data: pins } = useNotePinsQuery();
  const setPins = useSetNotePinsMutation();
  const save = useSaveNoteMutation();
  const [draft, setDraft] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  if (!note) return null;
  const pinned = pins?.paths.includes(id) ?? false;
  const name = noteName(id);
  const title = pins?.labels?.[id] ?? name;

  const saveLabel = () => {
    if (!pins || label === null || setPins.isPending) return;
    const labels = { ...pins.labels };
    delete labels[id];
    const value = label.trim();
    if (value && value !== name) labels[id] = value;
    setPins.mutate({ body: { paths: pins.paths, labels } }, { onSuccess: () => setLabel(null) });
  };

  return (
    <AnchoredSheet
      {...geometry(anchor, frame)}
      actions={
        label !== null ? (
          <>
            <SheetAction
              data-testid={VaultNoteSheetTestId.Cancel}
              disabled={setPins.isPending}
              onClick={() => setLabel(null)}
            >
              {n("cancel")}
            </SheetAction>
            <SheetAction
              data-testid={VaultNoteSheetTestId.LabelSave}
              disabled={setPins.isPending}
              intent="primary"
              onClick={saveLabel}
            >
              {n("save")}
            </SheetAction>
          </>
        ) : draft === null ? (
          <>
            {pinned && (
              <SheetAction
                data-testid={VaultNoteSheetTestId.Rename}
                onClick={() => setLabel(title)}
              >
                {n("rename")}
              </SheetAction>
            )}
            <SheetAction
              data-testid={VaultNoteSheetTestId.Pin}
              disabled={!pins || setPins.isPending}
              onClick={() =>
                setPins.mutate({
                  body: {
                    paths: pinned
                      ? (pins?.paths ?? []).filter((p) => p !== id)
                      : [...(pins?.paths ?? []), id],
                    labels: pins?.labels,
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
      // Editing: the editor takes the sheet's whole height instead of a fixed 420px box.
      fillBody={draft !== null && label === null}
      footerNote={
        label !== null
          ? setPins.isError
            ? n("saveFailed")
            : n("labelHint")
          : save.isError
            ? n("saveFailed")
            : undefined
      }
      glyph="pen"
      kind={t("bridge.sheet.kind.vaultNote")}
      meta={
        <Typography as="span" type="labelSm" variant="secondary">
          {id}
        </Typography>
      }
      onClose={onClose}
      title={title}
    >
      <SheetSection fill={draft !== null && label === null}>
        {label !== null ? (
          <TextInputField
            autoFocus
            hideLabel
            data-testid={VaultNoteSheetTestId.LabelInput}
            label={n("labelInput")}
            maxLength={120}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveLabel();
              else if (e.key === "Escape") setLabel(null);
            }}
            value={label}
          />
        ) : draft === null ? (
          <SheetBlock label={t("bridge.sheet.description")}>
            <Markdown escapeHtml source={withoutFrontmatter(note.body)} />
          </SheetBlock>
        ) : (
          <MarkdownEditor fill ariaLabel={n("editorLabel")} onChange={setDraft} value={draft} />
        )}
      </SheetSection>
    </AnchoredSheet>
  );
}
