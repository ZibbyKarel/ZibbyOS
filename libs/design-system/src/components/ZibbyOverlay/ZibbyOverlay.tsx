"use client";
import type {
  CSSProperties,
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOverlayStack } from "../../hooks/useOverlayStack";
import { cn } from "../../utils/cn";
import { Icon } from "../Icon/Icon";

export type ZibbyOverlayPhase = "closed" | "summoning" | "open" | "leaving";

export enum ZibbyOverlayTestId {
  Root = "zibby-overlay-root",
  Backdrop = "zibby-overlay-backdrop",
  Flyer = "zibby-overlay-flyer",
  Orb = "zibby-overlay-orb",
  Shock = "zibby-overlay-shock",
  TopBar = "zibby-overlay-top-bar",
  History = "zibby-overlay-history",
  Column = "zibby-overlay-column",
  Status = "zibby-overlay-status",
  Live = "zibby-overlay-live",
  Hint = "zibby-overlay-hint",
  Thread = "zibby-overlay-thread",
  Suggestions = "zibby-overlay-suggestions",
  Attachments = "zibby-overlay-attachments",
  Composer = "zibby-overlay-composer",
  Footer = "zibby-overlay-footer",
  Toast = "zibby-overlay-toast",
  Drop = "zibby-overlay-drop",
  Side = "zibby-overlay-side",
  Divider = "zibby-overlay-divider",
  Shield = "zibby-overlay-shield",
  Pinned = "zibby-overlay-pinned",
}

/** Mark an element inside a slot with this attribute to receive focus when the overlay opens. */
export const ZIBBY_OVERLAY_AUTOFOCUS_ATTR = "data-zibby-autofocus";

export interface ZibbyOverlayProps {
  /** Controlled open state. Flipping it drives the summon / leave phases. */
  open: boolean;
  /** Called with `false` on Esc / backdrop click (history panel first, if open). */
  onOpenChange: (open: boolean) => void;
  /** Fires on every phase change: `summoning` → `open` → `leaving` → `closed`. */
  onPhaseChange?: (phase: ZibbyOverlayPhase) => void;
  /** Viewport px the orb flies out of / back into. `null` → centred scale/fade. */
  origin?: { x: number; y: number } | null;
  /** The orb, rendered in a 140px box (scaled during the flight). */
  orb: ReactNode;
  /** Accessible name of the dialog. */
  label: string;
  /** Row content at the top of the layer (fades in once open). */
  topBar?: ReactNode;
  /** Content of the left-hand history panel. Omit for no panel. */
  history?: ReactNode;
  historyOpen?: boolean;
  onHistoryOpenChange?: (open: boolean) => void;
  /** Accessible name of the history `aside`. */
  historyLabel?: string;
  /** Status line under the orb (aria-live polite). */
  status?: ReactNode;
  /** Live transcript (aria-live polite). */
  live?: ReactNode;
  /** Amber hint line. */
  hint?: ReactNode;
  /** Conversation thread; scrolls, with a fade at the top. */
  thread: ReactNode;
  /** Any change scrolls the thread to the bottom. */
  scrollKey?: string | number;
  /** "Try saying…" row above the composer. */
  suggestions?: ReactNode;
  /** Attachment chips row above the composer. */
  attachments?: ReactNode;
  /** The composer bar; the overlay only places it. */
  composer: ReactNode;
  /** Row below the composer. */
  footer?: ReactNode;
  /** Toast, positioned bottom-centre above the composer. */
  toast?: ReactNode;
  /** Shows the file drop zone. */
  dropActive?: boolean;
  dropTitle?: ReactNode;
  dropHint?: ReactNode;
  /** Called with the dropped files (only drags that carry files are handled). */
  onFilesDrop?: (files: File[]) => void;
  /** Called when a file drag enters (`true`) / leaves or drops (`false`) the layer. */
  onDragActiveChange?: (active: boolean) => void;
  /** Phone: full-screen opaque layout, no flight arc. */
  compact?: boolean;
  /** Desktop: a panel beside the chat (e.g. `CanvasPanel`). The column moves to the left part. */
  side?: ReactNode;
  /** `split` (default): chat left, panel right. `full`: panel spans the layer, column inert. */
  sideMode?: ZibbyOverlaySideMode;
  /** Panel share of the width, clamped to 0.35-0.65 (default 0.5). Seeds the divider. */
  sideRatio?: number;
  /** Fires while the divider is dragged / moved with the arrow keys (clamped). */
  onSideRatioChange?: (ratio: number) => void;
  /** Esc closes `full` first (`"full"`), then the side panel (`"split"`), then the overlay. */
  onSideDismiss?: (mode: ZibbyOverlaySideMode) => void;
  /** Compact only: small element pinned at the right edge above the composer. */
  pinned?: ReactNode;
}

