"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { BridgeSelection } from "../widgets/registry";

export type SheetHistoryAction =
  | { type: "push"; from: BridgeSelection }
  | { type: "pop" }
  | { type: "clear" };

/** The sheet's back stack: the selections an in-sheet link left behind, newest last. */
export function sheetHistory(
  stack: readonly BridgeSelection[],
  action: SheetHistoryAction,
): readonly BridgeSelection[] {
  if (action.type === "push") return [...stack, action.from];
  if (action.type === "pop") return stack.slice(0, -1);
  return stack.length ? [] : stack;
}

/** An in-sheet open lands on `next` but stays anchored to the row the sheet came from. */
export const anchoredTo = (next: BridgeSelection, from: BridgeSelection): BridgeSelection => ({
  ...next,
  widgetId: from.widgetId,
  key: from.key,
});

/** Short label of a selection for the back button: `#12` for a PR url, the key of an issue. */
export function selectionLabel(sel: BridgeSelection): string {
  const tail = sel.id.split("/").pop() || sel.id;
  return sel.kind === "pr" ? `#${tail}` : sel.kind === "issue" ? tail : sel.id;
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

/**
 * Back stack of the detail sheet. `open` (handed to the sheets) pushes the current selection and
 * opens the next one anchored to the same row; `back` (button, Backspace, Alt+←) pops one step.
 * Any selection change that didn't come from here (row click, arrow step, URL) clears the stack.
 */
export function useSheetHistory(
  selection: BridgeSelection | null,
  select: (selection: BridgeSelection) => void,
) {
  const [stack, dispatch] = useReducer(sheetHistory, []);
  const own = useRef<BridgeSelection | null>(null);

  useEffect(() => {
    if (selection !== own.current) dispatch({ type: "clear" });
  }, [selection]);

  const open = useCallback(
    (next: BridgeSelection) => {
      if (!selection) return select(next);
      const target = anchoredTo(next, selection);
      own.current = target;
      dispatch({ type: "push", from: selection });
      select(target);
    },
    [selection, select],
  );

  const prev = stack.at(-1) ?? null;
  const back = useCallback(() => {
    if (!prev) return;
    own.current = prev;
    dispatch({ type: "pop" });
    select(prev);
  }, [prev, select]);

  useEffect(() => {
    if (!prev) return;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey) return;
      const isBack = (e.key === "Backspace" && !e.altKey) || (e.key === "ArrowLeft" && e.altKey);
      if (!isBack) return;
      e.preventDefault();
      back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, back]);

  return { open, back, prev };
}
