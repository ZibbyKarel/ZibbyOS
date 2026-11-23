"use client";
import type { ReactNode, Ref } from "react";
import { useId } from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Button } from "../Button/Button";
import { type DotTone, StatusDot } from "../StatusDot/StatusDot";

export type CanvasPanelStatus = "loading" | "ready" | "error" | "unresponsive";

export enum CanvasPanelTestId {
  Root = "canvas-panel-root",
  Header = "canvas-panel-header",
  Title = "canvas-panel-title",
  Version = "canvas-panel-version",
  Status = "canvas-panel-status",
  Errors = "canvas-panel-errors",
  Reload = "canvas-panel-reload",
  OpenExternal = "canvas-panel-open-external",
  Expand = "canvas-panel-expand",
  Close = "canvas-panel-close",
  Body = "canvas-panel-body",
  Frame = "canvas-panel-frame",
  Overlay = "canvas-panel-overlay",
  OverlayActions = "canvas-panel-overlay-actions",
}

export interface CanvasPanelProps {
  title: string;
  /** Shown as `v{n}`. */
  version?: number;
  status?: CanvasPanelStatus;
  /** Visible status text per state (i18n override); English defaults. */
  statusLabels?: Partial<Record<CanvasPanelStatus, string>>;
  /** Count of reported page errors; the badge renders when > 0. */
  errorCount?: number;
  onErrorsClick?: () => void;
  errorsLabel?: (count: number) => string;
  /** Iframe wiring. */
  src: string;
  sandbox?: string;
  allow?: string;
  frameRef?: Ref<HTMLIFrameElement>;
  frameTitle?: string;
  /** Message of the `error` / `unresponsive` overlay, and its action buttons. */
  message?: ReactNode;
  actions?: ReactNode;
  full?: boolean;
  /** Must match the page's own scheme, else the browser paints an opaque canvas. */
  colorScheme?: "light" | "dark";
  onReload?: () => void;
  onOpenExternal?: () => void;
  onToggleFull?: () => void;
  onClose?: () => void;
  reloadLabel?: string;
  openExternalLabel?: string;
  fullLabel?: string;
  backLabel?: string;
  closeLabel?: string;
}

const STATUS_TONE: Record<CanvasPanelStatus, DotTone> = {
  loading: "working",
  ready: "done",
  error: "error",
  unresponsive: "blocked",
};

const STATUS_DEFAULT: Record<CanvasPanelStatus, string> = {
  loading: "Loading",
  ready: "Ready",
  error: "Error",
  unresponsive: "Not responding",
};

/**
 * Glass panel ("Sklo") that hosts a canvas iframe next to the chat. The header doubles as an
 * address bar: title, version chip, status, error badge, then Reload / Open / Full / Close.
 * Presentational: the host owns the iframe lifecycle and handles the actions.
 */
export function CanvasPanel({
  title,
  version,
  status = "loading",
  statusLabels,
  errorCount = 0,
  onErrorsClick,
  errorsLabel = (n) => `${n} ${n === 1 ? "error" : "errors"}`,
  src,
  sandbox,
  allow,
  frameRef,
  frameTitle,
  message,
  actions,
  full = false,
  colorScheme = "dark",
  onReload,
  onOpenExternal,
  onToggleFull,
  onClose,
  reloadLabel = "Reload",
  openExternalLabel = "Open in browser",
  fullLabel = "Full screen",
  backLabel = "Back to chat",
  closeLabel = "Close",
}: CanvasPanelProps) {
  const titleId = useId();
  const statusText = statusLabels?.[status] ?? STATUS_DEFAULT[status];
  const overlay = status === "error" || status === "unresponsive";
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex size-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[18px] border border-line-2",
        "bg-[color-mix(in_srgb,var(--color-panel)_42%,transparent)] backdrop-blur-[18px] backdrop-saturate-[1.15]",
        "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-ink)_6%,transparent)]",
      )}
      data-testid={CanvasPanelTestId.Root}
      role="region"
    >
      <header
        className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-line pr-2 pl-3.5"
        data-testid={CanvasPanelTestId.Header}
      >
        <h2
          className="min-w-0 truncate font-sans text-[14px] font-semibold tracking-[-0.01em] text-ink"
          data-testid={CanvasPanelTestId.Title}
          id={titleId}
        >
          {title}
        </h2>
        {version != null && (
          <span
            className="rounded-md bg-[color-mix(in_srgb,var(--color-ink)_6%,transparent)] px-[7px] py-0.5 font-mono text-[11px] text-ink-2"
            data-testid={CanvasPanelTestId.Version}
          >
            v{version}
          </span>
        )}
        <span
          aria-live="polite"
          className="inline-flex items-center gap-[7px] font-sans text-[12px] whitespace-nowrap text-ink-3"
          data-status={status}
          data-testid={CanvasPanelTestId.Status}
        >
          <StatusDot pulse={status === "loading"} tone={STATUS_TONE[status]} />
          {statusText}
        </span>
        {errorCount > 0 && (
          <button
            className={cn(
              "cursor-pointer rounded-full border border-bad/40 bg-bad/12 px-2 py-0.5 font-sans text-[11px] font-medium text-bad",
              focusRingInset,
            )}
            data-testid={CanvasPanelTestId.Errors}
            onClick={onErrorsClick}
            type="button"
          >
            {errorsLabel(errorCount)}
          </button>
        )}
        <span className="flex-1" />
        <Button
          aria-label={reloadLabel}
          data-testid={CanvasPanelTestId.Reload}
          icon="retry"
          intent="ghost"
          onClick={onReload}
          size="sm"
          title={reloadLabel}
        />
        <Button
          aria-label={openExternalLabel}
          data-testid={CanvasPanelTestId.OpenExternal}
          icon="link"
          intent="ghost"
          onClick={onOpenExternal}
          size="sm"
          title={openExternalLabel}
        />
        <Button
          aria-label={full ? backLabel : fullLabel}
          data-testid={CanvasPanelTestId.Expand}
          icon={full ? "arrow" : "expand"}
          intent="ghost"
          onClick={onToggleFull}
          size="sm"
          title={full ? backLabel : fullLabel}
        />
        <Button
          aria-label={closeLabel}
          data-testid={CanvasPanelTestId.Close}
          icon="x"
          intent="ghost"
          onClick={onClose}
          size="sm"
          title={closeLabel}
        />
      </header>
      <div className="relative min-h-0 flex-1" data-testid={CanvasPanelTestId.Body}>
        <iframe
          allow={allow}
          className="size-full border-0 bg-transparent"
          data-testid={CanvasPanelTestId.Frame}
          ref={frameRef}
          sandbox={sandbox}
          src={src}
          style={{ colorScheme }}
          title={frameTitle ?? title}
        />
        {overlay && (
          <div
            className="absolute inset-0 grid animate-fade-in place-items-center bg-[color-mix(in_srgb,var(--color-bg)_72%,transparent)] p-6 text-center backdrop-blur-sm"
            data-testid={CanvasPanelTestId.Overlay}
            role={status === "error" ? "alert" : "status"}
          >
            <div className="flex max-w-[360px] flex-col items-center gap-3">
              {message != null && <div className="text-[14px] text-ink">{message}</div>}
              {actions != null && (
                <div
                  className="flex flex-wrap justify-center gap-2"
                  data-testid={CanvasPanelTestId.OverlayActions}
                >
                  {actions}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
