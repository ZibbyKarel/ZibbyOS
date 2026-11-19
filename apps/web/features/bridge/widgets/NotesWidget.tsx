"use client";

import { Container, Icon, TreeView, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useSetNotePinsMutation } from "../../notes/mutations";
import { branchIds, buildNoteTree } from "../../notes/noteTree";
import { useNotePinsQuery, useNoteTreeQuery } from "../../notes/queries";
import type { BridgeWidgetProps } from "./registry";
import { useWidgetReport } from "./useWidgetReport";

export enum NotesWidgetTestId {
  Empty = "notes-widget-empty",
}

/**
 * Kartotéka: the operator's pinned vault notes (mozek) as a folder / file tree. A file opens the
 * note in the detail sheet (read, edit, save, unpin). The header `+` switches the tree to the whole
 * vault, where a click pins / unpins a note instead.
 */
export function NotesWidget({
  widget,
  adding,
  onEmptyChange,
  onCountChange,
  selection,
  onOpen,
}: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.notes");
  const pinsQuery = useNotePinsQuery();
  const treeQuery = useNoteTreeQuery(adding);
  const setPins = useSetNotePinsMutation();
  const mode = adding ? "browse" : "pinned";
  // Folders flipped from the mode's default (pinned: all open, whole vault: all closed).
  const [flipped, setFlipped] = useState<Record<typeof mode, ReadonlySet<string>>>({
    pinned: new Set(),
    browse: new Set(),
  });

  const pins = useMemo(() => pinsQuery.data?.paths ?? [], [pinsQuery.data]);
  const nodes = useMemo(
    () =>
      buildNoteTree(adding ? (treeQuery.data?.paths ?? []) : pins, (p) => ({
        rowKey: `${widget.id}:${p}`,
        ...(adding && pins.includes(p) ? { leading: <Icon name="pin" size="xs" /> } : {}),
      })),
    [treeQuery.data, pins, adding, widget.id],
  );
  const expandedIds = useMemo(
    () => new Set(branchIds(nodes).filter((id) => (mode === "pinned") !== flipped[mode].has(id))),
    [nodes, mode, flipped],
  );

  // `failed`: the empty hint must stay visible, so the widget never collapses as empty.
  useWidgetReport(
    { loading: pinsQuery.isPending, count: pins.length, you: 0, failed: true },
    { onEmptyChange, onCountChange },
  );

  const toggleFolder = (id: string) =>
    setFlipped((f) => {
      const next = new Set(f[mode]);
      if (!next.delete(id)) next.add(id);
      return { ...f, [mode]: next };
    });

  const select = (path: string) => {
    if (adding) {
      setPins.mutate({
        body: {
          paths: pins.includes(path) ? pins.filter((p) => p !== path) : [...pins, path],
        },
      });
      return;
    }
    onOpen({ kind: "vaultNote", id: path, widgetId: widget.id, key: `${widget.id}:${path}` });
  };

  if (nodes.length === 0)
    return (
      <Container padding={["100", "150"]}>
        <span data-testid={NotesWidgetTestId.Empty}>
          <Typography size="sm" type="note" variant="tertiary">
            {adding ? t("emptyVault") : t("empty")}
          </Typography>
        </span>
      </Container>
    );

  return (
    <Container padding={["50", "100"]}>
      <TreeView
        expandedIds={expandedIds}
        label={t("treeLabel")}
        nodes={nodes}
        onSelect={select}
        onToggle={toggleFolder}
        selectedId={!adding && selection?.kind === "vaultNote" ? selection.id : null}
      />
    </Container>
  );
}
