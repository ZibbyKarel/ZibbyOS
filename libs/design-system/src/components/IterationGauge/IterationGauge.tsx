import type { ReactNode, Ref } from "react";

export enum IterationGaugeTestId {
  Root = "iteration-gauge-root",
  Svg = "iteration-gauge-svg",
  Fill = "iteration-gauge-fill",
  Used = "iteration-gauge-used",
  Caption = "iteration-gauge-caption",
}

export interface IterationGaugeProps {
  /** Iterations used so far. */
  used: number;
  /** The hard fuse — iterations before the loop parks. */
  max: number;
  /** Small mono word under the number ("of 8"). */
  ofLabel: string;
  /** Eyebrow label beside the ring ("Iterations"). */
  label: ReactNode;
  /** Sentence under the label ("4 left before it parks"). */
  caption?: ReactNode;
  /**
   * Amber arc. Omitted = automatic from 75 % (a fuse running out); pass it when "full" is
   * good news (projects done) and only something else should warn.
   */
  hot?: boolean;
  /** Accessible name of the ring ("4 of 8 iterations used"). */
  ariaLabel: string;
  ref?: Ref<HTMLDivElement>;
}

const R = 46;
const C = 2 * Math.PI * R;
const ARC = C * 0.75;

/**
 * A three-quarter ring gauge for a bounded loop: the big number is the iterations used,
 * the arc fills toward `max` and turns amber from 75 %. Generic — any "n of max" counter.
 */
export function IterationGauge({
  used,
  max,
  ofLabel,
  label,
  caption,
  ariaLabel,
  hot: hotProp,
  ref,
}: IterationGaugeProps) {
  const p = max > 0 ? Math.max(0, Math.min(1, used / max)) : 0;
  const hot = hotProp ?? p >= 0.75;
  return (
    <div className="flex items-center gap-[22px]" data-testid={IterationGaugeTestId.Root} ref={ref}>
      <svg
        aria-label={ariaLabel}
        data-testid={IterationGaugeTestId.Svg}
        height={112}
        role="img"
        viewBox="0 0 112 112"
        width={112}
      >
        <circle
          cx={56}
          cy={56}
          fill="none"
          r={R}
          stroke="var(--color-line-2)"
          strokeDasharray={`${ARC} ${C}`}
          strokeLinecap="round"
          strokeWidth={8}
          transform="rotate(135 56 56)"
        />
        <circle
          cx={56}
          cy={56}
          data-testid={IterationGaugeTestId.Fill}
          fill="none"
          r={R}
          stroke={hot ? "var(--color-warn)" : "var(--color-ink)"}
          strokeDasharray={`${ARC * p} ${C}`}
          strokeLinecap="round"
          strokeWidth={8}
          transform="rotate(135 56 56)"
        />
        <text
          data-testid={IterationGaugeTestId.Used}
          fill="var(--color-ink)"
          fontSize={28}
          fontWeight={300}
          textAnchor="middle"
          x={56}
          y={60}
        >
          {used}
        </text>
        <text
          fill="var(--color-ink-3)"
          fontFamily="var(--font-mono)"
          fontSize={11}
          textAnchor="middle"
          x={56}
          y={80}
        >
          {ofLabel}
        </text>
      </svg>
      <div className="flex min-w-0 flex-col gap-[2px]" data-testid={IterationGaugeTestId.Caption}>
        <span className="text-meta text-ink-3">{label}</span>
        {caption ? <span className="text-body text-ink-2">{caption}</span> : null}
      </div>
    </div>
  );
}
