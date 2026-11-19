import type { ReactNode, Ref } from "react";

export enum StatCellsTestId {
  Root = "stat-cells-root",
  Cell = "stat-cells-cell",
  Note = "stat-cells-note",
}

export interface StatCellsItem {
  id: string;
  label: string;
  value: string | number;
  /** Amber line under the label ("1 na tebe"). */
  note?: ReactNode;
}

export interface StatCellsProps {
  items: readonly StatCellsItem[];
  ref?: Ref<HTMLDivElement>;
}

/** Bordered strip of big-number cells split by hairlines (design `.dp-k`); 2×2 on a phone. */
export function StatCells({ items, ref }: StatCellsProps) {
  return (
    <div
      className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-line sm:grid-cols-4"
      data-testid={StatCellsTestId.Root}
      ref={ref}
    >
      {items.map((it) => (
        <div
          className="flex min-w-0 flex-col gap-[2px] border-b border-l border-line px-[10px] py-[8px] [&:nth-child(2n+1)]:border-l-0 sm:border-b-0 sm:[&:nth-child(2n+1)]:border-l sm:[&:first-child]:border-l-0"
          data-testid={StatCellsTestId.Cell}
          key={it.id}
        >
          <span className="text-[19px] leading-[1.15] font-light tracking-[-0.02em] tabular-nums text-ink">
            {it.value}
          </span>
          <span className="text-[11px] leading-[1.25] text-ink-3">{it.label}</span>
          {it.note && (
            <span className="text-[11px] text-warn" data-testid={StatCellsTestId.Note}>
              {it.note}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
