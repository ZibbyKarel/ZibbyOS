"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UiSettings } from "@zibby/contracts";
import type { ResizeCorner } from "@zibby/design-system";
import { useUiSettings } from "../../system";
import {
  type BridgeWidget,
  type DragOrigin,
  type WidgetType,
  addWidget,
  compact,
  dragMove,
  dragResize,
  removeWidget,
} from "../grid/layout";
import {
  type Arrangement,
  DEFAULT_LAYOUT,
  DEFAULT_PRESET,
  REVIEW_PRESET,
  arrangement,
  layoutNameError,
  layoutNames,
  nextSavedName,
  presetLayout,
} from "../grid/presets";
import type { BridgeSelection } from "../widgets/registry";

export const CUSTOM_PRESET = "CUSTOM";

type BridgeUi = UiSettings["bridge"];

/**
 * Detail-sheet kinds mirrored in the URL (`?issue=<project>/<item>`, `?pull-request=<url>`,
 * `?run=<runId>`) so an open sheet survives a reload and can be linked. The row key is derived
 * from the type's first instance (id = type); a further instance (`prs-2`) isn't restored. A task row keys by its run, not the task id — it stays local.
 */
const SELECTION_PARAMS = { issue: "issue", pr: "pull-request", run: "run" } as const;
const SELECTION_WIDGETS = { issue: "issues", pr: "prs", run: "runs" } as const;
const URL_KINDS = Object.keys(SELECTION_PARAMS) as (keyof typeof SELECTION_PARAMS)[];

export function selectionFromParams(
  params: Pick<URLSearchParams, "get"> | null,
): BridgeSelection | null {
  for (const kind of URL_KINDS) {
    const id = params?.get(SELECTION_PARAMS[kind]);
    if (!id) continue;
    const widgetId = SELECTION_WIDGETS[kind];
    return { kind, id, widgetId, key: `${widgetId}:${id}` };
  }
  return null;
}

/** Bump when the built-in DEFAULT changes so much that an older saved DEFAULT should be dropped. */
const BRIDGE_DESIGN_REV = 2;

/**
 * Bridge screen state. Persisted bits (layout / preset / saved / arranged / removed / collapsed /
 * epicClosed) live in `ui.bridge` (server, debounced by `useUiSettings.setBridge`); a local overlay
 * keeps every change instant so drags and toggles don't wait for the round trip. There is no edit
 * mode: add / remove / updateWidget and drag end persist straight into the active layout
 * (`saved[preset]`, DEFAULT included); drag frames stay local until `endDrag`. Dragging / selection
 * are local. Esc closes the selection.
 */
