import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";

export enum TileGridTestId {
  Root = "tile-grid-root",
  Tile = "tile-grid-tile",
  Title = "tile-grid-title",
  Sub = "tile-grid-sub",
}

export interface TileGridProps {
  children?: ReactNode;
}

/** Tile grid species: as many ~160px columns as fit. */
export function TileGrid({ children }: TileGridProps) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-[8px] py-[4px]"
      data-testid={TileGridTestId.Root}
    >
      {children}
    </div>
  );
}

export interface TileProps {
  /** Leading state glyph (a `StateDot`). */
  lead?: ReactNode;
  title: string;
  /** Mono second line (branch). */
  sub?: ReactNode;
  /** Error: the whole tile takes a rose tint. */
  alert?: boolean;
  /** Unique row key (`data-rk`) — keyboard navigation and the sheet anchor use it. */
  rowKey?: string;
  selected?: boolean;
  onClick?: () => void;
}

/** One tile: dot + title, mono sub line. A button when clickable. */
export function Tile({
  lead,
  title,
  sub,
  alert = false,
  rowKey,
  selected = false,
  onClick,
}: TileProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        "flex w-full min-w-0 flex-col gap-[3px] rounded-[9px] border border-solid px-[12px] py-[10px] text-left",
        alert
          ? "border-[color-mix(in_srgb,var(--color-state-err)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-state-err)_7%,transparent)]"
          : "border-line bg-ink/[0.025] hover:border-line-2",
        onClick && cn("cursor-pointer appearance-none", focusRingInset),
        selected && "ring-2 ring-inset ring-accent",
      )}
      data-alert={alert || undefined}
      data-rk={rowKey}
      data-testid={TileGridTestId.Tile}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <span className="flex min-w-0 items-center gap-[7px] text-body font-medium text-ink">
        {lead ? <span className="flex flex-none">{lead}</span> : null}
        <span className="min-w-0 truncate" data-testid={TileGridTestId.Title} title={title}>
          {title}
        </span>
      </span>
      {sub ? (
        <span
          className={cn(
            "block truncate pl-[14px] font-mono text-[11px] leading-[16px]",
            alert ? "text-[var(--color-state-err)]" : "text-ink-3",
          )}
          data-testid={TileGridTestId.Sub}
        >
          {sub}
        </span>
      ) : null}
    </Tag>
  );
}