export type ZibbyOverlaySideMode = "split" | "full";

export const SIDE_RATIO_MIN = 0.35;
export const SIDE_RATIO_MAX = 0.65;
const SIDE_RATIO_STEP = 0.02;

function clampRatio(r: number): number {
  return Math.min(SIDE_RATIO_MAX, Math.max(SIDE_RATIO_MIN, Number.isFinite(r) ? r : 0.5));
}

type Mode = "flight" | "pop" | "none";

const TIMING: Record<Mode, { in: number; out: number }> = {
  flight: { in: 850, out: 500 },
  pop: { in: 450, out: 300 },
  none: { in: 0, out: 150 },
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), iframe';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function readViewport() {
  if (typeof window === "undefined") return { w: 1440, h: 900 };
  return { w: window.innerWidth, h: window.innerHeight };
}

/** Resting centre of the orb from the top: 150px on a 900px viewport, shrinking on short ones. */
function restCenterY(h: number): number {
  return Math.min(150, Math.max(100, Math.round(h * 0.1667)));
}

function hasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  return types != null && Array.from(types).includes("Files");
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.closest('[inert], [aria-hidden="true"]'),
  );
}

/**
 * Full-screen assistant layer ("Zibby"): a controlled, slot-based dialog that the orb flies
 * into from `origin`. Presentational only — every region is a slot. Portal to `document.body`
 * at z-50 (same level as Dialog; sits above it by DOM order and below nothing the DS portals
 * later, so menus opened from slots stay visible).
 */
