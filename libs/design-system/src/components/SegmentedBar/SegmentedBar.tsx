import type { Ref } from "react";

export enum SegmentedBarTestId {
  Root = "segmented-bar-root",
  Segment = "segmented-bar-segment",
}

export type SegmentedBarTone = "run" | "warn" | "ok" | "bad" | "idle";

export interface SegmentedBarSegment {
  id: string;
  value: number;
  tone: SegmentedBarTone;
}

export interface SegmentedBarProps {
  segments: readonly SegmentedBarSegment[];
  ariaLabel: string;
  ref?: Ref<HTMLDivElement>;
}

const FILL: Record<SegmentedBarTone, string> = {
  run: "bg-run",
  warn: "bg-warn",
  ok: "bg-ok",
  bad: "bg-bad",
  idle: "bg-ink-3",
};

/** Proportional multi-colour ratio strip (design `.pj-strip`); zero-value segments are skipped. */
export function SegmentedBar({ segments, ariaLabel, ref }: SegmentedBarProps) {
  const live = segments.filter((s) => s.value > 0);
  return (
    <div
      aria-label={ariaLabel}
      className="flex h-[8px] gap-[2px] overflow-hidden rounded-[3px] bg-ink/[0.06]"
      data-testid={SegmentedBarTestId.Root}
      ref={ref}
      role="img"
    >
      {live.map((s) => (
        <i
          className={`block h-full ${FILL[s.tone]}`}
          data-testid={SegmentedBarTestId.Segment}
          key={s.id}
          style={{ flexGrow: s.value, flexBasis: 0 }}
        />
      ))}
    </div>
  );
}
