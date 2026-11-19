import { type ReactNode, type Ref, useId } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum RadioMatrixTestId {
  Root = "radio-matrix-root",
  Row = "radio-matrix-row",
  Cell = "radio-matrix-cell",
}

export interface RadioMatrixColumn {
  id: string;
  label: string;
}

export interface RadioMatrixRow {
  id: string;
  label: string;
  hint?: string;
  /** The selected column id. */
  value: string;
}

export interface RadioMatrixProps {
  ariaLabel: string;
  /** Header of the first (row-label) column. */
  rowHeader: string;
  columns: readonly RadioMatrixColumn[];
  rows: readonly RadioMatrixRow[];
  onChange: (rowId: string, columnId: string) => void;
  disabled?: boolean;
  /** Footnote under the table. */
  caption?: ReactNode;
  ref?: Ref<HTMLTableElement>;
}

/**
 * A rows × options matrix with one radio per cell and exactly one choice per row (the
 * settings live-log "Visible / Grouped / Hidden" grid). Native radios, one group per row.
 */
export function RadioMatrix({
  ariaLabel,
  rowHeader,
  columns,
  rows,
  onChange,
  disabled = false,
  caption,
  ref,
}: RadioMatrixProps) {
  const uid = useId();
  return (
    <table
      aria-label={ariaLabel}
      className="w-full border-collapse text-[12.5px]"
      data-testid={RadioMatrixTestId.Root}
      ref={ref}
    >
      <thead>
        <tr>
          <th className="border-t border-line px-4 py-2 text-left text-[11.5px] font-medium text-ink-3">
            {rowHeader}
          </th>
          {columns.map((c) => (
            <th
              className="w-[110px] border-t border-line px-[6px] py-2 text-center text-[11.5px] font-medium whitespace-nowrap text-ink-3"
              key={c.id}
              scope="col"
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr data-testid={RadioMatrixTestId.Row} key={r.id}>
            <th
              className="border-t border-line px-4 py-[7px] text-left font-normal text-ink"
              scope="row"
            >
              <span className="block text-[13px] font-medium">{r.label}</span>
              {r.hint && <small className="block text-[11.5px] text-ink-3">{r.hint}</small>}
            </th>
            {columns.map((c) => (
              <td className="border-t border-line px-[6px] py-[7px] text-center" key={c.id}>
                <input
                  aria-label={`${r.label}: ${c.label}`}
                  checked={r.value === c.id}
                  className={cn(
                    "m-0 box-border size-4 cursor-pointer appearance-none rounded-full border-[1.5px] border-ink-3 bg-transparent align-middle checked:border-[5px] checked:border-ink disabled:cursor-not-allowed disabled:opacity-50",
                    focusRing,
                  )}
                  data-testid={`${RadioMatrixTestId.Cell}-${r.id}-${c.id}`}
                  disabled={disabled}
                  name={`${uid}-${r.id}`}
                  onChange={() => onChange(r.id, c.id)}
                  type="radio"
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {caption && (
        <caption className="caption-bottom px-4 pt-[10px] pb-4 text-left text-[12px] text-ink-3">
          {caption}
        </caption>
      )}
    </table>
  );
}
