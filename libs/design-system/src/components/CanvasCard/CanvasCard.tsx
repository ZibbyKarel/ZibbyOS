"use client";
import { cn } from "../../utils/cn";
import { focusRingOffset } from "../../utils/focus";

export enum CanvasCardTestId {
  Root = "canvas-card-root",
  Thumb = "canvas-card-thumb",
  Frame = "canvas-card-frame",
  Title = "canvas-card-title",
  Version = "canvas-card-version",
  Note = "canvas-card-note",
}

export type CanvasCardSize = "card" | "pin";

export interface CanvasCardProps {
  title: string;
  /** Thumbnail page URL. */
  src: string;
  version?: number;
  /** Renders a button. Ignored when `href` is set. */
  onOpen?: () => void;
  /** Renders an anchor (`target="_blank" rel="noopener noreferrer"`). */
  href?: string;
  /** Secondary line, e.g. "Open on the Mac". */
  note?: string;
  size?: CanvasCardSize;
  /** Must match the page's own scheme, else the browser paints an opaque canvas. */
  colorScheme?: "light" | "dark";
}

/** The page is rendered at this width, then scaled down to the thumbnail. */
const PAGE_W = 1000;

const SIZES: Record<CanvasCardSize, { root: string; thumb: string; scale: string }> = {
  card: {
    root: "w-[420px] max-w-full flex-col",
    thumb: "aspect-[16/10] w-full border-b border-line",
    scale: "scale-[0.42]",
  },
  pin: {
    root: "w-[72px] flex-col",
    thumb: "size-[72px]",
    scale: "scale-[0.072]",
  },
};

/** Thread card for a canvas: live scaled thumbnail, title and version; opens the panel or a tab. */
export function CanvasCard({
  title,
  src,
  version,
  onOpen,
  href,
  note,
  size = "card",
  colorScheme = "dark",
}: CanvasCardProps) {
  const s = SIZES[size];
  const pin = size === "pin";
  const body = (
    <>
      <span
        className={cn("relative block overflow-hidden bg-bg", s.thumb)}
        data-testid={CanvasCardTestId.Thumb}
      >
        <iframe
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-transparent",
            s.scale,
          )}
          data-testid={CanvasCardTestId.Frame}
          loading="lazy"
          sandbox="allow-scripts"
          src={src}
          style={{ width: PAGE_W, height: pin ? PAGE_W : 625, colorScheme }}
          tabIndex={-1}
          title=""
        />
      </span>
      {!pin && (
        <span className="flex flex-col gap-0.5 px-3 py-2.5 text-left">
          <span className="flex items-center gap-2">
            <span
              className="min-w-0 truncate font-sans text-[13px] font-semibold text-ink"
              data-testid={CanvasCardTestId.Title}
            >
              {title}
            </span>
            {version != null && (
              <span
                className="rounded-md bg-[color-mix(in_srgb,var(--color-ink)_6%,transparent)] px-1.5 py-px font-mono text-[11px] text-ink-2"
                data-testid={CanvasCardTestId.Version}
              >
                v{version}
              </span>
            )}
          </span>
          {note != null && (
            <span className="text-[12px] text-ink-3" data-testid={CanvasCardTestId.Note}>
              {note}
            </span>
          )}
        </span>
      )}
    </>
  );
  const cls = cn(
    "flex cursor-pointer overflow-hidden rounded-[14px] border border-line-2 bg-panel text-left transition-colors hover:bg-panel-2",
    focusRingOffset,
    s.root,
  );
  // Pin shows no text, so the name must live on the control itself.
  const name = pin ? `${title}${version != null ? ` v${version}` : ""}` : undefined;
  return href ? (
    <a
      aria-label={name}
      className={cls}
      data-testid={CanvasCardTestId.Root}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {body}
    </a>
  ) : (
    <button
      aria-label={name}
      className={cls}
      data-testid={CanvasCardTestId.Root}
      onClick={onOpen}
      type="button"
    >
      {body}
    </button>
  );
}
