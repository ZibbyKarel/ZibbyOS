import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export enum MeterTestId {
  Root = "meter-root",
  Label = "meter-label",
  Value = "meter-value",
  Bar = "meter-bar",
  Fill = "meter-fill",
  Note = "meter-note",
}

export type MeterTone = "ok" | "hot" | "bad";

const FILL: Record<MeterTone, string> = {
  ok: "bg-ink-2",
  hot: "bg-accent",
  bad: "bg-[color:var(--color-state-err)]",
};

export interface MeterProps {
  label: ReactNode;
  /** Mono value at the right of the label ("62 %", "$12/$50"). */
  value: ReactNode;
  /** Fill percentage, 0–100; omit for a label + value line without a bar. */
  pct?: number;
  /** `hot` = above 85 % (amber), `bad` = exhausted (rose). Default `ok`. */
  tone?: MeterTone;
  /** Accessible name of the bar (the label when it is a string). */
  barLabel?: string;
  /** Small line under the bar (amber when `hot`): "runs out in 2 h", "3 held over cap". */
  note?: ReactNode;
  /** Quiet label: small and muted (the value stays mono) — for dense budget rows. */
  quiet?: boolean;
}

/** Meters species row: label, mono value, thin bar. Phrasing-only, so it can sit inside a link. */
export function Meter({
  label,
  value,
  pct,
  tone = "ok",
  barLabel,
  note,
  quiet = false,
}: MeterProps) {
  const p = pct === undefined ? undefined : Math.max(0, Math.min(100, pct));
  return (
    <span
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-[10px] gap-y-[5px] px-[2px] py-[var(--rowpad)]"
      data-testid={MeterTestId.Root}
    >
      <span
        className={cn("min-w-0 truncate", quiet ? "text-meta text-ink-3" : "text-body text-ink")}
        data-testid={MeterTestId.Label}
      >
        {label}
      </span>
      <span className="font-mono text-mono text-ink-2" data-testid={MeterTestId.Value}>
        {value}
      </span>
      {p === undefined ? null : (
        <span
          aria-label={barLabel ?? (typeof label === "string" ? label : undefined)}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={p}
          className="relative col-span-2 block h-[5px] overflow-hidden rounded-full bg-ink/10"
          data-testid={MeterTestId.Bar}
          role="progressbar"
        >
          <span
            className={cn("absolute inset-y-0 left-0 rounded-full", FILL[tone])}
            data-testid={MeterTestId.Fill}
            style={{ width: `${p}%` }}
          />
        </span>
      )}
      {note ? (
        <span
          className={cn("col-span-2 text-meta", tone === "hot" ? "text-accent-fg" : "text-ink-3")}
          data-testid={MeterTestId.Note}
        >
          {note}
        </span>
      ) : null}
    </span>
  );
}
