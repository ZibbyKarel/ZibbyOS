"use client";

import { type KeyboardEvent, type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import type { IconName } from "../../assets/icons";
import type { StateTone } from "../../stateTone";
import { cn } from "../../utils/cn";
import { Icon } from "../Icon/Icon";
import { StateDot } from "../StatePill/StatePill";
import { type SheetPresentation, useSheetPresentation } from "./sheetPresentation";
import type { SheetTone } from "./sheetTone";

export enum AnchoredSheetTestId {
  Overlay = "anchored-sheet-overlay",
  Root = "anchored-sheet-root",
  Eraser = "anchored-sheet-eraser",
  Header = "anchored-sheet-header",
  Glyph = "anchored-sheet-glyph",
  Kind = "anchored-sheet-kind",
  CopyId = "anchored-sheet-copy-id",
  Back = "anchored-sheet-back",
  StepPrev = "anchored-sheet-step-prev",
  StepNext = "anchored-sheet-step-next",
  StepPosition = "anchored-sheet-step-position",
  Expand = "anchored-sheet-expand",
  ResizeHandle = "anchored-sheet-resize-handle",
  State = "anchored-sheet-state",
  Hint = "anchored-sheet-hint",
  Close = "anchored-sheet-close",
  Title = "anchored-sheet-title",
  TitleLink = "anchored-sheet-title-link",
  Actions = "anchored-sheet-actions",
  ActionBar = "anchored-sheet-action-bar",
  StateRow = "anchored-sheet-state-row",
  Chip = "anchored-sheet-chip",
  Meta = "anchored-sheet-meta",
  Trail = "anchored-sheet-trail",
  Banner = "anchored-sheet-banner",
  Body = "anchored-sheet-body",
  Composer = "anchored-sheet-composer",
  Footer = "anchored-sheet-footer",
  FooterNote = "anchored-sheet-footer-note",
}

/** One state pill in the header: tone colour; a `loud` pill glows (the "needs me" amber). */
export interface SheetStateTone {
  tone: StateTone;
  label: string;
  loud?: boolean;
}

export interface AnchoredSheetProps {
  /** Kind label in row 1, e.g. `Pull request` (caps by CSS). */
  kind: ReactNode;
  /** Neutral 24px glyph of the kind (PR = `branch`, run = `run`, …). */
  glyph?: IconName;
  /** The copyable id next to the kind (e.g. `#12`, a run id). */
  copyId?: string;
  copyLabel?: string;
  /** Replaces the id for 1.2 s after a copy. */
  copiedLabel?: string;
  /** Single-pill fallback when `tones` is absent: the pill label (coloured by `tone`). */
  stateLabel?: string;
  /** State pills, max 2 shown, most severe first. Wins over `stateLabel` + `tone`. */
  tones?: readonly SheetStateTone[];
  /** Right-aligned hint in row 1. */
  hint?: string;
  title: string;
  /** Makes the title a link-style button (e.g. open the full page of what the sheet shows). */
  onTitleClick?: () => void;
  /** Title opens this URL in a new tab (wins over `onTitleClick`). */
  titleHref?: string;
  /**
   * The sheet's ONLY action slot: right of the title, top-right of the sheet. Every sheet puts
   * its buttons here so they sit in the same place whatever the body shows. Wraps as one group.
   */
  actions?: ReactNode;
  /**
   * Secondary actions (a ⋯ menu, …) that sit right after `actions` in the header. On a `page` they
   * stay in the header while `actions` alone move to the bottom bar.
   */
  moreActions?: ReactNode;
  /** Free-form meta in the state row (e.g. `head → base` with copy buttons and a diffstat). */
  meta?: ReactNode;
  /** Meta chips under the state row. */
  chips?: readonly string[];
  /** Last header row (e.g. a PR stack). */
  trail?: ReactNode;
  /** Colour of the `stateLabel` pill. `neutral` / `faint` read as idle. */
  tone?: SheetTone;
  /** Back button `← <backLabel>` (shown only with `onBack`): the sheet this one was opened from. */
  onBack?: () => void;
  backLabel?: string;
  /** Accessible name of the back button; defaults to `Back to <backLabel>`. */
  backAriaLabel?: string;
  /** ↑ / ↓ buttons step through the anchored widget's rows (shown only with `onStep`). */
  onStep?: (dir: -1 | 1) => void;
  /** 0-based position of the open row among its widget's rows — the `3 / 8` counter. */
  stepPosition?: { index: number; total: number };
  stepPrevLabel?: string;
  stepNextLabel?: string;
  /** Shows the ⤢ toggle. */
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  expandLabel?: string;
  shrinkLabel?: string;
  onClose: () => void;
  closeLabel: string;
  /** Geometry (px) inside the nearest positioned ancestor, which the overlay also fills. */
  left: number;
  width: number;
  top: number;
  height: number;
  /**
   * Shows a drag handle on the edge away from the anchor (`resizeEdge`). `onResize` gets the raw
   * proposed width (px) while dragging (the caller snaps / clamps and feeds it back via `width`);
   * `onResizeEnd` gets the last one. Arrow keys on the focused handle step by `resizeStep` px.
   * Ignored on a `page`.
   */
  onResize?: (widthPx: number) => void;
  onResizeEnd?: (widthPx: number) => void;
  resizeEdge?: "left" | "right";
  resizeStep?: number;
  /** Bounds (px) exposed as `aria-valuemin` / `aria-valuemax`; the caller still enforces them. */
  resizeMin?: number;
  resizeMax?: number;
  resizeLabel?: string;
  /** Optional strip on the shared edge (same colour as the sheet) at the row's height. */
  eraserLeft?: number;
  eraserTop?: number;
  eraserHeight?: number;
  /** At most one banner between the header and the body (see `SheetBanner`). */
  banner?: ReactNode;
  /** Pinned under the body, above the footer (e.g. a run's message composer). */
  composer?: ReactNode;
  /** One-sentence status note in the footer (no actions — those go in `actions`). */
  footerNote?: string;
  /** Free-form footer (an inline form, e.g. a reject reason) — rendered full-width instead of the note. */
  footer?: ReactNode;
  /** The body doesn't scroll: it's a flex column whose `SheetSection fill` child takes all of
   *  the height (a full-height editor). Default `false` — the body scrolls. */
  fillBody?: boolean;
  /** Scrolling body — compose with `SheetSection` / `SheetBlock` / the other detail primitives. */
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  /**
   * `panel`: fills its positioned parent (docked side slot), no dimming, resize, stepping or expand. `page`: a full-screen page (phone) — geometry props are ignored, no dimming overlay, a back
   * button replaces ✕, `actions` move to a pinned bottom bar (`moreActions` stay in the header), stepping and expand are dropped, body
   * scroll is locked and focus is trapped. Defaults to the nearest `SheetPresentationContext`.
   */
  presentation?: SheetPresentation;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SEVERITY: Record<StateTone, number> = {
  error: 0,
  blocked: 1,
  working: 2,
  thinking: 3,
  done: 4,
  idle: 5,
};

// Full class strings per tone so Tailwind's scanner sees them. Amber text is `accent-fg`.
const PILL: Record<StateTone, string> = {
  error: "bg-[color-mix(in_srgb,var(--color-state-err)_12%,transparent)] text-state-err",
  blocked: "bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-accent-fg",
  working: "bg-[color-mix(in_srgb,var(--color-state-work)_12%,transparent)] text-state-work",
  thinking: "bg-[color-mix(in_srgb,var(--color-state-think)_10%,transparent)] text-state-think",
  done: "bg-[color-mix(in_srgb,var(--color-state-done)_10%,transparent)] text-state-done",
  idle: "bg-[color-mix(in_srgb,var(--color-ink)_5%,transparent)] text-ink-2",
};
const LOUD =
  "shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_40%,transparent),0_0_18px_-4px_color-mix(in_srgb,var(--color-accent)_50%,transparent)]";

/** `tone` (sheet vocabulary) → pill tone: the neutral stripes read as idle. */
const pillTone = (t: SheetTone): StateTone => (t === "neutral" || t === "faint" ? "idle" : t);

/** Most severe first, max 2. */
export function sheetPills(tones: readonly SheetStateTone[]): SheetStateTone[] {
  return [...tones].sort((a, b) => SEVERITY[a.tone] - SEVERITY[b.tone]).slice(0, 2);
}

const iconBtn =
  "grid size-[24px] flex-none cursor-pointer place-items-center rounded-[7px] bg-transparent text-ink-3 hover:bg-panel-2 hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent";

function CopyId({ id, label, copied }: { id: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), 1200);
    return () => clearTimeout(timer);
  }, [done]);
  return (
    <button
      aria-label={`${label} ${id}`}
      className="group inline-flex min-w-0 cursor-pointer items-center gap-[5px] whitespace-nowrap rounded-[6px] bg-transparent px-[6px] py-[2px] font-mono text-[12px] text-ink-2 hover:bg-panel-2 hover:text-ink"
      data-testid={AnchoredSheetTestId.CopyId}
      onClick={() =>
        navigator.clipboard?.writeText(id).then(
          () => setDone(true),
          () => {},
        )
      }
      title={label}
      type="button"
    >
      <span aria-live="polite" className="truncate">
        {done ? copied : id}
      </span>
      <span
        className={cn(
          "transition-opacity",
          done ? "opacity-80" : "opacity-0 group-hover:opacity-80 group-focus-visible:opacity-80",
        )}
      >
        <Icon name={done ? "check" : "copy"} size="xs" />
      </span>
    </button>
  );
}

