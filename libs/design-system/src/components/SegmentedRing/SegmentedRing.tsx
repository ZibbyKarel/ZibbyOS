import type { Ref } from "react";
import type { StateTone } from "../../stateTone";
import { stateToneVar } from "../../stateTone";

export enum SegmentedRingTestId {
  Root = "segmented-ring-root",
  Graphic = "segmented-ring-graphic",
  Segment = "segmented-ring-segment",
  Used = "segmented-ring-used",
  Caption = "segmented-ring-caption",
}

export interface SegmentedRingProps {
  /** Segments filled so far (one per iteration). */
  used: number;
  /** Total segments (the loop budget). */
  max: number;
  /** Colour of the filled segments. */
  tone: StateTone;
  /** Small caption under the big number, e.g. `"z 12 iterací"`. Omitted: numeral only. */
  caption?: string;
  /** Big numeral text; defaults to `used` (e.g. `"–"` before anything ran). */
  value?: string;
  ariaLabel: string;
  /** Fixed pixel size. Omitted: responsive, 86px on phones and 132px from `sm` up. */
  size?: number;
  ref?: Ref<HTMLDivElement>;
}

const R = 56;
const C = 66;

function point(angle: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [C + R * Math.cos(rad), C + R * Math.sin(rad)];
}

/**
 * Seznamy goal ring: one arc segment per iteration of the loop budget. Filled
 * segments take the state colour. While the work is live (`working`) or waits on a
 * decision (`blocked`), segment `used` is the current one: state colour, pulsing; once
 * every segment is filled the last one pulses instead. The numeral and caption sit in the middle.
 */
export function SegmentedRing({
  used,
  max,
  tone,
  caption,
  value,
  ariaLabel,
  size,
  ref,
}: SegmentedRingProps) {
  const total = Math.max(1, max);
  const filled = Math.max(0, Math.min(total, used));
  const gap = total > 12 ? 5 : 7;
  const seg = 360 / total;
  const live = tone === "working" || tone === "blocked";
  const current = live && filled < total ? filled : -1;
  const pulsing = live ? (filled < total ? filled : filled - 1) : -1;
  return (
    <div
      className={size ? "relative shrink-0" : "relative size-[86px] shrink-0 sm:size-[132px]"}
      data-testid={SegmentedRingTestId.Root}
      ref={ref}
      style={size ? { width: size, height: size } : undefined}
    >
      <svg
        aria-label={ariaLabel}
        className="block size-full"
        data-testid={SegmentedRingTestId.Graphic}
        role="img"
        viewBox="0 0 132 132"
      >
        {Array.from({ length: total }).map((_, i) => {
          const a0 = i * seg + gap / 2;
          const a1 = (i + 1) * seg - gap / 2;
          const [x0, y0] = point(a0);
          const [x1, y1] = point(a1);
          const on = i < filled;
          return (
            <path
              className={i === pulsing ? "animate-pulse motion-reduce:animate-none" : ""}
              d={`M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`}
              data-current={i === current}
              data-filled={on}
              data-testid={SegmentedRingTestId.Segment}
              fill="none"
              key={i}
              stroke={
                on || i === current
                  ? stateToneVar[tone]
                  : "color-mix(in srgb, var(--color-ink) 11%, transparent)"
              }
              strokeWidth={9}
            />
          );
        })}
      </svg>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center"
        data-testid={SegmentedRingTestId.Caption}
      >
        <b
          className={
            size
              ? "leading-none font-light tracking-[-0.04em] text-ink tabular-nums"
              : "text-[22px] leading-none font-light tracking-[-0.04em] text-ink tabular-nums sm:text-[34px]"
          }
          data-testid={SegmentedRingTestId.Used}
          // A fixed-size ring scales the numeral with it (34px at the design's 132px).
          style={size ? { fontSize: Math.round((size * 34) / 132) } : undefined}
        >
          {value ?? used}
        </b>
        {caption && <small className="mt-1 text-[9px] text-ink-3 sm:text-[11px]">{caption}</small>}
      </div>
    </div>
  );
}
