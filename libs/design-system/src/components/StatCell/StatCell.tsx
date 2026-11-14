import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import type { SheetTone } from "../AnchoredSheet/sheetTone";

/** State dot colour per tone; `neutral` / `faint` carry no dot. */
const toneDot: Record<SheetTone, string | undefined> = {
  working: "bg-state-work",
  thinking: "bg-state-think",
  blocked: "bg-state-block",
  error: "bg-state-err",
  done: "bg-state-done",
  idle: "bg-state-idle",
  neutral: undefined,
  faint: undefined,
};

export enum StatCellTestId {
  Grid = "stat-cell-grid",
  Root = "stat-cell-root",
  Label = "stat-cell-label",
  Title = "stat-cell-title",
  Value = "stat-cell-value",
  Icon = "stat-cell-icon",
  Meta = "stat-cell-meta",
  Status = "stat-cell-status",
}

export interface StatCellGridProps {
  /** `3` = three equal stat cells in the sheet gutter; `fit` = auto-fit min 150px (task chain). */
  columns?: 3 | "fit";
  children: ReactNode;
}

/** Grid of `StatCell`s (1px apart, each ringed by `--line`). */
export function StatCellGrid({ columns = 3, children }: StatCellGridProps) {
  return (
    <div
      className={cn(
        "grid gap-[8px]",
        columns === 3
          ? "mx-[20px] mt-[16px] grid-cols-[repeat(3,minmax(0,1fr))]"
          : "grid-cols-[repeat(auto-fit,minmax(150px,1fr))]",
      )}
      data-testid={StatCellTestId.Grid}
    >
      {children}
    </div>
  );
}

export interface StatCellProps {
  /** State of the cell: a small dot before the caption (none for `neutral` / `faint`). */
  tone?: SheetTone;
  /** Sunk fill (an active chain step). */
  filled?: boolean;
  /** Caption (meta, ink-3). */
  label?: string;
  /** 13/500 name. */
  title?: string;
  /** 16/500 tabular value (a node for composed values, e.g. coloured +/− parts). */
  value?: ReactNode;
  /** Status glyph rendered before the value; decorative (`aria-hidden`), the value carries the meaning. */
  icon?: ReactNode;
  /** Secondary line (meta). */
  meta?: string;
  /** State text (meta, 500). */
  status?: string;
}

/** One metric cell: caption, value and/or lines, ringed by `--line`, with a state dot when toned. */
export function StatCell({
  tone = "faint",
  filled = false,
  label,
  title,
  value,
  icon,
  meta,
  status,
}: StatCellProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[3px] rounded-[10px] border border-line px-[12px] py-[9px]",
        filled ? "bg-sunk" : "bg-ink/[0.015]",
      )}
      data-testid={StatCellTestId.Root}
      data-tone={tone}
    >
      {label ? (
        <span
          className="flex items-center gap-[6px] text-meta text-ink-3"
          data-testid={StatCellTestId.Label}
        >
          {toneDot[tone] ? (
            <span
              aria-hidden="true"
              className={cn("size-[6px] shrink-0 rounded-full", toneDot[tone])}
            />
          ) : null}
          {label}
        </span>
      ) : null}
      {title ? (
        <span className="text-widget-t2 text-ink" data-testid={StatCellTestId.Title}>
          {title}
        </span>
      ) : null}
      {value || icon ? (
        <div className="flex items-center gap-[6px]">
          {icon ? (
            <span aria-hidden="true" className="flex shrink-0" data-testid={StatCellTestId.Icon}>
              {icon}
            </span>
          ) : null}
          {value ? (
            <span
              className="text-[16px] font-medium tabular-nums text-ink"
              data-testid={StatCellTestId.Value}
            >
              {value}
            </span>
          ) : null}
        </div>
      ) : null}
      {meta ? (
        <span className="text-meta text-ink-3" data-testid={StatCellTestId.Meta}>
          {meta}
        </span>
      ) : null}
      {status ? (
        <span className="text-meta font-medium" data-testid={StatCellTestId.Status}>
          {status}
        </span>
      ) : null}
    </div>
  );
}
