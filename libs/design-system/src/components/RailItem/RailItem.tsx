import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import type { StateTone } from "../../stateTone";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum RailItemTestId {
  Root = "rail-item-root",
  Leading = "rail-item-leading",
  Marker = "rail-item-marker",
  Title = "rail-item-title",
  Aside = "rail-item-aside",
  Meta = "rail-item-meta",
  Detail = "rail-item-detail",
}

/** Where a stage sits on the timeline: finished, happening now, or still to come. */
export type RailItemTense = "past" | "present" | "future";

export interface RailItemProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "title" | "children"
> {
  /** 30px centred leading column (e.g. an AgentBadge). Replaced by the timeline marker when `tense` is set. */
  leading?: ReactNode;
  title: ReactNode;
  /** Right-aligned caption on the title line (time, state word). */
  aside?: ReactNode;
  /** Small caption under the title (e.g. "will run: agent · model"). */
  meta?: ReactNode;
  /** Extra lines under the meta (route, checkpoints, nested loop rounds). Phrasing content only. */
  children?: ReactNode;
  selected?: boolean;
  /** The phase is running right now: 4px `run`-coloured bar and a tinted background. */
  running?: boolean;
  /**
   * Timeline mode: a marker + connector replace `leading`. `past` = done check, muted text;
   * `present` = marker in `markerTone` (pulsing while working / blocked), raised background;
   * `future` = dashed marker and connector.
   */
  tense?: RailItemTense;
  /** A sub-phase of the row above: indented under it with a guide line, so it reads as nested. */
  nested?: boolean;
  /** The present marker's state colour. Default `working`. */
  markerTone?: StateTone;
  ref?: Ref<HTMLButtonElement>;
}

const markerFill: Record<StateTone, string> = {
  working: "bg-state-work border-state-work",
  thinking: "bg-state-think border-state-think",
  blocked: "bg-state-block border-state-block",
  error: "bg-state-err border-state-err",
  done: "bg-state-done border-state-done",
  idle: "bg-state-idle border-state-idle",
};

const markerMotion: Partial<Record<StateTone, string>> = {
  working: "animate-zb-live motion-reduce:animate-none",
  blocked: "animate-zb-pulse motion-reduce:animate-none",
};

function Marker({ tense, tone }: { tense: RailItemTense; tone: StateTone }) {
  return (
    <span
      className={cn(
        "relative z-[1] mt-[3px] flex size-[14px] items-center justify-center rounded-full border",
        tense === "past" && cn(markerFill.done, "text-accent-contrast"),
        tense === "present" && cn(markerFill[tone], markerMotion[tone]),
        tense === "future" && "border-dashed border-line-2 bg-bg",
      )}
      data-tense={tense}
      data-testid={RailItemTestId.Marker}
      data-tone={tense === "present" ? tone : undefined}
    >
      {tense === "past" && <Icon name="check" size="xs" stroke="medium" />}
    </span>
  );
}

/** A selectable row of a vertical rail (Run Detail stage list). The selected
 * row gets a 2px ink bar on the left and a raised background. */
export function RailItem({
  leading,
  title,
  aside,
  meta,
  children,
  selected,
  running,
  tense,
  nested,
  markerTone = "working",
  ref,
  ...rest
}: RailItemProps) {
  return (
    <button
      aria-current={selected || undefined}
      className={cn(
        "grid w-full cursor-pointer grid-cols-[30px_minmax(0,1fr)] gap-[10px] border-l-2 py-[9px] pr-4 pl-[14px] text-left hover:bg-elevated",
        nested &&
          "relative pl-[34px] before:absolute before:top-0 before:bottom-0 before:left-[21px] before:border-l before:border-line-2",
        tense ? "items-stretch" : "items-center",
        running
          ? "border-l-4 border-run bg-[color-mix(in_srgb,var(--color-run)_12%,transparent)]"
          : selected
            ? "border-foreground bg-elevated"
            : tense === "present"
              ? "border-transparent bg-elevated"
              : "border-transparent",
        focusRingInset,
      )}
      data-nested={nested || undefined}
      data-running={running || undefined}
      data-tense={tense}
      data-testid={RailItemTestId.Root}
      ref={ref}
      type="button"
      {...rest}
    >
      <span
        className={cn(
          "relative flex justify-center",
          // the connector runs through the marker column, dashed toward stages still to come
          tense &&
            "before:absolute before:top-[-9px] before:bottom-[-9px] before:left-1/2 before:border-l before:border-line-2",
          tense === "future" && "before:border-dashed",
        )}
        data-testid={RailItemTestId.Leading}
      >
        {tense ? <Marker tense={tense} tone={markerTone} /> : leading}
      </span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 truncate text-[13px] font-medium",
              tense === "past" ? "text-foreground-dim" : "text-foreground",
            )}
            data-testid={RailItemTestId.Title}
            title={typeof title === "string" ? title : undefined}
          >
            {title}
          </span>
          {aside != null && (
            <span
              className="ml-auto shrink-0 font-mono text-[11px] text-foreground-faint"
              data-testid={RailItemTestId.Aside}
            >
              {aside}
            </span>
          )}
        </span>
        {meta && (
          <span
            className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11.5px] text-foreground-faint"
            data-testid={RailItemTestId.Meta}
          >
            {meta}
          </span>
        )}
        {children != null && (
          <span
            className="flex min-w-0 flex-col gap-[3px] text-[11.5px] text-foreground-faint"
            data-testid={RailItemTestId.Detail}
          >
            {children}
          </span>
        )}
      </span>
    </button>
  );
}
