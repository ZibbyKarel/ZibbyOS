import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum LaneChipTestId {
  Root = "lane-chip-root",
  Own = "lane-chip-own",
}

/** `semi` = violet, `auto` = amber: the colour a switched-on chip takes. */
export type LaneChipTone = "semi" | "auto";

const onClass: Record<LaneChipTone, string> = {
  semi: "border-state-work/55 bg-state-work/[0.16] text-ink",
  auto: "border-accent/60 bg-accent/[0.17] text-ink",
};

export interface LaneChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "type" | "aria-pressed"
> {
  tone: LaneChipTone;
  /** Switched on: coloured with a check; off: outline with a plus. Exposed as `aria-pressed`. */
  pressed: boolean;
  /** An exception against the parent row: a small dot after the label. */
  own?: boolean;
  children: string;
  ref?: Ref<HTMLButtonElement>;
}

/** A capability toggle chip of the autonomy table: on = colour + check, off = outline + plus. */
export function LaneChip({ tone, pressed, own = false, children, ref, ...rest }: LaneChipProps) {
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border pr-2.5 pl-2 font-sans text-[12px] font-medium whitespace-nowrap",
        "transition-colors motion-reduce:transition-none",
        pressed
          ? onClass[tone]
          : "border-line-2 bg-transparent text-ink-2 hover:bg-panel-2 hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-60",
        focusRing,
      )}
      data-testid={LaneChipTestId.Root}
      ref={ref}
      type="button"
      {...rest}
    >
      <Icon name={pressed ? "check" : "plus"} size="xs" stroke="medium" />
      {children}
      {own && (
        <span
          aria-hidden="true"
          className="ml-0.5 size-[5px] rounded-full bg-current"
          data-testid={LaneChipTestId.Own}
        />
      )}
    </button>
  );
}
