import type { Ref } from "react";
import type { ProgressTone } from "../Progress/Progress";
import { Sparkline } from "../Sparkline/Sparkline";

export enum KpiTileTestId {
  Root = "kpi-tile-root",
  Label = "kpi-tile-label",
  Value = "kpi-tile-value",
  Unit = "kpi-tile-unit",
  Trend = "kpi-tile-trend",
}

export interface KpiTileProps {
  label: string;
  value: string;
  /** Small suffix after the value, e.g. "%". */
  unit?: string;
  /** Optional trend series drawn as a sparkline under the value. */
  trend?: number[];
  trendTone?: ProgressTone;
  ref?: Ref<HTMLDivElement>;
}

/** A bordered KPI tile: label, light-weight number and an optional sparkline (Bridge `.kpi`). */
export function KpiTile({ label, value, unit, trend, trendTone = "accent", ref }: KpiTileProps) {
  return (
    <div
      className="min-w-0 rounded-[12px] border border-line bg-panel px-[14px] py-[12px]"
      data-testid={KpiTileTestId.Root}
      ref={ref}
    >
      <div className="text-[12px] text-ink-3" data-testid={KpiTileTestId.Label}>
        {label}
      </div>
      <div
        className="text-[26px] leading-[1.2] font-light tracking-[-0.03em] tabular-nums text-ink"
        data-testid={KpiTileTestId.Value}
      >
        {value}
        {unit && (
          <small className="ml-[3px] text-[13px] text-ink-3" data-testid={KpiTileTestId.Unit}>
            {unit}
          </small>
        )}
      </div>
      {trend && trend.length > 1 && (
        <div className="mt-[6px]" data-testid={KpiTileTestId.Trend}>
          <Sparkline data={trend} tone={trendTone} />
        </div>
      )}
    </div>
  );
}
