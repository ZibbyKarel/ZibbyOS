import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import type { SheetTone } from "../AnchoredSheet/sheetTone";

const toneDot: Record<SheetTone, string> = {
  working: "bg-state-work",
  thinking: "bg-state-think",
  blocked: "bg-state-block",
  error: "bg-state-err",
  done: "bg-state-done",
  idle: "bg-state-idle",
  neutral: "bg-line-2",
  faint: "bg-line-2",
};

export enum DetailTableTestId {
  Root = "detail-table-root",
  Row = "detail-table-row",
  Cell = "detail-table-cell",
  Empty = "detail-table-empty",
}

/**
 * Row layouts of the reference detail sheet:
 * `kv` 110px/1fr key-value · `subtask` 96/44/1fr/90/1fr · `check` 1fr/auto (tone dot) · `file` 1fr/auto.
 */
export type DetailTableVariant = "kv" | "subtask" | "check" | "file";

export interface DetailTableRow {
  cells: readonly ReactNode[];
  /** State dot at the start of `subtask` / `check` rows. */
  tone?: SheetTone;
}

const rowBase: Record<DetailTableVariant, string> = {
  kv: "grid grid-cols-[110px_minmax(0,1fr)] gap-[10px] py-[8px]",
  subtask:
    "grid grid-cols-[96px_44px_minmax(0,1fr)_90px_minmax(0,1fr)] items-center gap-[10px] py-[8px] text-meta",
  check: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[10px] py-[7px] text-body",
  file: "grid grid-cols-[minmax(0,1fr)_auto] gap-[10px] py-[7px] font-mono text-mono",
};

// Per-column classes (index = cell position).
const cellCls: Record<DetailTableVariant, readonly string[]> = {
  kv: ["text-meta text-ink-3", "text-body text-ink"],
  subtask: [
    "text-ink-2",
    "",
    "text-ink-2",
    "",
    "overflow-hidden text-ellipsis whitespace-nowrap text-ink-3",
  ],
  check: ["", "text-ink-2"],
  file: ["overflow-hidden text-ellipsis whitespace-nowrap", "tabular-nums text-ink-2"],
};

export interface DetailTableProps {
  variant?: DetailTableVariant;
  rows: readonly DetailTableRow[];
  /** Shown (as a note) when there are no rows. */
  emptyText?: string;
}

/** Hairline-ruled rows (1px `--line` top rule each) in one of the reference's column layouts. */
export function DetailTable({ variant = "kv", rows, emptyText }: DetailTableProps) {
  return (
    <div className="flex flex-col" data-testid={DetailTableTestId.Root}>
      {rows.map((row, i) => (
        <div
          className={cn(
            "relative border-t border-line",
            rowBase[variant],
            row.tone && (variant === "subtask" || variant === "check") && "pl-[16px]",
          )}
          data-testid={DetailTableTestId.Row}
          data-tone={row.tone}
          key={i}
        >
          {row.tone && (variant === "subtask" || variant === "check") ? (
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-[2px] top-1/2 size-[6px] -translate-y-1/2 rounded-full",
                toneDot[row.tone],
              )}
            />
          ) : null}
          {row.cells.map((cell, j) => (
            <span className={cellCls[variant][j]} data-testid={DetailTableTestId.Cell} key={j}>
              {cell}
            </span>
          ))}
        </div>
      ))}
      {rows.length === 0 && emptyText ? (
        <div
          className="border-t border-line py-[9px] text-meta text-ink-3"
          data-testid={DetailTableTestId.Empty}
        >
          {emptyText}
        </div>
      ) : null}
    </div>
  );
}
