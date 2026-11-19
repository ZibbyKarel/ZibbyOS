import type { Ref } from "react";
import { cn } from "../../utils/cn";

export enum BudgetBarsTestId {
  Root = "budget-bars-root",
  Item = "budget-bars-item",
  Fill = "budget-bars-fill",
}

export interface BudgetBarsItem {
  id: string;
  label: string;
  /** Used percentage (may exceed 100). */
  pct: number;
  /** Mono value text; defaults to "NN %". */
  value?: string;
  /** Exact numbers for a hover tooltip ("5/10 · $1 / $2"). */
  detail?: string;
}

export interface BudgetBarsProps {
  items: readonly BudgetBarsItem[];
  ref?: Ref<HTMLDivElement>;
}

/** Three thin labelled usage bars (design `.pj-bud`): amber from 80 %, rose from 100 %. */
export function BudgetBars({ items, ref }: BudgetBarsProps) {
  return (
    <div className="grid grid-cols-3 gap-[12px]" data-testid={BudgetBarsTestId.Root} ref={ref}>
      {items.map((it) => {
        const hot = it.pct >= 80;
        const over = it.pct >= 100;
        return (
          <div
            className="flex min-w-0 flex-col gap-[5px] text-[11px] text-ink-3"
            data-testid={BudgetBarsTestId.Item}
            key={it.id}
            title={it.detail}
          >
            <span className="flex justify-between">
              <span>{it.label}</span>
              <span
                className={cn(
                  "font-mono whitespace-nowrap text-ink-2",
                  hot && "text-warn",
                  over && "text-bad",
                )}
              >
                {it.value ?? `${Math.round(it.pct)} %`}
              </span>
            </span>
            <span className="block h-[3px] overflow-hidden rounded-full bg-ink/[0.08]">
              <i
                className={cn(
                  "block h-full rounded-full bg-ink-3",
                  hot && "bg-warn",
                  over && "bg-bad",
                )}
                data-testid={BudgetBarsTestId.Fill}
                style={{ width: `${Math.max(0, Math.min(100, it.pct))}%` }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
