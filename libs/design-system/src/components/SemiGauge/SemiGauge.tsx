import type { ReactNode, Ref } from "react";

export enum SemiGaugeTestId {
  Root = "semi-gauge-root",
  Value = "semi-gauge-value",
  Caption = "semi-gauge-caption",
  Arc = "semi-gauge-arc",
}

export interface SemiGaugeProps {
  /** Used percentage; clamped to 0–100 for the arc, the label shows the raw number. */
  pct: number;
  /** Small line under the arc ("dnes $12.40 z $40"). */
  caption?: ReactNode;
  ariaLabel: string;
  ref?: Ref<HTMLDivElement>;
}

/** Semicircle budget gauge (design `.co-g`): arc turns amber from 80 % and rose from 100 %. */
export function SemiGauge({ pct, caption, ariaLabel, ref }: SemiGaugeProps) {
  const p = Math.max(0, Math.min(100, pct));
  const stroke =
    pct >= 100 ? "var(--color-bad)" : pct >= 80 ? "var(--color-warn)" : "var(--color-ink-3)";
  return (
    <div
      aria-label={ariaLabel}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(p)}
      className="flex flex-col items-center gap-[2px]"
      data-testid={SemiGaugeTestId.Root}
      ref={ref}
      role="progressbar"
    >
      <div className="relative h-[66px] w-[120px]">
        <svg aria-hidden height="66" viewBox="0 0 120 66" width="120">
          <path
            d="M10 60 A50 50 0 0 1 110 60"
            fill="none"
            pathLength={100}
            stroke="color-mix(in srgb, var(--color-ink) 9%, transparent)"
            strokeLinecap="round"
            strokeWidth="9"
          />
          <path
            d="M10 60 A50 50 0 0 1 110 60"
            data-testid={SemiGaugeTestId.Arc}
            fill="none"
            pathLength={100}
            stroke={stroke}
            strokeDasharray={`${p} 100`}
            strokeLinecap="round"
            strokeWidth="9"
          />
        </svg>
        <span
          className="absolute inset-x-0 bottom-0 text-center text-[22px] leading-none font-light tabular-nums"
          data-testid={SemiGaugeTestId.Value}
          style={{ color: pct >= 80 ? stroke : undefined }}
        >
          {Math.round(pct)} %
        </span>
      </div>
      {caption && (
        <small
          className="text-[11.5px] whitespace-nowrap text-ink-3"
          data-testid={SemiGaugeTestId.Caption}
        >
          {caption}
        </small>
      )}
    </div>
  );
}
