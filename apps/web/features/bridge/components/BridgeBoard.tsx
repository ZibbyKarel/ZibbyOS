"use client";

import {
  BRIDGE_DENSITY,
  Container,
  Panel,
  Stack,
  SummaryRow,
  Typography,
  WidgetBoard,
  WidgetFrame,
  type WidgetTier,
} from "@zibby/design-system";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  type CSSProperties,
  Fragment,
  type PointerEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  type BridgeWidget,
  type DragOrigin,
  freeSlot,
  phoneOrder,
  toCells,
  viewLayout,
} from "../grid/layout";
import { BridgePresetContext } from "../widgets/BriefingWidget";
import type { BridgeState } from "../state/useBridgeState";
import { useWidgetPriority } from "../state/useWidgetPriority";
import { WIDGET_REFRESH_KEYS } from "../widgets/refreshKeys";
import { type BridgeSelection, type BridgeWidgetInfo, WIDGETS } from "../widgets/registry";
import { boardHeight, colWidth, widgetRect } from "../grid/positions";
import { AddWidgetSlot } from "./AddWidgetSlot";
import { WidgetSettingsDialog } from "./WidgetSettingsDialog";
import type { Density, ResizeCorner } from "@zibby/design-system";

const widgetRectStyle = (
  w: Pick<BridgeWidget, "x" | "y" | "w" | "h">,
  colW: number,
  gap: number,
  rowH: number,
): CSSProperties => {
  const r = widgetRect(w, colW, gap, rowH);
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/** Pointer travel (px) before a header/corner press becomes a drag. */
const DRAG_THRESHOLD = 4;

const pad2 = (n: number) => String(n).padStart(2, "0");

interface HostProps {
  widget: BridgeWidget;
  state: BridgeState;
  sheetSide: "left" | "right";
  onOpen: (selection: BridgeSelection) => void;
  empty: boolean;
  adding: boolean;
  tier: WidgetTier;
  /** The open detail sheet is anchored to one of this widget's rows: stays undimmed. */
  anchored: boolean;
  info: BridgeWidgetInfo | undefined;
  style: CSSProperties;
  onEmpty: (id: string, empty: boolean) => void;
  onInfo: (id: string, info: BridgeWidgetInfo) => void;
  onToggleAdd: (id: string) => void;
  onSettings: (id: string) => void;
  /** Omitted on the stacked phone board — no move/resize there. */
  onDragStart?: (id: string, mode: "move" | ResizeCorner, e: PointerEvent<HTMLElement>) => void;
}

/** One widget: its frame chrome + the registry body, wired to board state. */
function BridgeWidgetHost({
  widget,
  state,
  sheetSide,
  onOpen,
  empty,
  adding,
  tier,
  anchored,
  info,
  style,
  onEmpty,
  onInfo,
  onToggleAdd,
  onSettings,
  onDragStart,
}: HostProps) {
  const t = useTranslations();
  const { id } = widget;
  const def = WIDGETS[widget.type];
  const onEmptyChange = useCallback((e: boolean) => onEmpty(id, e), [onEmpty, id]);
  const onCountChange = useCallback((i: BridgeWidgetInfo) => onInfo(id, i), [onInfo, id]);
  // Per-widget, in-memory only: closed on every load.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const collapsed = tier === "collapsed";
  // Default refresh: re-fetch this widget's own queries (a widget's own sync overrides it).
  const qc = useQueryClient();
  const keys = WIDGET_REFRESH_KEYS[widget.type];
  const [refetching, setRefetching] = useState(false);
  const onDefaultRefresh = useMemo(
    () =>
      keys &&
      (() => {
        setRefetching(true);
        void Promise.allSettled(keys.map((queryKey) => qc.invalidateQueries({ queryKey }))).then(
          () => setRefetching(false),
        );
      }),
    [keys, qc],
  );

  return (
    <WidgetFrame
      addLabel={t("bridge.add")}
      adding={adding}
      alert={info?.alert}
      anchored={anchored}
      aside={empty && !adding ? t("bridge.allClear") : info?.aside}
      collapseLabel={t("bridge.collapse")}
      compactControls={widget.w < 4}
      controlsLabel={t("bridge.controls")}
      count={
        info?.count === undefined
          ? undefined
          : tier === "ambient"
            ? String(info.count)
            : pad2(info.count)
      }
      dragging={state.draggingId === id}
      empty={empty}
      emptyIcon={def.icon}
      filtersActive={info?.filtersActive}
      filtersLabel={t("bridge.filters")}
      filtersOpen={filtersOpen}
      label={widget.title ?? t(def.labelKey)}
      loading={info?.loading}
      loadingLabel={t("bridge.loading")}
      onAdd={def.addable ? () => onToggleAdd(id) : undefined}
      onMovePointerDown={onDragStart && ((e) => onDragStart(id, "move", e))}
      onRefresh={info?.onRefresh ?? onDefaultRefresh}
      onResizePointerDown={onDragStart && ((e, corner) => onDragStart(id, corner, e))}
      onSettings={() => onSettings(id)}
      // The hero never collapses, so it gets no caret.
      onToggleCollapse={tier === "hero" ? undefined : () => state.toggleCollapsed(id, collapsed)}
      onToggleFilters={def.Filters ? () => setFiltersOpen((o) => !o) : undefined}
      refreshLabel={t("bridge.refresh")}
      refreshing={info?.onRefresh ? info.refreshing : refetching}
      resizeCornerLabels={{
        nw: t("bridge.resizeNw"),
        ne: t("bridge.resizeNe"),
        sw: t("bridge.resizeSw"),
        se: t("bridge.resizeSe"),
      }}
      resizeLabel={t("bridge.resize")}
      settingsLabel={t("bridge.settings.open")}
      sizeLabel={`${widget.w} × ${widget.h}`}
      species={def.species}
      style={style}
      tier={tier}
      you={info?.you ? t("bridge.you", { n: info.you }) : undefined}
    >
      <def.Component
        adding={adding}
        epicClosed={state.epicClosed}
        filtersOpen={filtersOpen}
        onCountChange={onCountChange}
        onEmptyChange={onEmptyChange}
        onEpicToggle={state.setEpicClosed}
        onOpen={onOpen}
        selection={state.selection}
        sheetSide={sheetSide}
        widget={widget}
      />
    </WidgetFrame>
  );
}

export interface BridgeBoardProps {
  state: BridgeState;
  density: Density;
  sheetSide?: "left" | "right";
  /** Phone view (spec §6): one column — hero, primary, standard — then ambient + collapsed
   *  widgets as summary rows under "Other" that open in place; no drag/resize. */
  stacked?: boolean;
  /** What a row click does — defaults to opening the detail sheet. */
  onOpen?: (selection: BridgeSelection) => void;
}

/**
 * The widget board: measures its width, derives the column width from the density table
 * and positions each widget at the fixed width × height from the layout. Each widget's tier comes
 * from its reported score (`useWidgetPriority`); collapsed-tier widgets shrink to one row (and the board compacts); while a drag is in progress it shows the raw layout. Header drag moves, corners resize — always on.
 */
export function BridgeBoard({
  state,
  density,
  sheetSide = "right",
  stacked = false,
  onOpen,
}: BridgeBoardProps) {
  const t = useTranslations();
  const { gap, rowHeight } = BRIDGE_DENSITY[density];
  const { layout, collapsed, draggingId } = state;
  const dragging = draggingId !== null;
  const [width, setWidth] = useState(0);
  const [empty, setEmpty] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  /** Widget whose settings dialog is open. */
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, BridgeWidgetInfo>>({});

  const onEmpty = useCallback(
    (id: string, e: boolean) => setEmpty((p) => (p[id] === e ? p : { ...p, [id]: e })),
    [],
  );
  // Forget the + toggle of a removed widget (a re-added widget with the same id starts closed).
  const onRemove = (id: string) => {
    setAdding((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== id)));
    state.remove(id);
  };
  const onToggleAdd = useCallback((id: string) => setAdding((p) => ({ ...p, [id]: !p[id] })), []);
  const onInfo = useCallback(
    (id: string, i: BridgeWidgetInfo) =>
      setInfo((p) => {
        const prev = p[id];
        return prev &&
          prev.count === i.count &&
          prev.you === i.you &&
          prev.urgency === i.urgency &&
          prev.aside === i.aside &&
          prev.onRefresh === i.onRefresh &&
          prev.refreshing === i.refreshing &&
          prev.filtersActive === i.filtersActive &&
          prev.alert === i.alert &&
          prev.loading === i.loading
          ? p
          : { ...p, [id]: i };
      }),
    [],
  );

  const tiers = useWidgetPriority(layout, info, empty, collapsed);
  const shown = useMemo(() => {
    if (dragging) return layout;
    const shrink = new Set(
      layout.filter((w) => !adding[w.id] && tiers[w.id] === "collapsed").map((w) => w.id),
    );
    return viewLayout(layout, shrink);
  }, [dragging, layout, tiers, adding]);
  const phone = useMemo(() => phoneOrder(layout, tiers), [layout, tiers]);
  /** Phone summary rows opened in place — local, not persisted. */
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const settingsWidget = layout.find((w) => w.id === settingsId);

  const colW = colWidth(width, gap);

  /** Empty spot under the pointer (cell + free size) — shows the "Add widget" ghost; kept while its picker is open. */
  const [slot, setSlot] = useState<ReturnType<typeof freeSlot>>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const onPickerOpen = useCallback((open: boolean) => {
    setPickerOpen(open);
    if (!open) setSlot(null);
  }, []);
  const onHover = (e: PointerEvent<HTMLElement>) => {
    // Only the bare surface counts — moving over the ghost itself keeps it where it is.
    if (pickerOpen || dragging || e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (colW + gap));
    const y = Math.floor((e.clientY - r.top) / (rowHeight + gap));
    setSlot((p) => {
      const next = freeSlot(shown, x, y);
      return p && next && p.x === next.x && p.y === next.y && p.w === next.w && p.h === next.h
        ? p
        : next;
    });
  };

  const onDragStart = (id: string, mode: "move" | ResizeCorner, e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const it = state.layoutRef.current.find((w) => w.id === id);
    if (!it) return;
    const origin = { x: it.x, y: it.y, w: it.w, h: it.h };
    const [sx, sy] = [e.clientX, e.clientY];
    const apply =
      mode === "move"
        ? state.move
        : (i: string, o: DragOrigin, dx: number, dy: number) => state.resize(i, o, dx, dy, mode);
    let started = false;
    // A plain click must not flip the board to the raw layout: drag only after DRAG_THRESHOLD px.
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
        started = true;
        state.beginDrag(id);
      }
      const { dx, dy } = toCells(ev.clientX - sx, ev.clientY - sy, colW, gap, rowHeight);
      apply(id, origin, dx, dy);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (started) state.endDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const host = (w: BridgeWidget, tier: WidgetTier, style: CSSProperties) => (
    <BridgeWidgetHost
      adding={!!adding[w.id]}
      anchored={state.selection?.widgetId === w.id}
      empty={!!empty[w.id]}
      info={info[w.id]}
      key={w.id}
      onDragStart={stacked ? undefined : onDragStart}
      onEmpty={onEmpty}
      onInfo={onInfo}
      onOpen={onOpen ?? state.setSelection}
      onSettings={setSettingsId}
      onToggleAdd={onToggleAdd}
      sheetSide={sheetSide}
      state={state}
      style={style}
      tier={tier}
      widget={w}
    />
  );
  // Phone: in-flow frames, full width, each keeping its own height (the hero sizes to content).
  const flow = (w: BridgeWidget): CSSProperties => ({
    position: "relative",
    height: w.type === "briefing" ? undefined : Math.round(widgetRect(w, 0, gap, rowHeight).height),
  });
  const summary = (w: BridgeWidget) => {
    const i = info[w.id];
    const aside = empty[w.id] ? t("bridge.allClear") : i?.aside;
    return [i?.count, aside].filter((v) => v !== undefined && v !== "").join(" · ");
  };

  return (
    <BridgePresetContext value={state.preset}>
      {stacked ? (
        <WidgetBoard colWidth={0} gap={gap}>
          <Stack direction="col" gap="150">
            {phone.lead.map((w) => host(w, tiers[w.id] ?? "standard", flow(w)))}
            {phone.rest.length ? (
              <Stack direction="col" gap="75">
                <Typography type="caption">{t("bridge.other")}</Typography>
                <Panel>
                  <Container padding={["0", "100"]}>
                    {phone.rest.map((w) => (
                      <Fragment key={w.id}>
                        <SummaryRow
                          expanded={!!openRows[w.id]}
                          icon={WIDGETS[w.type].icon}
                          label={w.title ?? t(WIDGETS[w.type].labelKey)}
                          onClick={() => setOpenRows((p) => ({ ...p, [w.id]: !p[w.id] }))}
                          value={summary(w)}
                        />
                        {/* Always mounted: the body keeps reporting its count / tier. */}
                        <Container hidden={!openRows[w.id]} padding={["100", "0"]}>
                          {host(w, "standard", flow(w))}
                        </Container>
                      </Fragment>
                    ))}
                  </Container>
                </Panel>
              </Stack>
            ) : null}
          </Stack>
        </WidgetBoard>
      ) : (
        <WidgetBoard
          colWidth={colW}
          gap={gap}
          height={Math.round(boardHeight(shown, rowHeight, gap, dragging ? 2 : 0))}
          onMeasure={setWidth}
        >
          {/* Hover surface behind the widgets: pointer events only reach it on empty spots. */}
          <Container
            bottom="0"
            left="0"
            onPointerLeave={() => !pickerOpen && setSlot(null)}
            onPointerMove={onHover}
            position="absolute"
            right="0"
            top="0"
          >
            {slot && !dragging ? (
              <AddWidgetSlot
                onOpenChange={onPickerOpen}
                onPick={(type) => state.add(type, { x: slot.x, y: slot.y })}
                style={widgetRectStyle(slot, colW, gap, rowHeight)}
              />
            ) : null}
          </Container>
          {width > 0
            ? shown.map((w) => {
                const r = widgetRect(w, colW, gap, rowHeight);
                return host(w, tiers[w.id] ?? "standard", {
                  left: Math.round(r.left),
                  top: Math.round(r.top),
                  width: Math.round(r.width),
                  height: Math.round(r.height),
                });
              })
            : null}
        </WidgetBoard>
      )}
      {settingsWidget ? (
        <WidgetSettingsDialog
          key={settingsWidget.id}
          onClose={() => setSettingsId(null)}
          onRemove={() => onRemove(settingsWidget.id)}
          onSave={(next) => state.updateWidget(settingsWidget.id, next)}
          widget={settingsWidget}
        />
      ) : null}
    </BridgePresetContext>
  );
}
