"use client";

import { cva } from "class-variance-authority";
import type { CSSProperties, PointerEvent, ReactNode, Ref } from "react";
import type { IconName } from "../../assets/icons";
import { cn } from "../../utils/cn";
import { Icon } from "../Icon/Icon";
import { MenuButton, type MenuButtonItem } from "../MenuButton/MenuButton";

export enum WidgetFrameTestId {
  Root = "widget-frame-root",
  Header = "widget-frame-header",
  Label = "widget-frame-label",
  Count = "widget-frame-count",
  You = "widget-frame-you",
  Aside = "widget-frame-aside",
  /** The per-widget "sync" button (disabled + spinning while `refreshing`). */
  Refresh = "widget-frame-refresh",
  Collapse = "widget-frame-collapse",
  /** The per-widget "add" (+) toggle (aria-pressed). */
  Add = "widget-frame-add",
  /** The per-widget filters toggle (funnel, aria-pressed; `data-active` while a pick is applied). */
  Filters = "widget-frame-filters",
  /** The per-widget settings (gear) button. */
  Settings = "widget-frame-settings",
  /** Wrapper of the folded "⋯" controls menu (`compactControls`). */
  Controls = "widget-frame-controls",
  Body = "widget-frame-body",
  /** Plain wrapper around the children inside the body (hidden while the empty state shows). */
  Content = "widget-frame-content",
  /** The empty state (widget-type icon, centred in the body) shown while `empty`. */
  Empty = "widget-frame-empty",
  /** The first-load spinner row (role=status) shown above the children while `loading`. */
  Loading = "widget-frame-loading",
  Size = "widget-frame-size",
  /** Resize handle prefix; each corner handle is suffixed `-nw|ne|sw|se`. */
  Resize = "widget-frame-resize",
}

/** Which corner a resize drag started from. */
export type ResizeCorner = "nw" | "ne" | "sw" | "se";

