"use client";
import type { ReactNode, Ref } from "react";
import { useId } from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { MenuButton } from "../MenuButton/MenuButton";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import { type DotTone, StatusDot } from "../StatusDot/StatusDot";

export type CanvasPanelStatus = "loading" | "ready" | "error" | "unresponsive";

export type CanvasPanelPreviewWidth = "phone" | "tablet" | "full";

export interface CanvasPanelVersion {
  key: string;
  /** Display label, e.g. "v2.1". */
  label: string;
  /** Preformatted time text. */
  at: string;
  note?: string;
  current: boolean;
}

export interface CanvasPanelBanner {
  title: string;
  /** Rendered in full, line breaks preserved; scrolls when long. */
  body?: string;
  confirmLabel: string;
  dismissLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

const PREVIEW_MAX: Record<CanvasPanelPreviewWidth, string> = {
  phone: "max-w-[390px]",
  tablet: "max-w-[820px]",
  full: "max-w-none",
};

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
  FixErrors = "canvas-panel-fix-errors",
  Export = "canvas-panel-export",
  Versions = "canvas-panel-versions",
  ViewingStrip = "canvas-panel-viewing-strip",
  ViewingText = "canvas-panel-viewing-text",
  Restore = "canvas-panel-restore",
  BackToCurrent = "canvas-panel-back-to-current",
  Banner = "canvas-panel-banner",
  BannerTitle = "canvas-panel-banner-title",
  BannerBody = "canvas-panel-banner-body",
  BannerConfirm = "canvas-panel-banner-confirm",
  BannerDismiss = "canvas-panel-banner-dismiss",
  PreviewWidth = "canvas-panel-preview-width",
  FrameWrap = "canvas-panel-frame-wrap",
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
  /** Versions menu; the trigger shows the viewed (else current) version's label. */
  versions?: CanvasPanelVersion[];
  /** Key of the version being viewed; when it isn't the current one a Restore strip shows. */
  viewingKey?: string;
  onViewVersion?: (key: string) => void;
  onRestoreVersion?: (key: string) => void;
  versionsLabel?: string;
  viewingLabel?: (label: string) => string;
  restoreLabel?: string;
  backToCurrentLabel?: string;
  /** Inline banner above the frame (agent proposal, network grant). */
  banner?: CanvasPanelBanner;
  /** Frame width preset; the segmented control renders only with `onPreviewWidthChange`. */
  previewWidth?: CanvasPanelPreviewWidth;
  onPreviewWidthChange?: (width: CanvasPanelPreviewWidth) => void;
  previewWidthLabels?: Record<CanvasPanelPreviewWidth, string>;
  previewWidthAriaLabel?: string;
  /** Renders a "Fix it" button next to the error count (when errorCount > 0). */
  onFixErrors?: () => void;
  fixErrorsLabel?: string;
  /** Renders an "Export HTML" header action. */
  onExport?: () => void;
  exportLabel?: string;
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
  versions,
  viewingKey,
  onViewVersion,
  onRestoreVersion,
  versionsLabel = "Versions",
  viewingLabel = (l) => `Viewing ${l}`,
  restoreLabel = "Restore",
  backToCurrentLabel = "Back to current",
  banner,
  previewWidth = "full",
  onPreviewWidthChange,
  previewWidthLabels = { phone: "Phone", tablet: "Tablet", full: "Full" },
  previewWidthAriaLabel = "Preview width",
  onFixErrors,
  fixErrorsLabel = "Fix it",
  onExport,
  exportLabel = "Export HTML",
}: CanvasPanelProps) {
  const titleId = useId();
  const statusText = statusLabels?.[status] ?? STATUS_DEFAULT[status];
  const currentVersion = versions?.find((v) => v.current);
  const viewing = viewingKey != null ? versions?.find((v) => v.key === viewingKey) : undefined;
  const viewingOld = viewing != null && !viewing.current;
  const shownVersion = viewing ?? currentVersion;
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
        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          <h2
            className="min-w-0 truncate font-sans text-[14px] font-semibold tracking-[-0.01em] text-ink"
            data-testid={CanvasPanelTestId.Title}
            id={titleId}
          >
            {title}
          </h2>
          {version != null && !(versions && versions.length > 0) && (
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
          {errorCount > 0 && onFixErrors && (
            <Button
              data-testid={CanvasPanelTestId.FixErrors}
              intent="secondary"
              onClick={onFixErrors}
              size="sm"
            >
              {fixErrorsLabel}
            </Button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {versions && versions.length > 0 && (
            <MenuButton
              ariaLabel={versionsLabel}
              items={versions.map((v) => ({
                id: v.key,
                label: v.current ? `${v.label} ✓` : v.label,
                description: v.note ? `${v.at} · ${v.note}` : v.at,
                onSelect: () => onViewVersion?.(v.key),
              }))}
              renderTrigger={(triggerProps) => (
                <button
                  {...triggerProps}
                  aria-label={versionsLabel}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--color-ink)_6%,transparent)] px-[7px] py-0.5 font-mono text-[11px] text-ink-2",
                    focusRingInset,
                  )}
                  data-testid={CanvasPanelTestId.Versions}
                  type="button"
                >
                  {shownVersion?.label ?? versionsLabel}
                  <Icon name="chevron" size="xs" />
                </button>
              )}
            />
          )}
          {onPreviewWidthChange && (
            <div data-testid={CanvasPanelTestId.PreviewWidth}>
              <SegmentedControl
                ariaLabel={previewWidthAriaLabel}
                items={(["phone", "tablet", "full"] as const).map((w) => ({
                  value: w,
                  label: previewWidthLabels[w],
                }))}
                onChange={(v) => onPreviewWidthChange(v as CanvasPanelPreviewWidth)}
                size="sm"
                value={previewWidth}
              />
            </div>
          )}
          {onExport && (
            <Button
              aria-label={exportLabel}
              data-testid={CanvasPanelTestId.Export}
              icon="file"
              intent="ghost"
              onClick={onExport}
              size="sm"
              title={exportLabel}
            />
          )}
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
        </div>
      </header>
      {viewingOld && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] px-3.5 py-1.5 font-sans text-[12px] text-ink"
          data-testid={CanvasPanelTestId.ViewingStrip}
        >
          <span className="min-w-0 flex-1" data-testid={CanvasPanelTestId.ViewingText}>
            {viewingLabel(viewing.label)}
          </span>
          <Button
            data-testid={CanvasPanelTestId.Restore}
            intent="secondary"
            onClick={() => onRestoreVersion?.(viewing.key)}
            size="sm"
          >
            {restoreLabel}
          </Button>
          {currentVersion && (
            <Button
              data-testid={CanvasPanelTestId.BackToCurrent}
              intent="ghost"
              onClick={() => onViewVersion?.(currentVersion.key)}
              size="sm"
            >
              {backToCurrentLabel}
            </Button>
          )}
        </div>
      )}
      {banner && (
        <div
          className="flex shrink-0 flex-col gap-2 border-b border-line bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] px-3.5 py-2.5"
          data-testid={CanvasPanelTestId.Banner}
          role="status"
        >
          <div
            className="font-sans text-[13px] font-semibold text-ink"
            data-testid={CanvasPanelTestId.BannerTitle}
          >
            {banner.title}
          </div>
          {banner.body != null && (
            <div
              className="max-h-[140px] overflow-y-auto font-sans text-[12px] whitespace-pre-wrap text-ink-2"
              data-testid={CanvasPanelTestId.BannerBody}
            >
              {banner.body}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              data-testid={CanvasPanelTestId.BannerConfirm}
              onClick={banner.onConfirm}
              size="sm"
            >
              {banner.confirmLabel}
            </Button>
            <Button
              data-testid={CanvasPanelTestId.BannerDismiss}
              intent="ghost"
              onClick={banner.onDismiss}
              size="sm"
            >
              {banner.dismissLabel ?? "Dismiss"}
            </Button>
          </div>
        </div>
      )}
      <div className="relative min-h-0 flex-1" data-testid={CanvasPanelTestId.Body}>
        <div
          className={cn("mx-auto size-full", PREVIEW_MAX[previewWidth])}
          data-testid={CanvasPanelTestId.FrameWrap}
        >
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
        </div>
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
