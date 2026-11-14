"use client";

import { WidgetFrameTestId } from "@zibby/design-system";
import { type RefObject, useEffect } from "react";
import type { BridgeSelection } from "../widgets/registry";

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

/** The row element carrying `data-rk={key}` (attribute compare — keys may hold any character). */
export const findRow = (root: ParentNode, key: string) =>
  [...root.querySelectorAll<HTMLElement>("[data-rk]")].find((el) => el.dataset.rk === key) ?? null;

/** The `[data-rk]` rows of the widget holding row `key` (DOM order), and that row. */
function widgetRows(root: ParentNode, key: string) {
  const cur = findRow(root, key);
  const frame = cur?.closest(`[data-testid="${WidgetFrameTestId.Root}"]`);
  return cur && frame ? { cur, rows: [...frame.querySelectorAll<HTMLElement>("[data-rk]")] } : null;
}

/** 0-based position of row `key` among its widget's rows — the sheet's `3 / 8` counter. */
export function rowPosition(
  root: ParentNode,
  key: string,
): { index: number; total: number } | null {
  const w = widgetRows(root, key);
  return w ? { index: w.rows.indexOf(w.cur), total: w.rows.length } : null;
}

/**
 * Opens the next (`1`) / previous (`-1`) row of row `key`'s widget by clicking it — a row's click
 * is what opens the sheet, so selection stays the widgets' business. False at the ends (no wrap).
 */
export function stepRow(root: ParentNode, key: string, d: -1 | 1): boolean {
  const w = widgetRows(root, key);
  const next = w?.rows[w.rows.indexOf(w.cur) + d];
  if (!next) return false;
  next.scrollIntoView?.({ block: "nearest" });
  next.click();
  return true;
}

/**
 * ArrowDown → next row, ArrowUp → previous row, within the selected row's widget (`stepRow`).
 * Ignored while typing and at the ends (no wrap).
 * ponytail: DOM order = visual order; a widget that reorders rows with CSS only would break it.
 */
export function useRowKeyNav(
  selection: BridgeSelection | null,
  root: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      if (!d || !root.current) return;
      if (stepRow(root.current, selection.key, d)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, root]);
}
