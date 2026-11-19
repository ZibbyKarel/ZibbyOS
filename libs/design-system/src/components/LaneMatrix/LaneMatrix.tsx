import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum LaneMatrixTestId {
  Root = "lane-matrix-root",
  /** Each column header is suffixed with its `key`. */
  Head = "lane-matrix-head",
  /** Each row is suffixed with its `key`. */
  Row = "lane-matrix-row",
  /** Each row header cell is suffixed with the row `key`. */
  RowHead = "lane-matrix-row-head",
  /** Each lane cell is suffixed with `${rowKey}-${columnKey}`. */
  Cell = "lane-matrix-cell",
  Connector = "lane-matrix-connector",
  LaneHead = "lane-matrix-lane-head",
}

export type LaneHeadTone = "neutral" | "semi" | "auto";

const headToneClass: Record<LaneHeadTone, string> = {
  neutral: "text-ink",
  semi: "text-state-work",
  auto: "text-accent-fg",
};

export interface LaneHeadProps {
  tone?: LaneHeadTone;
  /** Leading glyph (e.g. an orb). */
  icon?: ReactNode;
  title: string;
  /** One-line meaning under the title. */
  meaning?: string;
}

/** A column header of the lane matrix: glyph, lane name and a one-line meaning. */
export function LaneHead({ tone = "neutral", icon, title, meaning }: LaneHeadProps) {
  return (
    <div className="flex items-center gap-2" data-testid={LaneMatrixTestId.LaneHead}>
      {icon}
      <span>
        <b className={cn("block text-[13px] font-semibold", headToneClass[tone])}>{title}</b>
        {meaning && <small className="block text-[11.5px] font-normal text-ink-3">{meaning}</small>}
      </span>
    </div>
  );
}

export interface LaneMatrixColumn {
  key: string;
  header: ReactNode;
}

export interface LaneMatrixRow {
  key: string;
  /** Row header cell: icon, label, muted line, actions. */
  header: ReactNode;
  /** One cell per column, in column order. */
  cells: ReactNode[];
  /** Hangs under the previous row with a tree connector. */
  nested?: boolean;
  /** Slightly tinted (the default / global row). */
  tinted?: boolean;
}

export interface LaneMatrixProps {
  /** Header of the first (row title) column. */
  rowHeader: ReactNode;
  /** Accessible table caption (screen readers only). */
  caption?: string;
  columns: LaneMatrixColumn[];
  rows: LaneMatrixRow[];
  ref?: Ref<HTMLTableElement>;
}

/**
 * The autonomy matrix frame: one bordered card, a header row of lanes, vertical column
 * dividers and a row header with an optional tree connector for nested rows. Cells are
 * the caller's (`LaneCell`s); on a phone the card scrolls sideways.
 */
export function LaneMatrix({ rowHeader, caption, columns, rows, ref }: LaneMatrixProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table
        className="w-full min-w-[820px] table-fixed border-separate border-spacing-0 text-[12.5px]"
        data-testid={LaneMatrixTestId.Root}
        ref={ref}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            <th
              className="w-[260px] border-b border-line-2 bg-ink/[0.03] px-3 py-2.5 text-left font-medium text-ink-3"
              scope="col"
            >
              {rowHeader}
            </th>
            {columns.map((col) => (
              <th
                className="border-b border-l border-line-2 bg-ink/[0.03] px-3 py-2.5 text-left align-top font-medium text-ink-3"
                data-testid={`${LaneMatrixTestId.Head}-${col.key}`}
                key={col.key}
                scope="col"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr data-testid={`${LaneMatrixTestId.Row}-${row.key}`} key={row.key}>
              <th
                className={cn(
                  "border-b border-line px-3 py-2.5 text-left align-middle font-normal [tr:last-child>&]:border-b-0",
                  row.tinted && "bg-ink/[0.025]",
                )}
                data-testid={`${LaneMatrixTestId.RowHead}-${row.key}`}
                scope="row"
              >
                <div className={cn("relative", row.nested && "pl-[26px]")}>
                  {row.nested && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-3.5 left-2.5 h-7 w-2.5 rounded-bl-md border-b border-l border-line-2"
                      data-testid={LaneMatrixTestId.Connector}
                    />
                  )}
                  {row.header}
                </div>
              </th>
              {columns.map((col, i) => (
                <td
                  className={cn(
                    "border-b border-l border-line p-1.5 align-middle [tr:last-child>&]:border-b-0",
                    row.tinted && "bg-ink/[0.025]",
                  )}
                  data-testid={`${LaneMatrixTestId.Cell}-${row.key}-${col.key}`}
                  key={col.key}
                >
                  {row.cells[i]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
