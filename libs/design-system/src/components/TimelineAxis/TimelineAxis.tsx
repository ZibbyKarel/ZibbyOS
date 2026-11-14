import { cn } from "../../utils/cn";

export enum TimelineAxisTestId {
  Root = "timeline-axis-root",
  Now = "timeline-axis-now",
  Tick = "timeline-axis-tick",
  Marker = "timeline-axis-marker",
}

export interface TimelinePoint {
  /** Position on the axis, 0 (now) … 1 (end of the window). */
  at: number;
  label: string;
  /** Marker only: drawn rose (e.g. the automation failed recently). */
  error?: boolean;
}

export interface TimelineAxisProps {
  /** Accessible summary of the axis (it is one image to assistive tech). */
  label: string;
  /** Clock labels under the axis. */
  ticks?: TimelinePoint[];
  /** Diamonds — the starts; `label` is their tooltip. */
  markers?: TimelinePoint[];
}

const pct = (at: number) => `${Math.min(1, Math.max(0, at)) * 100}%`;

/** Timeline species: a horizontal axis starting at "now" (amber tick) with diamond start markers. */
export function TimelineAxis({ label, ticks = [], markers = [] }: TimelineAxisProps) {
  const diamond = (m: TimelinePoint, i: number) => (
    <span
      className={cn(
        "absolute top-[12px] size-[10px] -translate-x-1/2 rotate-45 rounded-[2px] border-[1.5px] border-solid",
        m.error
          ? "border-[var(--color-state-err)] bg-[color-mix(in_srgb,var(--color-state-err)_20%,transparent)]"
          : "border-ink-2 bg-raised",
      )}
      data-error={m.error || undefined}
      data-testid={TimelineAxisTestId.Marker}
      key={i}
      style={{ left: pct(m.at) }}
      title={m.label}
    />
  );
  return (
    <div
      aria-label={label}
      className="relative mx-[6px] mb-[6px] mt-[4px] h-[46px]"
      data-testid={TimelineAxisTestId.Root}
      role="img"
    >
      <span className="absolute inset-x-0 top-[17px] h-px bg-line-2" />
      <span
        className="absolute left-0 top-[7px] h-[21px] w-[2px] rounded-[2px] bg-accent"
        data-testid={TimelineAxisTestId.Now}
      />
      {ticks.map((t) => (
        <span
          className="absolute top-[28px] -translate-x-1/2 font-mono text-[10.5px] text-ink-3"
          data-testid={TimelineAxisTestId.Tick}
          key={t.label}
          style={{ left: pct(t.at) }}
        >
          {t.label}
        </span>
      ))}
      {markers.map(diamond)}
    </div>
  );
}
