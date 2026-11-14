"use client";

import {
  SheetPresentationContext,
  WidgetBoardTestId,
  WidgetFrameTestId,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { SHEET_WIDTH, type SheetAnchor, anchorChanged, measureSheet } from "../state/measure";
import { selectionLabel, useSheetHistory } from "../state/sheetHistory";
import { findRow, rowPosition, stepRow, useRowKeyNav } from "../state/useRowKeyNav";
import type { BridgeSelection } from "../widgets/registry";
import { AutomationSheet } from "./sheets/AutomationSheet";
import { IssueSheet } from "./sheets/IssueSheet";
import { NoteSheet } from "./sheets/NoteSheet";
import { PrSheet } from "./sheets/PrSheet";
import { ProjectSheet } from "./sheets/ProjectSheet";
import { QuickActionSheet } from "./sheets/QuickActionSheet";
import { RunSheet } from "./sheets/RunSheet";
import type { SheetFrame } from "./sheets/sheetTypes";
import { TaskSheet } from "./sheets/TaskSheet";

export enum DetailSheetTestId {
  Host = "bridge-detail-sheet-host",
}

export interface DetailSheetProps {
  selection: BridgeSelection | null;
  onClose: () => void;
  /** Reports the side the sheet opened to. */
  onSideChange?: (side: "left" | "right") => void;
  /** Lets a sheet open a linked entity (issue → PR → run …); in-sheet opens stack up for "← back". */
  onOpen?: (selection: BridgeSelection) => void;
}

/** Phone: the anchor is ignored (the sheet is a full page), so a row that is not on screen still opens. */
const PHONE_ANCHOR: SheetAnchor = {
  side: "r",
  left: 0,
  width: 0,
  top: 0,
  height: 0,
  eL: 0,
  eT: 0,
  eH: 0,
};

type Pos = { index: number; total: number } | null;
const samePos = (a: Pos, b: Pos) => a?.index === b?.index && a?.total === b?.total;

/**
 * The detail sheet layer. Mount it inside the `relative` wrapper that sits over the board: the
 * wrapper is both the screen root and the board for `measureSheet`, so the sheet spans the board's
 * full height. It anchors next to the open row (`[data-rk="<key>"]`) at its kind's preferred width
 * (or expanded), re-measuring when the wrapper resizes, when any widget body scrolls, and on window
 * resize. Arrow keys / the ↑↓ buttons step through the rows of the row's widget; links inside a
 * sheet stack up behind a back button (Backspace / Alt+←). On a phone (`useIsPhone`, the board's
 * detection) every sheet is a full page instead — see `AnchoredSheet` `presentation="page"`.
 */
export function DetailSheet({ selection, onClose, onSideChange, onOpen }: DetailSheetProps) {
  const t = useTranslations();
  const phone = useIsPhone();
  const marker = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<SheetAnchor | null>(null);
  const [pos, setPos] = useState<Pos>(null);
  // Expansion belongs to one item: the stored id stops matching when a new item opens.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const itemId = selection ? `${selection.kind}:${selection.id}` : null;
  const expanded = itemId !== null && expandedId === itemId;
  const last = useRef<SheetAnchor | null>(null);
  const history = useSheetHistory(selection, onOpen ?? (() => {}));
  const key = selection?.key;
  const kind = selection?.kind;
  const side = anchor?.side;

  useRowKeyNav(selection, root);

  useEffect(() => {
    if (side) onSideChange?.(side === "l" ? "left" : "right");
  }, [side, onSideChange]);

  useLayoutEffect(() => {
    const host = marker.current?.parentElement ?? null;
    root.current = host;
    if (!key || !host) {
      last.current = null;
      setAnchor(null);
      setPos(null);
      return;
    }
    const measure = () => {
      const row = findRow(host, key);
      if (!row) return;
      const rect = host.getBoundingClientRect();
      const grid = host
        .querySelector(`[data-testid="${WidgetBoardTestId.Inner}"]`)
        ?.getBoundingClientRect();
      // Horizontally the sheet meets the row's widget edge (rows can be inset, e.g. the runs rail),
      // vertically it keeps the row's band for the eraser.
      const r = row.getBoundingClientRect();
      const w =
        row.closest(`[data-testid="${WidgetFrameTestId.Root}"]`)?.getBoundingClientRect() ?? r;
      const band = { left: w.left, right: w.right, top: r.top, bottom: r.bottom, height: r.height };
      const next = measureSheet(rect, band, rect, {
        width: kind ? SHEET_WIDTH[kind] : undefined,
        expanded,
        ...(grid && { grid }),
      });
      const p = rowPosition(host, key);
      setPos((prev) => (samePos(prev, p) ? prev : p));
      if (!anchorChanged(next, last.current)) return; // observers fire often — only real moves set state
      last.current = next;
      setAnchor(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    // Rows move when a list changes under an open sheet (no resize, no scroll).
    const mo = new MutationObserver(measure);
    mo.observe(host, { childList: true, subtree: true });
    // Scroll doesn't bubble: capture it to catch every widget body.
    host.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      mo.disconnect();
      host.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [key, kind, expanded]);

  const hostMarker = <span hidden data-testid={DetailSheetTestId.Host} ref={marker} />;
  const placed = anchor ?? (phone ? PHONE_ANCHOR : null);
  if (!selection || !placed)
    return (
      <>
        {hostMarker}
        {null}
      </>
    ); // same child slots as below: the marker never remounts

  const prev = history.prev;
  const frame: SheetFrame = {
    nav: {
      ...(prev && {
        onBack: history.back,
        backLabel: selectionLabel(prev),
        backAriaLabel: t("bridge.sheet.back", { label: selectionLabel(prev) }),
      }),
      onStep: (d) => {
        if (root.current) stepRow(root.current, selection.key, d);
      },
      ...(pos && { stepPosition: pos }),
      stepPrevLabel: t("bridge.sheet.stepPrev"),
      stepNextLabel: t("bridge.sheet.stepNext"),
      copyLabel: t("common.copyId"),
      copiedLabel: t("common.copied"),
      expandLabel: t("bridge.sheet.expand"),
      shrinkLabel: t("bridge.sheet.shrink"),
    },
    expanded,
    onExpandedChange: (on) => setExpandedId(on ? itemId : null),
  };
  // Keyed per item: stepping swaps the content without carrying one item's local state to the next.
  const k = `${selection.kind}:${selection.id}`;
  const common = {
    id: selection.id,
    anchor: placed,
    onClose,
    frame,
    ...(onOpen && { onOpen: history.open }),
  };
  return (
    <SheetPresentationContext value={phone ? "page" : "anchored"}>
      {hostMarker}
      {kind === "issue" ? <IssueSheet key={k} {...common} /> : null}
      {kind === "task" ? <TaskSheet key={k} {...common} /> : null}
      {kind === "pr" ? <PrSheet key={k} {...common} /> : null}
      {kind === "run" ? <RunSheet key={k} {...common} /> : null}
      {kind === "quickAction" ? <QuickActionSheet key={k} {...common} /> : null}
      {kind === "note" ? <NoteSheet key={k} {...common} /> : null}
      {kind === "automation" ? <AutomationSheet key={k} {...common} /> : null}
      {kind === "project" ? <ProjectSheet key={k} {...common} /> : null}
    </SheetPresentationContext>
  );
}
