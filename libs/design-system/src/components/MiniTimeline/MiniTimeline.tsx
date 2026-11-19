import type { Ref } from "react";

export enum MiniTimelineTestId {
  Root = "mini-timeline-root",
  Now = "mini-timeline-now",
  Last = "mini-timeline-last",
  Next = "mini-timeline-next",
  Fire = "mini-timeline-fire",
  LabelLeft = "mini-timeline-label-left",
  LabelNow = "mini-timeline-label-now",
  LabelRight = "mini-timeline-label-right",
}

export interface MiniTimelineProps {
  /** Position (0-100) of the "now" tick; the bar before it is filled. Omit for a pure fire-dot strip. */
  now?: number;
  /** Show the filled "last fired" dot at the left end. */
  last?: boolean;
  /** Show the hollow "next" ring at the right end. */
  next?: boolean;
  /** Fire dots (0-100) for event triggers. */
  fires?: number[];
  leftLabel?: string;
  nowLabel?: string;
  rightLabel?: string;
  /** Off automation: dimmed. */
  off?: boolean;
  ref?: Ref<HTMLDivElement>;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** Last / now / next strip (design `.au-tl`), or a row of fire dots over a period. */
export function MiniTimeline({
  now,
  last,
  next,
  fires,
  leftLabel,
  nowLabel,
  rightLabel,
  off,
  ref,
}: MiniTimelineProps) {
  return (
    <div
      className={`relative mx-[6px] h-[34px] ${off ? "opacity-55" : ""}`}
      data-testid={MiniTimelineTestId.Root}
      ref={ref}
    >
      <span
        aria-hidden="true"
        className="absolute top-[7px] right-0 left-0 h-[2px] rounded-[2px] bg-line-2"
      />
      {now !== undefined && (
        <>
          <span
            aria-hidden="true"
            className="absolute top-[7px] left-0 h-[2px] rounded-[2px] bg-ink-3"
            style={{ width: `${clamp(now)}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute top-[1px] -ml-px h-[14px] w-[2px] rounded-[2px] bg-ink"
            data-testid={MiniTimelineTestId.Now}
            style={{ left: `${clamp(now)}%` }}
          />
        </>
      )}
      {last && (
        <span
          aria-hidden="true"
          className="absolute top-[3px] -ml-[5px] size-[10px] rounded-full bg-ok shadow-[0_0_0_2px_var(--color-panel)]"
          data-testid={MiniTimelineTestId.Last}
          style={{ left: 0 }}
        />
      )}
      {next && (
        <span
          aria-hidden="true"
          className="absolute top-[3px] -ml-[5px] size-[10px] rounded-full border-2 border-ink-2 bg-panel shadow-[0_0_0_2px_var(--color-panel)]"
          data-testid={MiniTimelineTestId.Next}
          style={{ left: "100%" }}
        />
      )}
      {fires?.map((f, i) => (
        <span
          aria-hidden="true"
          className="absolute top-[4px] -ml-[4px] size-[8px] rounded-full bg-ink-2 shadow-[0_0_0_2px_var(--color-panel)]"
          data-testid={MiniTimelineTestId.Fire}
          key={i}
          style={{ left: `${clamp(f)}%` }}
        />
      ))}
      {leftLabel && (
        <span
          className="absolute top-[19px] left-0 text-[11px] whitespace-nowrap text-ink-3"
          data-testid={MiniTimelineTestId.LabelLeft}
        >
          {leftLabel}
        </span>
      )}
      {nowLabel && now !== undefined && (
        <span
          className="absolute top-[19px] -translate-x-1/2 text-[11px] font-medium whitespace-nowrap text-ink-2"
          data-testid={MiniTimelineTestId.LabelNow}
          style={{ left: `${clamp(now)}%` }}
        >
          {nowLabel}
        </span>
      )}
      {rightLabel && (
        <span
          className="absolute top-[19px] right-0 text-[11px] whitespace-nowrap text-ink-3"
          data-testid={MiniTimelineTestId.LabelRight}
        >
          {rightLabel}
        </span>
      )}
    </div>
  );
}