export interface WidgetFrameProps {
  label: string;
  /** Item count, shown tabular next to the label. */
  count?: string;
  /** "Needs you" pill text, e.g. `2 for you` — the header's only amber element. Hidden when empty. */
  you?: string;
  /** Right-aligned grey header note (e.g. `All clear`). */
  aside?: string;
  /** Container level — frame look and title size. `collapsed` implies `collapsed`. Default `standard`. */
  tier?: WidgetTier;
  /** Body shape of the widget, emitted as `data-species`. */
  species?: WidgetSpecies;
  /** Narrow widgets: refresh, filters and collapse stay inline; the rest (add, settings) fold into a "⋯" menu. */
  compactControls?: boolean;
  /** Accessible name of the "⋯" trigger. */
  controlsLabel?: string;
  /** Shows a header sync button left of the caret; disabled and spinning while `refreshing`. */
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshLabel?: string;
  /** Body hidden, header only. */
  collapsed?: boolean;
  /** Shows the chevron caret (always the last header control) when provided. */
  onToggleCollapse?: () => void;
  collapseLabel?: string;
  /** Being dragged/resized: ink border, no geometry transition, raised z-index. */
  dragging?: boolean;
  /**
   * A detail sheet is open beside one of this widget's rows: the frame rises above the sheet's
   * dimming overlay (z 31, under the sheet's 32) so it stays fully visible while the rest dims.
   */
  anchored?: boolean;
  /** The widget has nothing to show: the body shows `emptyIcon` instead of the (still mounted) children. */
  empty?: boolean;
  /** Icon of the empty state (the widget's type glyph). */
  emptyIcon?: IconName;
  /** The widget is fetching for the first time: shows a spinner row above the children. */
  loading?: boolean;
  /** Accessible name of the loader. */
  loadingLabel?: string;
  /** `W × H` label shown bottom-left while `dragging`. */
  sizeLabel?: string;
  /** Shows a header filters toggle (funnel, `aria-pressed={filtersOpen}`) right after refresh. */
  onToggleFilters?: () => void;
  /** The filter bar is shown: toggle pressed. */
  filtersOpen?: boolean;
  /** A filter pick is applied: the toggle carries a small dot (`data-active`). */
  filtersActive?: boolean;
  filtersLabel?: string;
  /** Shows a header "add" toggle (`+`, `aria-pressed={adding}`). */
  onAdd?: () => void;
  /** The widget is in add mode: toggle pressed, body forced open. */
  adding?: boolean;
  addLabel?: string;
  /** Shows a header settings button (gear). */
  onSettings?: () => void;
  settingsLabel?: string;
  /** Header pointer-down — start a move drag. */
  onMovePointerDown?: (e: PointerEvent<HTMLElement>) => void;
  /** Resize handle pointer-down — start a resize drag from `corner`. */
  onResizePointerDown?: (e: PointerEvent<HTMLElement>, corner: ResizeCorner) => void;
  resizeLabel?: string;
  /** Corner names appended to `resizeLabel` so each handle has a distinct accessible name. */
  resizeCornerLabels?: Partial<Record<ResizeCorner, string>>;
  /** Geometry passthrough — `left/top/width/height` set by the board. */
  style?: CSSProperties;
  /** Widget content. Always mounted (hidden while closed) so the widget keeps
   *  reporting its own emptiness. */
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

const RESIZE_HANDLES: Record<ResizeCorner, string> = {
  nw: "-left-px -top-px cursor-nwse-resize border-l-2 border-t-2",
  ne: "-right-px -top-px cursor-nesw-resize border-r-2 border-t-2",
  sw: "-bottom-px -left-px cursor-nesw-resize border-b-2 border-l-2",
  se: "-bottom-px -right-px cursor-nwse-resize border-b-2 border-r-2",
};

const CORNER_NAMES: Record<ResizeCorner, string> = {
  nw: "top left",
  ne: "top right",
  sw: "bottom left",
  se: "bottom right",
};

/** Container level of a board widget (Bridge redesign spec §2 / §6). */
export type WidgetTier = "hero" | "primary" | "standard" | "ambient" | "collapsed";

/** Body shape of a board widget (spec §4 / §9) — emitted as `data-species`. */
export type WidgetSpecies =
  | "hero"
  | "stackList"
  | "groupedList"
  | "statusRail"
  | "timeline"
  | "tileGrid"
  | "meters"
  | "decisionCards"
  | "feed"
  | "readingList"
  | "paper"
  | "chipPalette"
  | "launcher";

const frame = cva(
  "group absolute box-border flex min-w-0 flex-col rounded-[10px] border transition-[left,top,width,height,border-color] duration-150 ease-out motion-reduce:transition-none",
  {
    variants: {
      tier: {
        hero: "border-transparent bg-transparent",
        primary:
          "border-accent/20 bg-linear-to-b from-tier1-from to-tier1-to shadow-[var(--shadow-t1)]",
        standard: "border-line bg-panel",
        ambient: "border-transparent bg-transparent hover:border-line focus-within:border-line",
        collapsed: "border-dashed border-line-2 bg-transparent",
      },
    },
  },
);

/** Title type per tier. Plain strings, not `cn`: tailwind-merge would read the custom
 *  `text-widget-*` size as a colour and drop it next to `text-ink`. */
const TITLE: Record<WidgetTier, string> = {
  hero: "text-widget-t2 text-ink",
  primary: "text-widget-t1 text-ink",
  standard: "text-widget-t2 text-ink",
  ambient: "text-widget-t3 text-ink-2",
  collapsed: "text-widget-t3 text-ink-2",
};

/** Hidden until the frame is hovered / holds focus — never `display:none`, so it stays focusable. */
const reveal =
  "opacity-0 transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100";

/** A header control: revealed on hover/focus, always shown while it carries state. */
const headerBtn = (shown: boolean) =>
  cn(
    "cursor-pointer bg-transparent px-[6px] py-[2px] text-ink-3 hover:text-ink",
    shown ? "text-ink" : reveal,
  );

const stop = (e: PointerEvent<HTMLElement>) => e.stopPropagation();

/**
 * A board widget's chrome: tiered frame (`tier` → hero / primary / standard / ambient /
 * collapsed), header (grip · title · count · "N for you" pill · aside · controls), scrolling
 * body, and the always-on affordances (header move cursor, four corner resize handles; size
 * label while dragging). Controls fade in on hover / focus-within and stay visible while
 * pressed; `compactControls` folds all but refresh / filters / collapse into a "⋯" menu. Positioned `absolute` — the caller
 * supplies geometry via `style` inside a `WidgetBoard`. Sizes read the `--bridge-*` density
 * variables.
 */
export function WidgetFrame({
  label,
  count,
  you,
  aside,
  tier = "standard",
  species,
  compactControls = false,
  controlsLabel,
  onRefresh,
  refreshing = false,
  refreshLabel,
  collapsed: collapsedProp = false,
  onToggleCollapse,
  collapseLabel,
  dragging = false,
  anchored = false,
  empty = false,
  emptyIcon = "check",
  loading = false,
  loadingLabel,
  sizeLabel,
  onToggleFilters,
  filtersOpen = false,
  filtersActive = false,
  filtersLabel,
  onAdd,
  adding = false,
  addLabel,
  onSettings,
  settingsLabel,
  onMovePointerDown,
  onResizePointerDown,
  resizeLabel,
  resizeCornerLabels,
  style,
  children,
  ref,
}: WidgetFrameProps) {
  const collapsed = collapsedProp || tier === "collapsed";
  const open = adding || !collapsed;
  const showEmpty = empty && !adding;
  const hero = tier === "hero";
  const filtersShown = filtersOpen || filtersActive;

  // Header buttons — shared by the inline row and the compact (folded) layout.
  const refreshBtn = onRefresh ? (
    <button
      aria-label={refreshLabel ?? "Sync"}
      className={cn(headerBtn(refreshing), "disabled:cursor-default disabled:opacity-60")}
      data-testid={WidgetFrameTestId.Refresh}
      disabled={refreshing}
      onClick={onRefresh}
      onPointerDown={stop}
      title={refreshLabel ?? "Sync"}
      type="button"
    >
      <span className={cn("block", refreshing && "animate-spinner motion-reduce:animate-none")}>
        <Icon name="retry" size="sm" />
      </span>
    </button>
  ) : null;

  const filtersBtn = onToggleFilters ? (
    <button
      aria-label={filtersLabel ?? "Filters"}
      aria-pressed={filtersOpen}
      className={cn(headerBtn(filtersShown), "relative")}
      data-active={filtersActive || undefined}
      data-testid={WidgetFrameTestId.Filters}
      onClick={onToggleFilters}
      onPointerDown={stop}
      title={filtersLabel ?? "Filters"}
      type="button"
    >
      <Icon name="filter" size="sm" />
      {filtersActive ? (
        <span className="absolute right-[3px] top-[1px] h-[5px] w-[5px] rounded-full bg-ink" />
      ) : null}
    </button>
  ) : null;

  const addBtn = onAdd ? (
    <button
      aria-label={addLabel ?? "Add"}
      aria-pressed={adding}
      className={headerBtn(adding)}
      data-testid={WidgetFrameTestId.Add}
      onClick={onAdd}
      onPointerDown={stop}
      title={addLabel ?? "Add"}
      type="button"
    >
      <Icon name="plus" size="sm" />
    </button>
  ) : null;

  const settingsBtn = onSettings ? (
    <button
      aria-label={settingsLabel ?? "Settings"}
      className={headerBtn(false)}
      data-testid={WidgetFrameTestId.Settings}
      onClick={onSettings}
      onPointerDown={stop}
      title={settingsLabel ?? "Settings"}
      type="button"
    >
      <Icon name="gear" size="sm" />
    </button>
  ) : null;

  const collapseBtn = onToggleCollapse ? (
    <button
      aria-expanded={!collapsed}
      aria-label={collapseLabel}
      className={headerBtn(false)}
      data-testid={WidgetFrameTestId.Collapse}
      onClick={onToggleCollapse}
      onPointerDown={stop}
      title={collapseLabel}
      type="button"
    >
      <span
        className={cn(
          "block transition-transform duration-150 motion-reduce:transition-none",
          !collapsed && "rotate-90",
        )}
      >
        <Icon name="chevron" size="sm" />
      </span>
    </button>
  ) : null;

  // Compact mode: refresh / filters / collapse stay inline; only the rest folds into "⋯".
  const menuItems: MenuButtonItem[] = [
    ...(onAdd
      ? [
          {
            id: "add",
            label: addLabel ?? "Add",
            icon: "plus" as const,
            trailing: adding ? "●" : undefined,
            onSelect: onAdd,
          },
        ]
      : []),
    ...(onSettings
      ? [
          {
            id: "settings",
            label: settingsLabel ?? "Settings",
            icon: "gear" as const,
            onSelect: onSettings,
          },
        ]
      : []),
  ];

  return (
    <section
      className={cn(
        frame({ tier }),
        anchored && "z-[31]",
        dragging && "z-[5] border-ink transition-none",
      )}
      data-anchored={anchored || undefined}
      data-species={species}
      data-testid={WidgetFrameTestId.Root}
      data-tier={tier}
      ref={ref}
      style={style}
    >
      {tier === "primary" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-px left-[18px] right-[18px] h-px bg-linear-to-r from-transparent via-accent/75 to-transparent"
        />
      ) : null}
      <header
        className={cn(
          "relative flex select-none items-center gap-[8px] pl-[var(--bridge-head-px)] pr-[10px] font-sans whitespace-nowrap",
          open
            ? "box-content h-[var(--bridge-head-h)] flex-none"
            : "box-border h-[calc(var(--bridge-rh)-2px)] flex-none",
          open && !hero && "border-b border-line",
          // Hero: no chrome at rest; the header (drag + controls) overlays the body on hover/focus.
          hero && cn("absolute inset-x-0 top-0 z-[1] rounded-t-[10px] bg-panel", reveal),
          onMovePointerDown && "cursor-move",
        )}
        data-testid={WidgetFrameTestId.Header}
        onPointerDown={onMovePointerDown}
      >
        {onMovePointerDown ? (
          <span
            aria-hidden="true"
            className="absolute left-[4px] top-1/2 -translate-y-1/2 text-[9px] leading-none tracking-[-2px] text-ink-3 opacity-0 group-hover:opacity-70 group-focus-within:opacity-70"
          >
            ⋮⋮
          </span>
        ) : null}
        <span className={TITLE[tier]} data-testid={WidgetFrameTestId.Label}>
          {label}
        </span>
        {count ? (
          <span
            className="font-mono text-[12px] tabular-nums text-ink-3"
            data-testid={WidgetFrameTestId.Count}
          >
            {count}
          </span>
        ) : null}
        {you ? (
          <span
            className="inline-flex h-[20px] items-center gap-[6px] rounded-full bg-accent-dim px-[8px] text-[11.5px] font-medium text-accent-fg"
            data-testid={WidgetFrameTestId.You}
          >
            <span
              aria-hidden="true"
              className="size-[6px] rounded-full bg-accent ring-[3px] ring-accent/20"
            />
            {you}
          </span>
        ) : null}
        <span className="flex-1" />
        {aside ? (
          <span className="text-[12px] text-ink-3" data-testid={WidgetFrameTestId.Aside}>
            {aside}
          </span>
        ) : null}
        {refreshBtn}
        {filtersBtn}
        {compactControls ? (
          menuItems.length ? (
            <span
              className={adding ? undefined : reveal}
              data-testid={WidgetFrameTestId.Controls}
              onPointerDown={stop}
            >
              <MenuButton ariaLabel={controlsLabel ?? "Widget actions"} items={menuItems} />
            </span>
          ) : null
        ) : (
          <>
            {addBtn}
            {settingsBtn}
          </>
        )}
        {collapseBtn}
      </header>
      <div
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        data-testid={WidgetFrameTestId.Body}
        hidden={!open}
      >
        {showEmpty ? (
          <div
            className="absolute inset-0 flex items-center justify-center text-ink-3 [&_svg]:size-[28px]"
            data-testid={WidgetFrameTestId.Empty}
          >
            <Icon name={emptyIcon} size="xl" />
          </div>
        ) : null}
        <div className="flow-root" data-testid={WidgetFrameTestId.Content} hidden={showEmpty}>
          {loading ? (
            <div
              aria-label={loadingLabel}
              className="px-[var(--bridge-head-px)] py-[10px]"
              data-testid={WidgetFrameTestId.Loading}
              role="status"
            >
              <span className="block h-3 w-3 rounded-full border-[1.5px] border-ink-2/30 border-t-ink-2 animate-spinner motion-reduce:animate-none" />
            </div>
          ) : null}
          {children}
        </div>
      </div>
      {dragging ? (
        <span
          className="absolute bottom-[6px] left-[12px] rounded-sm bg-panel px-[4px] py-[2px] font-mono text-[10px] text-ink-3"
          data-testid={WidgetFrameTestId.Size}
        >
          {sizeLabel}
        </span>
      ) : null}
      {/* No resize handler (e.g. a read-only stacked board) — no handles. */}
      {(onResizePointerDown ? (Object.keys(RESIZE_HANDLES) as ResizeCorner[]) : []).map(
        (corner) => {
          const name = `${resizeLabel ?? "Resize"} (${resizeCornerLabels?.[corner] ?? CORNER_NAMES[corner]})`;
          return (
            <div
              aria-label={name}
              className={cn(
                "absolute box-border h-[12px] w-[12px] border-ink",
                "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                dragging && "opacity-100",
                RESIZE_HANDLES[corner],
              )}
              data-testid={`${WidgetFrameTestId.Resize}-${corner}`}
              key={corner}
              onPointerDown={(e) => onResizePointerDown?.(e, corner)}
              role="separator"
              title={name}
            />
          );
        },
      )}
    </section>
  );
}
