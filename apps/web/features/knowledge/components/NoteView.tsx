"use client";

import { type ReactNode, useState } from "react";
import {
  Button,
  Container,
  Divider,
  Markdown,
  MarkdownEditor,
  Panel,
  Pressable,
  Stack,
  Tag,
  TextInputField,
  Typography,
  type WikilinkTarget,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import type { Note } from "@zibby/contracts";
import { useUpdateNoteMutation } from "../mutations";

export enum NoteViewTestId {
  Edit = "memory-note-edit",
  Save = "memory-note-save",
  Cancel = "memory-note-cancel",
  Title = "memory-note-title-input",
  /** Phase 109: shown when the open note is unprocessed "halda" (`raw: true`). */
  RawBadge = "memory-note-raw-badge",
  /** F4b: shown when the open note carries an owning department (F4a shelves). */
  DepartmentBadge = "memory-note-department-badge",
  /** Closes the note (back to the empty reader) — `bare` header only. */
  Close = "memory-note-close",
}

export interface NoteViewProps {
  /** The open note, or undefined when nothing is selected. */
  note: Note | undefined;
  /** Navigate to a linked/backlinked note (index-first traversal). */
  onSelect: (id: string) => void;
  /** Hide the Edit action — used for a team KB, which ZIBBY only reads (Law 1). */
  readOnly?: boolean;
  /** Render without the Panel frame (inside the Mozek note pane, which is the frame). */
  bare?: boolean;
  /** Notes offered by the editor's `[[` autocomplete. */
  wikilinkTargets?: readonly WikilinkTarget[];
  /** Extra content under the body in view mode (open questions, the KB inbox composer). */
  extra?: ReactNode;
  /** Display label of a linked note id (default: the id itself). */
  linkLabel?: (id: string) => string;
  /** Marker (colour dot) shown before a linked note's label. */
  linkMarker?: (id: string) => ReactNode;
  /** `bare` header: source badge, mono breadcrumb path, meta chips and extra header tools. */
  badge?: ReactNode;
  crumbs?: string;
  metaChips?: readonly string[];
  headerTools?: ReactNode;
  /** Rendered after the link sections (the "Okolí v mozku" card). */
  neighbourhood?: ReactNode;
  /** Shows a close ✕ next to the action in the `bare` header. */
  onClose?: () => void;
}

/** A row of clickable wiki-link chips — the index-first navigation affordance. */
function LinkChips({
  ids,
  kind,
  onSelect,
  label,
  marker,
}: {
  ids: readonly string[];
  kind: "link" | "backlink";
  onSelect: (id: string) => void;
  label?: (id: string) => string;
  marker?: (id: string) => ReactNode;
}) {
  return (
    <Stack wrap align="center" direction="row" gap="150">
      {ids.map((id) => (
        <Pressable data-testid={`memory-note-${kind}-${id}`} key={id} onClick={() => onSelect(id)}>
          <Stack align="center" direction="row" gap="50">
            {marker?.(id)}
            <Typography size="sm" type="note" variant="secondary">
              {label?.(id) ?? id}
            </Typography>
          </Stack>
        </Pressable>
      ))}
    </Stack>
  );
}

/**
 * The memory note panel — a view⇄edit surface (N4g grammar: editing a large
 * Markdown body happens IN PLACE, not in a dialog; dialogs only create). View
 * mode shows the body plus its **navigable** wiki-links — outbound `links` (→)
 * and inbound `backlinks` (←), each a clickable chip that selects that note
 * (the index-first navigation the North Star describes). The Edit action sits
 * top-right in the panel header; edit mode swaps the body for a title input +
 * Markdown editor and Save/Cancel take the header slot. Id and tier stay
 * immutable (there is no move op).
 */
export function NoteView({
  note,
  onSelect,
  readOnly = false,
  bare = false,
  wikilinkTargets,
  extra,
  linkLabel,
  linkMarker,
  badge,
  crumbs,
  metaChips,
  headerTools,
  neighbourhood,
  onClose,
}: NoteViewProps) {
  const t = useTranslations("memory");
  const tk = useTranslations();
  const updateNote = useUpdateNoteMutation();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const startEdit = () => {
    if (!note) return;
    setTitle(note.title ?? "");
    setBody(note.body ?? "");
    setEditing(true);
  };

  const save = () => {
    if (!note) return;
    updateNote.mutate(
      { params: { id: note.id }, body: { title: title || undefined, body } },
      { onSuccess: () => setEditing(false) },
    );
  };

  const action =
    note && !readOnly ? (
      editing ? (
        <Stack align="center" direction="row" gap="100">
          <Button
            data-testid={NoteViewTestId.Cancel}
            intent="ghost"
            onClick={() => setEditing(false)}
            size="sm"
          >
            {tk("common.cancel")}
          </Button>
          <Button
            data-testid={NoteViewTestId.Save}
            icon="check"
            intent="primary"
            loading={updateNote.isPending}
            onClick={save}
            size="sm"
          >
            {t("save")}
          </Button>
        </Stack>
      ) : (
        <Button
          data-testid={NoteViewTestId.Edit}
          icon="edit"
          intent="ghost"
          onClick={startEdit}
          size="sm"
        >
          {bare ? tk("knowledge.brain.note.edit") : t("editNote")}
        </Button>
      )
    ) : undefined;

  const content = note ? (
    editing ? (
      <Stack gap="150">
        <Typography mono size="caption" type="note" variant="tertiary">
          {note.path} · {note.tier}
        </Typography>
        <TextInputField
          data-testid={NoteViewTestId.Title}
          label={t("titleLabel")}
          onChange={(e) => setTitle(e.target.value)}
          value={title}
        />
        <MarkdownEditor
          ariaLabel={t("bodyLabel")}
          label={t("bodyLabel")}
          onChange={(value) => setBody(value ?? "")}
          value={body}
          wikilinkTargets={wikilinkTargets}
        />
      </Stack>
    ) : (
      <Stack gap="150">
        <Stack align="center" direction="row" gap="75">
          {!crumbs && (
            <Typography mono size="caption" type="note" variant="tertiary">
              {note.path} · {note.tier}
            </Typography>
          )}
          {note.raw && (
            <Tag data-testid={NoteViewTestId.RawBadge} size="sm" tone="warn">
              {t("untriaged")}
            </Tag>
          )}
          {note.department && (
            <Tag
              aria-label={t("departmentBadge")}
              data-testid={NoteViewTestId.DepartmentBadge}
              size="sm"
              title={t("departmentBadge")}
              tone="accent"
            >
              {note.department}
            </Tag>
          )}
        </Stack>

        <Markdown compact={bare} source={note.body ?? ""} />

        {bare && note.backlinks && note.backlinks.length > 0 && (
          <Stack gap="75">
            <Typography uppercase size="2xs" type="note" variant="tertiary">
              {tk("knowledge.brain.note.linksIn")}{" "}
              <Typography mono as="span" size="2xs" type="note" variant="secondary">
                {note.backlinks.length}
              </Typography>
            </Typography>
            <LinkChips
              ids={note.backlinks}
              kind="backlink"
              label={linkLabel}
              marker={linkMarker}
              onSelect={onSelect}
            />
          </Stack>
        )}

        {note.links.length > 0 && (
          <Stack gap="75">
            <Typography uppercase size="2xs" type="note" variant="tertiary">
              {bare ? tk("knowledge.brain.note.linksOut") : t("noteLinks")}
              {bare && (
                <>
                  {" "}
                  <Typography mono as="span" size="2xs" type="note" variant="secondary">
                    {note.links.length}
                  </Typography>
                </>
              )}
            </Typography>
            <LinkChips
              ids={note.links}
              kind="link"
              label={linkLabel}
              marker={linkMarker}
              onSelect={onSelect}
            />
          </Stack>
        )}

        {!bare && note.backlinks && note.backlinks.length > 0 && (
          <Stack gap="50">
            <Typography uppercase size="2xs" type="note" variant="tertiary">
              {t("noteBacklinks")}
            </Typography>
            <LinkChips ids={note.backlinks} kind="backlink" onSelect={onSelect} />
          </Stack>
        )}

        {neighbourhood}
        {extra}
      </Stack>
    )
  ) : (
    <Typography mono size="sm" type="note" variant="secondary">
      {t("selectNode")}
    </Typography>
  );

  if (bare)
    return (
      <Stack>
        <Container padding={["100", "250", "150", "250"]}>
          <Stack gap="100">
            <Stack align="center" direction="row" gap="75" justify="between">
              <Stack align="center" direction="row" gap="75">
                {badge}
                {crumbs && (
                  <Typography mono truncate size="2xs" type="note" variant="tertiary">
                    {crumbs}
                  </Typography>
                )}
              </Stack>
              <Stack align="center" direction="row" gap="50">
                {headerTools}
                {action}
                {onClose && (
                  <Button
                    aria-label={tk("knowledge.brain.note.close")}
                    data-testid={NoteViewTestId.Close}
                    icon="x"
                    intent="ghost"
                    onClick={onClose}
                    size="sm"
                  />
                )}
              </Stack>
            </Stack>
            <Typography type="title">{note?.title ?? t("noteFallback")}</Typography>
            {metaChips && metaChips.length > 0 && (
              <Stack wrap align="center" direction="row" gap="50">
                {metaChips.map((c) => (
                  <Tag key={c} size="sm" tone="neutral">
                    {c}
                  </Tag>
                ))}
              </Stack>
            )}
          </Stack>
        </Container>
        <Divider />
        <Container padding={["200", "250"]}>{content}</Container>
      </Stack>
    );
  return (
    <Panel header={note?.title ?? t("noteFallback")} headerEnd={action} padding="250">
      {content}
    </Panel>
  );
}
