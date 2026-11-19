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

/** Tile grid species: tiles keep their natural width (names are never cut) and wrap, each row growing to fill it. */
export function TileGrid({ children }: TileGridProps) {
  return (
    <div
      className="flex flex-wrap gap-[8px] px-[6px] pb-[10px] pt-[4px]"
      data-testid={TileGridTestId.Root}
    >
      {children}
    </div>
  );
}

export interface TileProps {
  /** Project / entity mark (logo or monogram) shown before the title. */
  logo?: ReactNode;
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
  logo,
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
        "flex min-w-[140px] flex-auto flex-col gap-[3px] whitespace-nowrap rounded-[9px] border border-solid px-[12px] py-[10px] text-left",
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
      <span className="flex items-center gap-[8px] text-body font-medium text-ink">
        {logo ? <span className="flex flex-none">{logo}</span> : null}
        <span data-testid={TileGridTestId.Title}>{title}</span>
        {lead ? <span className="ml-auto flex flex-none pl-[6px]">{lead}</span> : null}
      </span>
      {sub ? (
        <span
          className={cn(
            "block font-mono text-[11px] leading-[16px]",
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