export function ZibbyOverlay({
  open,
  onOpenChange,
  onPhaseChange,
  origin = null,
  orb,
  label,
  topBar,
  history,
  historyOpen = false,
  onHistoryOpenChange,
  historyLabel = "History",
  status,
  live,
  hint,
  thread,
  scrollKey,
  suggestions,
  attachments,
  composer,
  footer,
  toast,
  dropActive = false,
  dropTitle,
  dropHint,
  onFilesDrop,
  onDragActiveChange,
  compact = false,
  side,
  sideMode = "split",
  sideRatio = 0.5,
  onSideRatioChange,
  onSideDismiss,
  pinned,
}: ZibbyOverlayProps) {
  const [phase, setPhase] = useState<ZibbyOverlayPhase>("closed");
  const [mode, setMode] = useState<Mode>("flight");
  const [shocked, setShocked] = useState(false);
  const [vp, setVp] = useState(readViewport);
  const phaseRef = useRef<ZibbyOverlayPhase>("closed");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<ZibbyOverlayPhase>("closed");
  const rootRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const engagedRef = useRef(false);
  const hasSide = side != null && !compact;
  const full = hasSide && sideMode === "full";
  const [ratio, setRatio] = useState(() => clampRatio(sideRatio));
  const [dragging, setDragging] = useState(false);
  const [sideIn, setSideIn] = useState(false);
  const latest = useRef({
    onPhaseChange,
    onOpenChange,
    onHistoryOpenChange,
    historyOpen,
    hasSide,
    full,
    onSideDismiss,
    onSideRatioChange,
  });
  useEffect(() => {
    latest.current = {
      onPhaseChange,
      onOpenChange,
      onHistoryOpenChange,
      historyOpen,
      hasSide,
      full,
      onSideDismiss,
      onSideRatioChange,
    };
  });
  // A controlled `sideRatio` wins over the last drag.
  const [ratioProp, setRatioProp] = useState(sideRatio);
  if (ratioProp !== sideRatio) {
    setRatioProp(sideRatio);
    setRatio(clampRatio(sideRatio));
  }
  // Opening animation: the panel starts un-risen / blurred and settles on the next tick.
  useEffect(() => {
    if (!hasSide) return;
    const t = setTimeout(() => setSideIn(true), 20);
    return () => {
      clearTimeout(t);
      setSideIn(false);
    };
  }, [hasSide]);

  const { isTopmost } = useOverlayStack(phase !== "closed");
  const hasHistory = history != null;
  const historyShown = hasHistory && historyOpen;

  // Phase machine. Rapid toggling just restarts from whatever phase is current.
  const modeInput = useRef({ compact, origin });
  useEffect(() => {
    modeInput.current = { compact, origin };
  });
  useEffect(() => {
    const clear = () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const go = (next: ZibbyOverlayPhase) => {
      phaseRef.current = next;
      setPhase(next);
    };
    clear();
    const current = phaseRef.current;
    if (open) {
      if (current === "summoning" || current === "open") return;
      const input = modeInput.current;
      const nextMode: Mode = prefersReducedMotion()
        ? "none"
        : !input.compact && input.origin
          ? "flight"
          : "pop";
      setMode(nextMode);
      setVp(readViewport());
      setShocked(false);
      if (TIMING[nextMode].in === 0) {
        go("open");
        return;
      }
      go("summoning");
      timerRef.current = setTimeout(() => go("open"), TIMING[nextMode].in);
    } else {
      if (current === "closed" || current === "leaving") return;
      const ms = prefersReducedMotion() ? TIMING.none.out : TIMING[mode].out;
      go("leaving");
      timerRef.current = setTimeout(() => go("closed"), ms);
    }
    // `mode` is read only to pick the leave duration of the flight that is in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => clearOnUnmount(timerRef), []);

  useEffect(() => {
    if (reportedRef.current === phase) return;
    reportedRef.current = phase;
    latest.current.onPhaseChange?.(phase);
  }, [phase]);

  // Track the viewport while mounted (the resting point depends on it).
  useEffect(() => {
    if (phase === "closed") return;
    const onResize = () => setVp(readViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [phase === "closed"]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus: move in on open, restore on leave / unmount.
  useEffect(() => {
    const restore = () => {
      const prev = prevFocusRef.current;
      prevFocusRef.current = null;
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
    if (phase === "summoning" || phase === "open") {
      if (engagedRef.current) return;
      engagedRef.current = true;
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement;
      prevFocusRef.current =
        active instanceof HTMLElement && !root.contains(active) ? active : null;
      const target =
        root.querySelector<HTMLElement>(`[${ZIBBY_OVERLAY_AUTOFOCUS_ATTR}]`) ??
        (composerRef.current ? focusables(composerRef.current)[0] : undefined) ??
        root;
      target.focus({ preventScroll: true });
    } else {
      engagedRef.current = false;
      restore();
    }
  }, [phase]);
  useEffect(
    () => () => {
      const prev = prevFocusRef.current;
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    },
    [],
  );

  const dismiss = (viaEsc = false) => {
    if (phaseRef.current !== "open" && phaseRef.current !== "summoning") return;
    const l = latest.current;
    if (l.historyOpen && l.onHistoryOpenChange) {
      l.onHistoryOpenChange(false);
    } else if (viaEsc && l.full && l.onSideDismiss) {
      l.onSideDismiss("full");
    } else if (viaEsc && l.hasSide && l.onSideDismiss) {
      l.onSideDismiss("split");
    } else {
      latest.current.onOpenChange(false);
    }
  };
  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  });

  // Esc: history, full, side panel, then the overlay. Ignored when a slot already handled it.
  useEffect(() => {
    if (phase === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      if (!isTopmost()) return;
      dismissRef.current(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase === "closed", isTopmost]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the thread to the bottom on scrollKey change and when it first appears.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollKey, phase === "closed"]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "closed" || typeof document === "undefined") return null;

  const isOpen = phase === "open";
  const leaving = phase === "leaving";
  const flight = mode === "flight" && !compact;
  const cy = restCenterY(vp.h);
  const dx = origin ? origin.x - vp.w / 2 : 0;
  const dy = origin ? origin.y - cy : 0;
  const rootStyle = {
    "--zo-side": ratio,
    "--zo-cy": `${cy}px`,
    "--zo-dx": `${dx}px`,
    "--zo-dy": `${dy}px`,
  } as CSSProperties;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const root = rootRef.current;
    if (!root) return;
    const list = focusables(root);
    const first = list.at(0);
    const last = list.at(-1);
    if (!first || !last) {
      e.preventDefault();
      root.focus();
      return;
    }
    const active = document.activeElement;
    if (!(active instanceof Node) || !root.contains(active) || active === root) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onDragEnterOver = (e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "copy";
    } catch {
      /* some browsers lock dropEffect */
    }
    if (!dropActive) onDragActiveChange?.(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    if (dropActive) onDragActiveChange?.(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesDrop?.(files);
    onDragActiveChange?.(false);
  };

  const emitRatio = (r: number) => {
    const next = clampRatio(r);
    setRatio(next);
    latest.current.onSideRatioChange?.(next);
  };
  const onDividerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onDividerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const w = rootRef.current?.getBoundingClientRect().width || readViewport().w;
    emitRatio(1 - e.clientX / w);
  };
  const onDividerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };
  const onDividerKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") emitRatio(ratio + SIDE_RATIO_STEP);
    else if (e.key === "ArrowRight") emitRatio(ratio - SIDE_RATIO_STEP);
    else return;
    e.preventDefault();
  };

  const drop = dropActive && (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-[5] grid animate-fade-in place-items-center rounded-[26px] border-2 border-dashed border-accent/70 text-center text-accent-fg",
        "bg-[color-mix(in_srgb,var(--color-bg)_82%,var(--color-accent)_6%)]",
        compact ? "inset-2" : "-top-6 -right-7 -bottom-3.5 -left-7",
      )}
      data-testid={ZibbyOverlayTestId.Drop}
    >
      <div>
        <div className="flex justify-center">
          <Icon name="paperclip" size="xl" />
        </div>
        {dropTitle != null && (
          <div className="mt-2.5 mb-1 text-[20px] font-semibold text-ink">{dropTitle}</div>
        )}
        {dropHint != null && <div className="text-[13px] text-ink-2">{dropHint}</div>}
      </div>
    </div>
  );

  const toastEl = toast != null && (
    <div
      className={cn(
        "absolute left-1/2 z-[6] -translate-x-1/2",
        compact ? "bottom-full mb-2" : "bottom-[118px]",
      )}
      data-testid={ZibbyOverlayTestId.Toast}
    >
      {toast}
    </div>
  );

  const statusEl = (
    <div
      aria-live="polite"
      className="flex min-h-5 items-center justify-center gap-2 text-center font-sans text-[13px] text-ink-2"
      data-testid={ZibbyOverlayTestId.Status}
    >
      {status}
    </div>
  );
  const liveEl = (
    <div
      aria-live="polite"
      className={cn(
        "text-center text-ink text-balance",
        compact
          ? "min-h-[30px] px-[18px] pt-1 text-[19px] leading-snug"
          : "min-h-10 px-10 pt-1.5 text-[23px] leading-[1.35] tracking-[-0.015em]",
      )}
      data-testid={ZibbyOverlayTestId.Live}
    >
      {live}
    </div>
  );
  const hintEl = (
    <div
      className="min-h-4 text-center text-[12px] text-accent-fg"
      data-testid={ZibbyOverlayTestId.Hint}
    >
      {hint}
    </div>
  );
  const threadEl = (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto",
        compact
          ? "gap-3 px-3.5 py-1.5"
          : "gap-4 px-1.5 pt-6 pb-2.5 [mask-image:linear-gradient(transparent,#000_30px)]",
      )}
      data-testid={ZibbyOverlayTestId.Thread}
      ref={threadRef}
    >
      {thread}
    </div>
  );
  const lower = (
    <>
      {suggestions != null && (
        <div
          className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-[12px] text-ink-3"
          data-testid={ZibbyOverlayTestId.Suggestions}
        >
          {suggestions}
        </div>
      )}
      {attachments != null && (
        <div className="mt-2.5 flex flex-wrap gap-1.5" data-testid={ZibbyOverlayTestId.Attachments}>
          {attachments}
        </div>
      )}
      <div className="mt-2.5 min-w-0" data-testid={ZibbyOverlayTestId.Composer} ref={composerRef}>
        {composer}
      </div>
      {footer != null && (
        <div
          className="mt-2.5 flex flex-wrap items-center gap-2.5 text-[12px] text-ink-3"
          data-testid={ZibbyOverlayTestId.Footer}
        >
          {footer}
        </div>
      )}
    </>
  );

  const fade = cn(
    "transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:duration-150",
    // `translate: none` once open, so fixed-position slot content is not trapped in a containing block.
    isOpen
      ? "pointer-events-auto [translate:none] opacity-100"
      : "pointer-events-none [translate:0_16px] opacity-0",
  );

  const historyEl = hasHistory && (
    <aside
      aria-hidden={!historyShown}
      aria-label={historyLabel}
      className={cn(
        "absolute inset-y-0 left-0 z-[8] flex flex-col border-r border-line-2 bg-panel shadow-pop",
        compact ? "w-full" : "w-[320px] max-w-full",
        historyShown
          ? "visible translate-x-0 transition-transform duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          : "invisible -translate-x-[104%] [transition:transform_0.35s_cubic-bezier(0.2,0.8,0.2,1),visibility_0s_0.35s]",
        "motion-reduce:transition-none",
      )}
      data-testid={ZibbyOverlayTestId.History}
      inert={!historyShown}
    >
      {history}
    </aside>
  );

  const orbBox = (
    <div className="size-[140px] shrink-0" data-testid={ZibbyOverlayTestId.Orb}>
      {orb}
    </div>
  );

  const layer = (
    <div
      aria-label={label}
      aria-modal="true"
      className={cn(
        "fixed inset-0 z-50 overflow-hidden outline-none",
        compact && "flex flex-col bg-background",
        compact && (leaving ? "animate-zo-bd-out" : "animate-fade-in"),
      )}
      data-testid={ZibbyOverlayTestId.Root}
      onDragEnter={onDragEnterOver}
      onDragLeave={onDragLeave}
      onDragOver={onDragEnterOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      ref={rootRef}
      role="dialog"
      style={rootStyle}
      tabIndex={-1}
    >
      {compact ? (
        <>
          <div
            className="flex shrink-0 items-center gap-2.5 px-3.5 pt-[max(env(safe-area-inset-top),2px)] pb-1.5"
            data-testid={ZibbyOverlayTestId.TopBar}
          >
            {topBar}
          </div>
          <div
            className={cn(
              "grid shrink-0 place-items-center py-1.5",
              leaving ? "motion-safe:animate-zo-pop-out" : "motion-safe:animate-zo-pop",
            )}
            data-testid={ZibbyOverlayTestId.Flyer}
          >
            <div className="grid size-[120px] place-items-center">
              <div className="origin-center scale-[0.857]">{orbBox}</div>
            </div>
          </div>
          {statusEl}
          {liveEl}
          {hintEl}
          <div
            className={cn("relative flex min-h-0 flex-1 flex-col", fade)}
            data-testid={ZibbyOverlayTestId.Column}
          >
            {threadEl}
            <div className="relative shrink-0 border-t border-line bg-bar-2 px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),12px)]">
              {pinned != null && (
                <div
                  className="absolute right-3 bottom-full z-[6] mb-2"
                  data-testid={ZibbyOverlayTestId.Pinned}
                >
                  {pinned}
                </div>
              )}
              {lower}
              {toastEl}
            </div>
            {drop}
          </div>
          {historyEl}
        </>
      ) : (
        <>
          <div
            className={cn(
              "absolute inset-0 backdrop-blur-[10px] backdrop-saturate-[0.6]",
              "bg-[color-mix(in_srgb,var(--color-bg)_66%,transparent)]",
              leaving ? "animate-zo-bd-out" : "animate-zo-bd-in",
            )}
            data-testid={ZibbyOverlayTestId.Backdrop}
            onClick={() => dismiss()}
          />
          <div
            className={cn(
              "pointer-events-none absolute top-[var(--zo-cy)] z-[3] size-0",
              hasSide
                ? "left-[calc((100%-var(--zo-side)*100%)/2)] transition-[left,opacity] duration-[620ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                : "left-1/2",
              full && "opacity-0",
            )}
            data-testid={ZibbyOverlayTestId.Flyer}
          >
            <div
              className={cn(
                "absolute top-0 left-0 size-0",
                flight && !leaving && "animate-zo-fx",
                flight && leaving && "animate-zo-fx-out",
              )}
            >
              <div
                className={cn(
                  "absolute top-0 left-0 size-0",
                  flight && !leaving && "animate-zo-fy",
                  flight && leaving && "animate-zo-fy-out",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0 left-0 size-0",
                    flight && !leaving && "animate-zo-sc",
                    flight && leaving && "animate-zo-sc-out",
                    !flight && mode === "pop" && !leaving && "animate-zo-pop",
                    !flight && mode === "pop" && leaving && "animate-zo-pop-out",
                    mode === "none" && leaving && "animate-zo-fade-out",
                  )}
                >
                  <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
                    {orbBox}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isOpen && !shocked && mode !== "none" && (
            <span
              className={cn(
                "pointer-events-none absolute top-[var(--zo-cy)] -mt-[70px] -ml-[70px] size-[140px] animate-zo-shock rounded-full border-2 border-accent",
                hasSide ? "left-[calc((100%-var(--zo-side)*100%)/2)]" : "left-1/2",
              )}
              data-testid={ZibbyOverlayTestId.Shock}
              onAnimationEnd={() => setShocked(true)}
            />
          )}
          <div
            className={cn(
              "absolute inset-x-0 top-0 z-[7] flex h-[60px] items-center gap-2 px-[18px]",
              "transition-opacity duration-[400ms] delay-[250ms] motion-reduce:duration-150 motion-reduce:delay-0",
              isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
            )}
            data-testid={ZibbyOverlayTestId.TopBar}
          >
            {topBar}
          </div>
          {historyEl}
          <div
            className={cn(
              "absolute bottom-5 left-4 z-[4] mx-auto flex flex-col",
              "top-[calc(var(--zo-cy)+86px)]",
              hasSide
                ? "max-w-[740px] right-[calc(var(--zo-side)*100%+8px)]"
                : "right-4 w-[740px] max-w-[calc(100%-32px)]",
              fade,
              hasSide && "duration-[620ms]",
              // Split opening: the column starts where the centred layout had it and slides left.
              hasSide && isOpen && !sideIn && "[translate:calc(var(--zo-side)*50vw)_0]",
              full &&
                "pointer-events-none -translate-x-9 !opacity-0 blur-[8px] [translate:-36px_0] motion-reduce:blur-none",
            )}
            data-testid={ZibbyOverlayTestId.Column}
            inert={full}
          >
            {statusEl}
            {liveEl}
            {hintEl}
            {threadEl}
            {lower}
            {drop}
            {toastEl}
          </div>
          {hasSide && (
            <>
              <div
                className={cn(
                  "absolute top-[68px] right-4 bottom-4 z-[5] min-w-0",
                  "transition-[left,opacity,translate,filter] duration-[620ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:duration-150",
                  dragging && "!transition-none",
                  full ? "left-4" : "left-[calc((1-var(--zo-side))*100%+8px)]",
                  isOpen && sideIn
                    ? "[translate:none] opacity-100 delay-[400ms] motion-reduce:delay-0"
                    : "pointer-events-none [translate:0_14px] opacity-0 blur-[8px] motion-reduce:blur-none",
                  isOpen && sideIn && "blur-0",
                )}
                data-testid={ZibbyOverlayTestId.Side}
              >
                {side}
                {dragging && (
                  <div className="absolute inset-0 z-[2]" data-testid={ZibbyOverlayTestId.Shield} />
                )}
              </div>
              {!full && (
                <div
                  aria-label="Resize panel"
                  aria-orientation="vertical"
                  aria-valuemax={Math.round(SIDE_RATIO_MAX * 100)}
                  aria-valuemin={Math.round(SIDE_RATIO_MIN * 100)}
                  aria-valuenow={Math.round(ratio * 100)}
                  className={cn(
                    "group absolute top-[68px] bottom-4 z-[6] flex w-4 -translate-x-1/2 cursor-col-resize touch-none justify-center outline-none",
                    "left-[calc((1-var(--zo-side))*100%+4px)]",
                  )}
                  data-testid={ZibbyOverlayTestId.Divider}
                  onKeyDown={onDividerKey}
                  onLostPointerCapture={() => setDragging(false)}
                  onPointerCancel={onDividerUp}
                  onPointerDown={onDividerDown}
                  onPointerMove={onDividerMove}
                  onPointerUp={onDividerUp}
                  role="separator"
                  tabIndex={0}
                >
                  <span
                    className={cn(
                      "h-full w-px origin-center bg-ink opacity-0 transition-opacity duration-150",
                      "shadow-[0_0_22px_color-mix(in_srgb,var(--color-ink)_45%,transparent)]",
                      "group-hover:opacity-70 group-focus-visible:opacity-70 group-focus-visible:bg-accent",
                      dragging && "opacity-70",
                      isOpen && sideIn && "animate-zo-divider motion-reduce:animate-none",
                    )}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

  return createPortal(layer, document.body);
}

function clearOnUnmount(timerRef: { current: ReturnType<typeof setTimeout> | null }) {
  return () => {
    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
}
