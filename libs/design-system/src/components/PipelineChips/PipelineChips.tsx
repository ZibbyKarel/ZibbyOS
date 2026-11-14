import type { Ref } from "react";
import type { StateTone } from "../../stateTone";
import { cn } from "../../utils/cn";

export enum PipelineChipsTestId {
  Root = "pipeline-chips-root",
  /** Suffixed with the chip index: `pipeline-chips-chip-0`. */
  Chip = "pipeline-chips-chip",
}

export interface PipelineChip {
  code: string;
  state: StateTone;
  /** Tooltip. */
  title?: string;
}

const TINT: Record<StateTone, string> = {
  working: "bg-state-work/10",
  thinking: "bg-state-think/10",
  blocked: "bg-state-block/12",
  error: "bg-state-err/10",
  done: "bg-state-done/10",
  idle: "bg-state-idle/10",
};

export interface PipelineChipsProps {
  chips: readonly PipelineChip[];
  ref?: Ref<HTMLSpanElement>;
}

/** Department pipeline chips: code chip tinted by the stage's state. */
export function PipelineChips({ chips, ref }: PipelineChipsProps) {
  return (
    <span className="flex gap-[4px]" data-testid={PipelineChipsTestId.Root} ref={ref}>
      {chips.map((c, i) => (
        <span
          className={cn(
            "inline-flex h-[20px] items-center rounded-sm px-[7px] text-[11.5px] font-medium",
            c.state === "idle" ? "text-ink-3" : "text-ink",
            TINT[c.state],
          )}
          data-testid={`${PipelineChipsTestId.Chip}-${i}`}
          key={`${c.code}-${i}`}
          title={c.title}
        >
          {c.code}
        </span>
      ))}
    </span>
  );
}
