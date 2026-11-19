import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum SettingsTableTestId {
  Root = "settings-table-root",
  Head = "settings-table-head",
  Row = "settings-table-row",
}

export interface SettingsTableRow {
  id: string;
  /** One cell per column. */
  cells: readonly ReactNode[];
  /** Amber-tinted row (a stale watcher). */
  attention?: boolean;
}

export interface SettingsTableProps {
  /** Column headings; hidden on phones where each row stacks. */
  columns: readonly string[];
  rows: readonly SettingsTableRow[];
  ref?: Ref<HTMLDivElement>;
}

const grid =
  "grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.6fr)_auto] items-center gap-x-4 px-4";

/** Compact read-only table inside a settings panel (Bridge `.st-wt`): bordered rows, mono first cell, last cell right. */
export function SettingsTable({ columns, rows, ref }: SettingsTableProps) {
  return (
    <div data-testid={SettingsTableTestId.Root} ref={ref} role="list">
      <div
        aria-hidden="true"
        className={cn(grid, "hidden border-t border-line py-2 text-[12px] text-ink-3 md:grid")}
        data-testid={SettingsTableTestId.Head}
      >
        {columns.map((c, i) => (
          <span className={i === columns.length - 1 ? "justify-self-end" : undefined} key={c}>
            {c}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div
          className={cn(grid, "border-t border-line py-[11px]", r.attention && "bg-warn/6")}
          data-testid={SettingsTableTestId.Row}
          key={r.id}
          role="listitem"
        >
          {r.cells.map((cell, i) => (
            <span
              className={cn(
                "min-w-0 text-[13px] text-ink-2",
                i === 0 && "font-mono text-ink",
                i > 0 && i < r.cells.length - 1 && "text-[12.5px] text-ink-3",
                i === r.cells.length - 1 && "justify-self-end",
              )}
              key={i}
            >
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
