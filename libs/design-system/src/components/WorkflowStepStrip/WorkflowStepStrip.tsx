import { Fragment } from "react";
import type { Ref } from "react";
import type { StateTone } from "../../stateTone";
import { cn } from "../../utils/cn";
import { StateDot } from "../StatePill/StatePill";

export interface WorkflowStepStripPhase {
  label: string;
  state: StateTone;
  /** The connector rendered *after* this phase points back to an earlier
   *  phase (`⇄`) instead of forward (`→`) — a code-review rework loop. */
  loopBack?: boolean;
}

export enum WorkflowStepStripTestId {
  Root = "workflow-step-strip-root",
  /** Each phase chip is suffixed with its index, e.g. `workflow-step-strip-step-0`. */
  Step = "workflow-step-strip-step",
  Connector = "workflow-step-strip-connector",
}

export interface WorkflowStepStripProps {
  phases: WorkflowStepStripPhase[];
  /** Index of the in-flight phase, given the `--ink` border. */
  current?: number;
  ref?: Ref<HTMLDivElement>;
}

/** DS.md §8 flow/handoff step grid, phase-level — a row of role chips joined
 * by `→` (or `⇄` for a rework loop-back), inside one subtask's workflow. */
export function WorkflowStepStrip({ phases, current, ref }: WorkflowStepStripProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      data-testid={WorkflowStepStripTestId.Root}
      ref={ref}
      role="list"
    >
      {phases.map((phase, i) => (
        <Fragment key={i}>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm border px-[8px] py-[3px] text-meta",
              i === current
                ? "border-line-2 bg-panel-2 text-ink"
                : "border-line bg-transparent text-ink-2",
            )}
            data-testid={`${WorkflowStepStripTestId.Step}-${i}`}
            role="listitem"
          >
            <StateDot px={7} state={phase.state} />
            {phase.label}
          </span>
          {i < phases.length - 1 && (
            <span
              aria-hidden="true"
              className="text-meta text-ink-3"
              data-testid={WorkflowStepStripTestId.Connector}
            >
              {phase.loopBack ? "⇄" : "→"}
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
