import type { Ref } from "react";
import { cn } from "../../utils/cn";

export enum BudgetGaugeTestId {
  Root = "budget-gauge-root",
  Percent = "budget-gauge-percent",
  Value = "budget-gauge-value",
  Row = "budget-gauge-row",
}

export interface BudgetGaugeRow {
  label: string;
  /** Right-aligned value ("318 / 500"). */
  value: string;
  /** Fill 0-100 of the thin bar under the row. */
  pct?: number;
}

export interface BudgetGaugeProps {
  /** Ring fill, 0-100 (clamped). */
  pct: number;
  /** Small caption above the number ("Budget · November"). */
  caption: string;
  /** The big figure ("$1 240"). */
  value: string;
  /** Muted suffix after the figure ("/ $2 000"). */
  of?: string;
  rows?: BudgetGaugeRow[];
  ref?: Ref<HTMLDivElement>;
}

const R = 38;
const C = 2 * Math.PI * R;

/** Company header budget gauge (design `.bgauge`): 84px ring, big spend figure and thin usage rows. */
export function BudgetGauge({ pct, caption, value, of, rows = [], ref }: BudgetGaugeProps) {
  const p = Math.max(0, Math.min(100, pct));
  const hot = p >= 90;
  return (
    <div
      className="flex items-center gap-[16px] rounded-[14px] border border-line bg-panel py-[14px] pr-[18px] pl-[14px]"
      data-testid={BudgetGaugeTestId.Root}
      ref={ref}
    >
      <div className="relative h-[84px] w-[84px] flex-none">
        <svg aria-hidden="true" className="absolute inset-0 -rotate-90" viewBox="0 0 84 84">
          <circle cx="42" cy="42" fill="none" r={R} stroke="var(--color-line-2)" strokeWidth="4" />
          <circle
            cx="42"
            cy="42"
            fill="none"
            r={R}
            stroke={hot ? "var(--color-warn)" : "var(--color-ink)"}
            strokeDasharray={`${(C * p) / 100} ${C}`}
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
        <b
          className="absolute inset-0 grid place-items-center font-mono text-[15px] font-medium text-ink"
          data-testid={BudgetGaugeTestId.Percent}
        >
          {Math.round(p)}%
        </b>
      </div>
      <div className="flex min-w-[170px] flex-col gap-[6px] text-[12px] text-ink-3">
        <span>{caption}</span>
        <span
          className="text-[22px] leading-[1.1] font-light tracking-[-0.03em] text-ink tabular-nums"
          data-testid={BudgetGaugeTestId.Value}
        >
          {value}
          {of && <small className="ml-[4px] text-[13px] text-ink-3">{of}</small>}
        </span>
        {rows.map((r) => (
          <span
            className="flex flex-col gap-[4px]"
            data-testid={BudgetGaugeTestId.Row}
            key={r.label}
          >
            <span className="flex justify-between gap-[10px]">
              <span>{r.label}</span>
              <span className="font-mono text-ink-2">{r.value}</span>
            </span>
            {r.pct !== undefined && (
              <span className="h-[4px] overflow-hidden rounded-full bg-ink/[0.09]">
                <i
                  className={cn("block h-full rounded-full", r.pct >= 90 ? "bg-warn" : "bg-ink-2")}
                  style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }}
                />
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