export function useBridgeState() {
  const { ui, loaded, setBridge } = useUiSettings();
  const [local, setLocal] = useState<Partial<BridgeUi>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** The open detail-sheet row; null until the sheet task wires rows to `setSelection`. */
  const searchParams = useSearchParams();
  const [selection, setSelection] = useState<BridgeSelection | null>(() =>
    selectionFromParams(searchParams),
  );

  // One-time: a DEFAULT saved before the redesign gives way to the new built-in (O7). Other
  // saved layouts stay; an active non-DEFAULT layout is not touched.
  const migration = useMemo(() => {
    if (!loaded || ui.bridge.designRev >= BRIDGE_DESIGN_REV) return null;
    const rest = { ...ui.bridge.saved };
    delete rest[DEFAULT_PRESET];
    return {
      designRev: BRIDGE_DESIGN_REV,
      saved: rest,
      ...(ui.bridge.preset === DEFAULT_PRESET ? { layout: null } : {}),
    };
  }, [loaded, ui.bridge.designRev, ui.bridge.saved, ui.bridge.preset]);
  useEffect(() => {
    if (migration) setBridge(migration);
  }, [migration, setBridge]);

  const bridge = { ...ui.bridge, ...migration, ...local };
  const { preset, saved, removed, collapsed, epicClosed } = bridge;
  const { arranged, favorites } = bridge;
  const layouts = useMemo(
    () => arrangement(layoutNames(saved, removed), arranged, favorites),
    [saved, removed, arranged, favorites],
  );
  const persistedLayout = useMemo(
    () => bridge.layout ?? presetLayout(preset, saved),
    [bridge.layout, preset, saved],
  );
  const [dragLayout, setDragLayout] = useState<BridgeWidget[] | null>(null);
  const layout = dragLayout ?? persistedLayout;
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const update = useCallback(
    (patch: Partial<BridgeUi>) => {
      setLocal((p) => ({ ...p, ...patch }));
      setBridge(patch);
    },
    [setBridge],
  );

  /** Persist a manual layout change into the active preset (DEFAULT too). */
  const commitLayout = useCallback(
    (next: BridgeWidget[]) => {
      layoutRef.current = next;
      setDragLayout(null);
      update({ layout: next, saved: { ...saved, [preset]: next } });
    },
    [update, saved, preset],
  );

  /** Intermediate drag frames: local only, persisted on `endDrag`. */
  const previewLayout = useCallback((next: BridgeWidget[]) => {
    layoutRef.current = next;
    setDragLayout(next);
  }, []);

  /** Switch layout. */
  const applyPreset = useCallback(
    (name: string) => {
      const next = presetLayout(name, saved);
      layoutRef.current = next;
      setDragLayout(null);
      update({ layout: next, preset: name });
    },
    [update, saved],
  );

  /** Add a layout — a copy of DEFAULT — as the last hidden one. False if the name is invalid. */
  const addLayout = useCallback(
    (raw: string) => {
      const name = raw.trim();
      if (layoutNameError(name, saved)) return false;
      update({
        saved: { ...saved, [name]: compact(DEFAULT_LAYOUT) },
        arranged: { shown: layouts.shown, hidden: [...layouts.hidden, name] },
      });
      return true;
    },
    [update, saved, layouts.shown, layouts.hidden],
  );

  /** Delete a layout (anything but DEFAULT); deleting the active one switches to DEFAULT first. */
  const deleteLayout = useCallback(
    (name: string) => {
      if (name === DEFAULT_PRESET) return;
      const rest = { ...saved };
      delete rest[name];
      const without = (ns: readonly string[]) => ns.filter((n) => n !== name);
      update({
        saved: rest,
        arranged: { shown: without(layouts.shown), hidden: without(layouts.hidden) },
        favorites: without(favorites),
        ...(name === REVIEW_PRESET && !removed.includes(name)
          ? { removed: [...removed, name] }
          : {}),
        ...(preset === name
          ? { preset: DEFAULT_PRESET, layout: presetLayout(DEFAULT_PRESET, rest) }
          : {}),
      });
    },
    [update, saved, layouts, favorites, removed, preset],
  );

  /** Drop the saved override of a built-in layout (DEFAULT / REVIEW) so the built-in shows again
   *  (operator decision O7). Other saved layouts are untouched. */
  const resetLayout = useCallback(
    (name: string) => {
      if ((name !== DEFAULT_PRESET && name !== REVIEW_PRESET) || !(name in saved)) return;
      const rest = { ...saved };
      delete rest[name];
      const active = preset === name ? presetLayout(name, rest) : null;
      if (active) {
        layoutRef.current = active;
        setDragLayout(null);
      }
      update({
        saved: rest,
        removed: removed.filter((n) => n !== name),
        ...(active ? { layout: active } : {}),
      });
    },
    [update, saved, removed, preset],
  );

  /** Persist a new header/dropdown split from the layout manager. */
  const arrange = useCallback((next: Arrangement) => update({ arranged: next }), [update]);
  const nextName = nextSavedName(saved);

  /** Flips the widget relative to `current` — its EFFECTIVE state (auto-collapse included), so
   *  an auto-collapsed widget opens on click (stores `false`). Defaults to the stored flag. */
  const toggleCollapsed = useCallback(
    (id: string, current: boolean = !!collapsed[id]) =>
      update({ collapsed: { ...collapsed, [id]: !current } }),
    [update, collapsed],
  );
  const setEpicClosed = useCallback(
    (key: string, closed: boolean) => update({ epicClosed: { ...epicClosed, [key]: closed } }),
    [update, epicClosed],
  );

  const move = useCallback(
    (id: string, origin: DragOrigin, dx: number, dy: number) =>
      previewLayout(dragMove(layoutRef.current, id, origin, dx, dy)),
    [previewLayout],
  );
  const resize = useCallback(
    (id: string, origin: DragOrigin, dx: number, dy: number, corner?: ResizeCorner) =>
      previewLayout(dragResize(layoutRef.current, id, origin, dx, dy, corner)),
    [previewLayout],
  );
  const add = useCallback(
    (type: WidgetType, at?: { x: number; y: number }) =>
      commitLayout(addWidget(layoutRef.current, type, at)),
    [commitLayout],
  );
  const remove = useCallback(
    (id: string) => commitLayout(removeWidget(layoutRef.current, id)),
    [commitLayout],
  );

  /** Replace one widget's settings (title, scope, filters, …) — persists immediately. */
  const updateWidget = useCallback(
    (id: string, next: BridgeWidget) =>
      commitLayout(layoutRef.current.map((w) => (w.id === id ? next : w))),
    [commitLayout],
  );

  const closeSelection = useCallback(() => setSelection(null), []);
  const beginDrag = useCallback((id: string) => setDraggingId(id), []);
  /** Drag end: a final compact WITHOUT priority (reference parity), then persist if anything moved. */
  // Read through a ref: the pointerup listener holds the `endDrag` from drag start.
  const latest = useRef({ commitLayout, persistedLayout });
  useEffect(() => {
    latest.current = { commitLayout, persistedLayout };
  }, [commitLayout, persistedLayout]);
  const endDrag = useCallback(() => {
    setDraggingId(null);
    const settled = compact(layoutRef.current);
    if (JSON.stringify(settled) !== JSON.stringify(latest.current.persistedLayout))
      latest.current.commitLayout(settled);
    else setDragLayout(null);
  }, []);

  useEffect(() => {
    // `history.replaceState` (not the router): Next syncs it into `useSearchParams` without a
    // navigation, and other query params (filters) stay as they are.
    const params = new URLSearchParams(window.location.search);
    for (const kind of URL_KINDS) params.delete(SELECTION_PARAMS[kind]);
    if (selection && selection.kind in SELECTION_PARAMS)
      params.set(SELECTION_PARAMS[selection.kind as keyof typeof SELECTION_PARAMS], selection.id);
    const qs = params.toString();
    if (`?${qs}` === window.location.search || (!qs && !window.location.search)) return;
    window.history.replaceState(window.history.state, "", qs ? `?${qs}` : window.location.pathname);
  }, [selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = e.target;
      if (el instanceof HTMLElement && el.closest('[aria-modal="true"]')) return;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      )
        return;
      if (selection) setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  return {
    layout,
    layoutRef,
    preset,
    saved,
    layouts,
    nextName,
    collapsed,
    epicClosed,
    draggingId,
    selection,
    setSelection,
    closeSelection,
    applyPreset,
    addLayout,
    deleteLayout,
    resetLayout,
    arrange,
    toggleCollapsed,
    setEpicClosed,
    move,
    resize,
    add,
    remove,
    updateWidget,
    beginDrag,
    endDrag,
  };
}

export type BridgeState = ReturnType<typeof useBridgeState>;