/**
 * A detail sheet beside a row: a dimming overlay (`--bg` 68%, click closes — the board marks the
 * anchored widget above it) plus a `--sheet` surface (radius 12, `--shadow-pop`). Header row 1:
 * kind glyph · KIND · copyable id · ← back · ↑↓ `n / N` · ⤢ · ✕; row 2: title + actions
 * top-right; row 3: state pills (tone colour) + kind meta. Then at most one banner, the scrolling
 * body, an optional composer and the footer note. Geometry is supplied by the caller (see the
 * Bridge's `measure`). Render inside a `relative` container.
 */
export function AnchoredSheet({
  kind,
  glyph,
  copyId,
  copyLabel = "Copy",
  copiedLabel = "Copied",
  stateLabel,
  tones,
  hint,
  title,
  onTitleClick,
  titleHref,
  actions,
  moreActions,
  meta,
  chips = [],
  trail,
  tone = "neutral",
  onBack,
  backLabel = "",
  backAriaLabel,
  onStep,
  stepPosition,
  stepPrevLabel = "Previous",
  stepNextLabel = "Next",
  expandable = false,
  expanded = false,
  onToggleExpand,
  expandLabel = "Expand",
  shrinkLabel = "Shrink",
  onClose,
  closeLabel,
  left,
  width,
  top,
  height,
  onResize,
  onResizeEnd,
  resizeEdge = "right",
  resizeStep = 40,
  resizeMin,
  resizeMax,
  resizeLabel = "Resize sheet",
  eraserLeft = 0,
  eraserTop = 0,
  eraserHeight = 0,
  banner,
  composer,
  footerNote,
  footer,
  fillBody = false,
  children,
  ref,
  presentation,
}: AnchoredSheetProps) {
  const ctx = useSheetPresentation();
  const mode = presentation ?? ctx;
  const page = mode === "page";
  // `panel` fills its positioned parent; it keeps the anchored header but has no row to anchor to.
  const panel = mode === "panel";
  const free = !page && !panel;
  const root = useRef<HTMLDivElement | null>(null);
  const setRoot = (el: HTMLDivElement | null) => {
    root.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  // A page owns the screen: lock the scroll behind it, move focus in, hand it back on close.
  useEffect(() => {
    if (!page) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      if (prevFocus?.isConnected) prevFocus.focus();
    };
  }, [page]);
  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!page || e.key !== "Tab" || !root.current) return;
    const items = Array.from(root.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items.at(0);
    const last = items.at(-1);
    const active = document.activeElement;
    if (!first || !last) e.preventDefault();
    else if (e.shiftKey && (active === first || active === root.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  // Drag: the width is `start + dx` (mirrored for a left edge), computed from the width at pointer-down.
  const drag = useRef<{ x: number; width: number; last: number } | null>(null);
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (d) onResizeEnd?.(d.last);
  };
  const sign = resizeEdge === "right" ? 1 : -1;
  const pills = sheetPills(
    tones ?? (stateLabel ? [{ tone: pillTone(tone), label: stateLabel }] : []),
  );
  const pos = stepPosition;
  return (
    <>
      {free ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-30 bg-[color-mix(in_srgb,var(--color-bg)_68%,transparent)]"
          data-testid={AnchoredSheetTestId.Overlay}
          onClick={onClose}
        />
      ) : null}
      <div
        aria-label={title}
        aria-modal={page ? "true" : "false"}
        className={cn(
          "box-border flex flex-col overflow-hidden bg-sheet leading-[normal] text-ink",
          page
            ? "fixed inset-0 z-[60] outline-none"
            : panel
              ? "absolute inset-0 z-[32]"
              : "absolute z-[32] rounded-[12px] border border-line-2 shadow-[var(--shadow-pop)]",
        )}
        data-expanded={expanded || undefined}
        data-presentation={mode}
        data-testid={AnchoredSheetTestId.Root}
        onKeyDown={trapTab}
        ref={setRoot}
        role="dialog"
        style={free ? { left, top, width, height } : undefined}
        tabIndex={page ? -1 : undefined}
      >
        {free && onResize ? (
          <div
            aria-label={resizeLabel}
            aria-orientation="vertical"
            aria-valuemax={resizeMax === undefined ? undefined : Math.round(resizeMax)}
            aria-valuemin={resizeMin === undefined ? undefined : Math.round(resizeMin)}
            aria-valuenow={Math.round(width)}
            className={cn(
              "group absolute inset-y-0 z-[2] w-[8px] cursor-ew-resize touch-none",
              resizeEdge === "right" ? "right-0" : "left-0",
            )}
            data-testid={AnchoredSheetTestId.ResizeHandle}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const next = width + (e.key === "ArrowRight" ? 1 : -1) * sign * resizeStep;
              onResize(next);
              onResizeEnd?.(next);
            }}
            onLostPointerCapture={endDrag}
            onPointerCancel={endDrag}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              drag.current = { x: e.clientX, width, last: width };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              d.last = d.width + sign * (e.clientX - d.x);
              onResize(d.last);
            }}
            role="separator"
            tabIndex={0}
          >
            <span className="absolute inset-y-0 left-[4px] w-[2px] rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" />
          </div>
        ) : null}
        {free && eraserHeight > 0 ? (
          <div
            className="absolute w-[3px] bg-sheet"
            data-testid={AnchoredSheetTestId.Eraser}
            style={{ left: eraserLeft, top: eraserTop, height: eraserHeight }}
          />
        ) : null}
        <div
          className={cn(
            "flex flex-none flex-col gap-[8px] border-b border-line",
            page
              ? "pb-[12px] pl-[16px] pr-[10px] pt-[max(env(safe-area-inset-top),8px)]"
              : "py-[12px] pl-[18px] pr-[14px]",
          )}
          data-testid={AnchoredSheetTestId.Header}
        >
          <div className="flex min-h-[28px] items-center gap-[8px]">
            {page && !onBack ? (
              <button
                aria-label={closeLabel}
                className={cn(iconBtn, "-ml-[8px] size-[40px]")}
                data-testid={AnchoredSheetTestId.Close}
                onClick={onClose}
                type="button"
              >
                <span className="inline-flex rotate-180">
                  <Icon name="chevron" size="sm" />
                </span>
              </button>
            ) : null}
            {glyph ? (
              <span
                className="grid size-[24px] flex-none place-items-center rounded-[7px] border border-line-2 bg-panel-2 text-ink"
                data-testid={AnchoredSheetTestId.Glyph}
              >
                <Icon name={glyph} size="xs" />
              </span>
            ) : null}
            <span
              className="whitespace-nowrap font-sans text-[11px] font-medium uppercase tracking-[.07em] text-ink-3"
              data-testid={AnchoredSheetTestId.Kind}
            >
              {kind}
            </span>
            {copyId ? <CopyId copied={copiedLabel} id={copyId} label={copyLabel} /> : null}
            <span className="flex-1" />
            {hint ? (
              <span
                className="font-sans text-[11px] text-ink-3"
                data-testid={AnchoredSheetTestId.Hint}
              >
                {hint}
              </span>
            ) : null}
            {onBack ? (
              <button
                aria-label={backAriaLabel ?? `Back to ${backLabel}`}
                className={cn(
                  "mr-[4px] inline-flex h-[24px] max-w-[220px] cursor-pointer items-center gap-[6px] rounded-[7px] border border-line bg-panel-2 pl-[4px] pr-[8px] text-[12px] text-ink-2 hover:border-line-2 hover:text-ink",
                  page && "h-[32px]",
                )}
                data-testid={AnchoredSheetTestId.Back}
                onClick={onBack}
                type="button"
              >
                <span className="inline-flex rotate-180">
                  <Icon name="chevron" size="xs" />
                </span>
                <span className="truncate">{backLabel}</span>
              </button>
            ) : null}
            {onStep && free ? (
              <span className="inline-flex items-center gap-[2px] font-mono text-[11.5px] text-ink-3">
                <button
                  aria-label={stepPrevLabel}
                  className={iconBtn}
                  data-testid={AnchoredSheetTestId.StepPrev}
                  disabled={pos ? pos.index <= 0 : false}
                  onClick={() => onStep(-1)}
                  type="button"
                >
                  <span className="inline-flex -rotate-90">
                    <Icon name="chevron" size="sm" />
                  </span>
                </button>
                {pos ? (
                  <span
                    className="whitespace-nowrap"
                    data-testid={AnchoredSheetTestId.StepPosition}
                  >
                    {`${pos.index + 1} / ${pos.total}`}
                  </span>
                ) : null}
                <button
                  aria-label={stepNextLabel}
                  className={iconBtn}
                  data-testid={AnchoredSheetTestId.StepNext}
                  disabled={pos ? pos.index >= pos.total - 1 : false}
                  onClick={() => onStep(1)}
                  type="button"
                >
                  <span className="inline-flex rotate-90">
                    <Icon name="chevron" size="sm" />
                  </span>
                </button>
              </span>
            ) : null}
            {expandable && free ? (
              <button
                aria-label={expanded ? shrinkLabel : expandLabel}
                aria-pressed={expanded}
                className={iconBtn}
                data-testid={AnchoredSheetTestId.Expand}
                onClick={onToggleExpand}
                type="button"
              >
                <Icon name={expanded ? "collapse" : "expand"} size="sm" />
              </button>
            ) : null}
            {!page || onBack ? (
              <button
                aria-label={closeLabel}
                className={cn(iconBtn, page && "size-[40px]")}
                data-testid={AnchoredSheetTestId.Close}
                onClick={onClose}
                type="button"
              >
                <Icon name="x" size="sm" />
              </button>
            ) : null}
          </div>
          {/* Wraps: the title keeps >= 360px, so wide action groups drop below it instead of squeezing it. */}
          <div className="flex flex-wrap items-start gap-x-[16px] gap-y-[10px]">
            <div
              className={cn(
                "min-w-[min(100%,360px)] flex-1 basis-0 font-semibold leading-[1.3] tracking-[-.02em] [text-wrap:pretty]",
                page ? "text-[20px]" : "text-[19px]",
              )}
              data-testid={AnchoredSheetTestId.Title}
            >
              {titleHref ? (
                <a
                  className="text-inherit no-underline hover:underline hover:decoration-ink-3 hover:underline-offset-4"
                  data-testid={AnchoredSheetTestId.TitleLink}
                  href={titleHref}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {title}
                </a>
              ) : onTitleClick ? (
                <button
                  className="cursor-pointer bg-transparent p-0 text-left font-[inherit] text-[length:inherit] leading-[inherit] tracking-[inherit] hover:underline hover:decoration-ink-3 hover:underline-offset-4"
                  onClick={onTitleClick}
                  type="button"
                >
                  {title}
                </button>
              ) : (
                title
              )}
            </div>
            {(page ? moreActions : actions || moreActions) ? (
              <div
                className="flex flex-none flex-wrap items-center gap-[6px] font-sans text-[12px]"
                data-testid={AnchoredSheetTestId.Actions}
              >
                {page ? null : actions}
                {moreActions}
              </div>
            ) : null}
          </div>
          {pills.length > 0 || meta ? (
            <div
              className="flex flex-wrap items-center gap-[8px] font-sans text-[12.5px] text-ink-3"
              data-testid={AnchoredSheetTestId.StateRow}
            >
              {pills.map((p) => (
                <span
                  className={cn(
                    "inline-flex h-[22px] items-center gap-[6px] whitespace-nowrap rounded-full px-[9px] text-[12px] font-medium",
                    PILL[p.tone],
                    p.loud && LOUD,
                  )}
                  data-loud={p.loud || undefined}
                  data-testid={AnchoredSheetTestId.State}
                  data-tone={p.tone}
                  key={`${p.tone}-${p.label}`}
                >
                  <StateDot px={7} state={p.tone} />
                  {/* Sentence case: app state words are lowercase (they also sit mid-sentence elsewhere). */}
                  <span className="first-letter:uppercase">{p.label}</span>
                </span>
              ))}
              {meta ? (
                <span className="contents text-ink-2" data-testid={AnchoredSheetTestId.Meta}>
                  {meta}
                </span>
              ) : null}
            </div>
          ) : null}
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-[6px]">
              {chips.map((c) => (
                <span
                  className="rounded-sm border border-line-2 px-[8px] py-[4px] font-sans uppercase tracking-wider text-[10px] text-ink-2"
                  data-testid={AnchoredSheetTestId.Chip}
                  key={c}
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}
          {trail ? <div data-testid={AnchoredSheetTestId.Trail}>{trail}</div> : null}
        </div>
        {banner ? (
          <div className="flex-none" data-testid={AnchoredSheetTestId.Banner}>
            {banner}
          </div>
        ) : null}
        <div
          className={cn(
            "min-h-0 flex-1",
            fillBody ? "flex flex-col overflow-hidden" : "overflow-y-auto",
          )}
          data-testid={AnchoredSheetTestId.Body}
        >
          {children}
        </div>
        {composer ? (
          <div
            className="flex-none border-t border-line"
            data-testid={AnchoredSheetTestId.Composer}
          >
            {composer}
          </div>
        ) : null}
        {footer ? (
          <div
            className="flex-none border-t border-line px-[18px] py-[12px]"
            data-testid={AnchoredSheetTestId.Footer}
          >
            {footer}
          </div>
        ) : footerNote ? (
          <div
            className="flex flex-none items-start gap-[8px] border-t border-line px-[18px] py-[10px] font-sans text-[12px] text-ink-3"
            data-testid={AnchoredSheetTestId.Footer}
          >
            <span className="mt-[1px]">
              <Icon name="help" size="sm" />
            </span>
            <span
              className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
              data-testid={AnchoredSheetTestId.FooterNote}
            >
              {footerNote}
            </span>
          </div>
        ) : null}
        {page && actions ? (
          <div
            className="flex flex-none flex-wrap items-center gap-[8px] border-t border-line bg-bar-2 px-[14px] pb-[max(env(safe-area-inset-bottom),12px)] pt-[10px] font-sans text-[13px] [&>*]:min-h-[40px] [&>*]:flex-1 [&>*]:justify-center"
            data-testid={AnchoredSheetTestId.ActionBar}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </>
  );
}
