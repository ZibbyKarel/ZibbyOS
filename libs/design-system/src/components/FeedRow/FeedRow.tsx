import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";

export enum FeedRowTestId {
  Root = "feed-row-root",
  Glyph = "feed-row-glyph",
  Who = "feed-row-who",
  Text = "feed-row-text",
  Age = "feed-row-age",
  Unread = "feed-row-unread",
}

export interface FeedRowProps {
  /** Source glyph (GH, JI, #, @) in the 26px tile. */
  glyph: ReactNode;
  /** Source name for the tile (tooltip + accessible name). */
  glyphLabel?: string;
  who?: ReactNode;
  /** The one line (truncated). */
  text: ReactNode;
  age?: ReactNode;
  /** Bold line + dot. Only for data that carries an unread flag. */
  unread?: boolean;
  /** Unique row key (`data-rk`) — keyboard navigation and the sheet anchor use it. */
  rowKey?: string;
  selected?: boolean;
  onClick?: () => void;
}

/** Feed species row: source glyph, who, one line, age. A button when clickable. */
export function FeedRow({
  glyph,
  glyphLabel,
  who,
  text,
  age,
  unread = false,
  rowKey,
  selected = false,
  onClick,
}: FeedRowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        "grid w-full grid-cols-[26px_minmax(0,1fr)_auto] items-start gap-[10px] rounded-[8px] px-[4px] py-[var(--rowpad)] text-left",
        onClick && cn("cursor-pointer appearance-none hover:bg-ink/[0.03]", focusRingInset),
        selected && "ring-2 ring-inset ring-accent",
      )}
      data-rk={rowKey}
      data-testid={FeedRowTestId.Root}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <span
        aria-label={glyphLabel}
        className="grid size-[26px] place-items-center rounded-[8px] border border-line bg-panel-2 font-mono text-[10px] font-semibold text-ink-2"
        data-testid={FeedRowTestId.Glyph}
        role={glyphLabel ? "img" : undefined}
        title={glyphLabel}
      >
        {glyph}
      </span>
      <span className="min-w-0">
        {who ? (
          <span className="block truncate text-meta text-ink-3" data-testid={FeedRowTestId.Who}>
            {who}
          </span>
        ) : null}
        <span
          className={cn("block truncate text-body", unread ? "font-medium text-ink" : "text-ink-2")}
          data-testid={FeedRowTestId.Text}
        >
          {text}
        </span>
      </span>
      <span className="flex items-center gap-[6px] font-mono text-mono text-ink-3">
        {unread ? (
          <span
            className="inline-block size-[6px] rounded-full bg-ink"
            data-testid={FeedRowTestId.Unread}
          />
        ) : null}
        <span data-testid={FeedRowTestId.Age}>{age}</span>
      </span>
    </Tag>
  );
}
