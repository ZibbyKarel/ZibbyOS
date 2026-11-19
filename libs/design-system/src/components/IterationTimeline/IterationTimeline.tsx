import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { Icon, type IconName } from "../Icon/Icon";

export enum IterationTimelineTestId {
  Root = "iteration-timeline-root",
  Item = "iteration-timeline-item",
  Marker = "iteration-timeline-marker",
  Title = "iteration-timeline-title",
  Meta = "iteration-timeline-meta",
  Row = "iteration-timeline-row",
  Toggle = "iteration-timeline-toggle",
  Body = "iteration-timeline-body",
}

export type IterationTimelineTone = "ok" | "bad" | "run" | "paused" | "idle";
export type IterationRowTone = "ok" | "bad" | "neutral";

export interface IterationTimelineRow {
  /** Row caption ("Maker", "Verifier"). */
  label: string;
  icon: IconName;
  tone?: IterationRowTone;
  text: ReactNode;
}

export interface IterationTimelineProps {
  ariaLabel: string;
  children: ReactNode;
  ref?: Ref<HTMLOListElement>;
}

/** A vertical rail of numbered steps — the container of {@link IterationTimelineItem}s. */
export function IterationTimeline({ ariaLabel, children, ref }: IterationTimelineProps) {
  return (
    <ol
      aria-label={ariaLabel}
      className="relative m-0 flex list-none flex-col p-0 before:absolute before:top-[20px] before:bottom-[20px] before:left-[21px] before:w-px before:bg-line-2"
      data-testid={IterationTimelineTestId.Root}
      ref={ref}
    >
      {children}
    </ol>
  );
}

const MARKER: Record<IterationTimelineTone, string> = {
  ok: "border-ok text-ok",
  bad: "border-bad text-bad",
  run: "border-run text-run",
  paused: "border-warn bg-warn-solid text-accent-fg",
  idle: "border-line-2 text-ink-2",
};

const ROW_ICON: Record<IterationRowTone, string> = {
  ok: "bg-ok/15 text-ok",
  bad: "bg-bad/15 text-bad",
  neutral: "bg-ink/10 text-ink-2",
};

export interface IterationTimelineItemProps {
  /** The marker content — the step number. */
  marker: ReactNode;
  tone?: IterationTimelineTone;
  title: ReactNode;
  /** Right-aligned mono facts ("3m 12s", "$0.31"). */
  meta?: ReactNode;
  rows: IterationTimelineRow[];
  /** Makes the item expandable: the toggle's open state. Omit for a static item. */
  expanded?: boolean;
  onToggle?: () => void;
  /** Accessible name of the toggle ("Show log of iteration 3"). */
  toggleLabel?: string;
  /** Expanded content (a log) — rendered only while `expanded`. */
  children?: ReactNode;
}

/** One step of an {@link IterationTimeline}: numbered marker, title + meta, labelled rows, optional log. */
export function IterationTimelineItem({
  marker,
  tone = "idle",
  title,
  meta,
  rows,
  expanded = false,
  onToggle,
  toggleLabel,
  children,
}: IterationTimelineItemProps) {
  return (
    <li
      className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-[4px] py-[8px]"
      data-testid={IterationTimelineTestId.Item}
    >
      <span
        className={cn(
          "relative z-[1] grid h-[26px] w-[26px] place-items-center justify-self-center rounded-full border bg-panel font-mono text-[11px] font-semibold shadow-[0_0_0_4px_var(--color-background)]",
          MARKER[tone],
        )}
        data-testid={IterationTimelineTestId.Marker}
      >
        {marker}
      </span>
      <div className="min-w-0 overflow-hidden rounded-[11px] border border-line bg-panel">
        <div className="flex items-center gap-[10px] px-[12px] py-[10px] text-body">
          <b className="font-semibold" data-testid={IterationTimelineTestId.Title}>
            {title}
          </b>
          <span className="flex-1" />
          {meta ? (
            <span
              className="flex gap-[12px] font-mono text-[11.5px] text-ink-3"
              data-testid={IterationTimelineTestId.Meta}
            >
              {meta}
            </span>
          ) : null}
          {onToggle ? (
            <button
              aria-expanded={expanded}
              aria-label={toggleLabel}
              className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded-md text-ink-3 hover:bg-panel-2 hover:text-ink"
              data-testid={IterationTimelineTestId.Toggle}
              onClick={onToggle}
              type="button"
            >
              <Icon name="chevron" size="sm" />
            </button>
          ) : null}
        </div>
        {rows.map((row) => (
          <div
            className="grid grid-cols-[76px_20px_minmax(0,1fr)] items-start gap-[8px] border-t border-line px-[12px] py-[8px] text-body text-ink-2"
            data-testid={IterationTimelineTestId.Row}
            key={row.label}
          >
            <span className="pt-px text-[11.5px] text-ink-3">{row.label}</span>
            <span
              className={cn(
                "grid h-[18px] w-[18px] place-items-center rounded-full",
                ROW_ICON[row.tone ?? "neutral"],
              )}
            >
              <Icon name={row.icon} size="xs" />
            </span>
            <span className="min-w-0 break-words">{row.text}</span>
          </div>
        ))}
        {expanded && children ? (
          <div className="border-t border-line p-[12px]" data-testid={IterationTimelineTestId.Body}>
            {children}
          </div>
        ) : null}
      </div>
    </li>
  );
}
