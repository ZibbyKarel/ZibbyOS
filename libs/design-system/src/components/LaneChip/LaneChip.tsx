import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum LaneChipTestId {
  Root = "lane-chip-root",
  Own = "lane-chip-own",
  Hint = "lane-chip-hint",
  Grip = "lane-chip-grip",
}

/** `semi` = violet, `auto` = amber, `neutral` = plain (a capability with no lane colour). */
export type LaneChipTone = "neutral" | "semi" | "auto";

const toneClass: Record<LaneChipTone, string> = {
  neutral: "border-line-2 bg-panel-2",
  semi: "border-state-work/45 bg-state-work/[0.12]",
  auto: "border-accent/55 bg-accent/[0.13]",
};

export interface LaneChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "type"
> {
  tone?: LaneChipTone;
  /** Inherited from the parent row: borderless text, no fill. Own chips carry the fill. */
  inherited?: boolean;
  /** Own override: a small dot after the label. */
  own?: boolean;
  /** Not editable (read-only or locked row): plain cursor instead of grab. */
  locked?: boolean;
  /** While being dragged. */
  dragging?: boolean;
  /** Leading glyph (an `<Icon />`). */
  icon?: ReactNode;
  /** Trailing hint glyph (e.g. a warning). */
  hint?: ReactNode;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A capability chip that lives in one lane of the autonomy matrix. Native-draggable (pass
 * `draggable` + the drag handlers); a click opens the app's menu. `aria-expanded` rings it.
 */
export function LaneChip({
  tone = "neutral",
  inherited = false,
  own = false,
  dragging = false,
  locked = false,
  icon,
  hint,
  children,
  ref,
  ...rest
}: LaneChipProps) {
  return (
    <button
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-lg border pr-2.5 pl-2 font-sans text-[12px] font-medium whitespace-nowrap text-ink",
        locked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        toneClass[tone],
        inherited && "border-transparent bg-transparent text-ink-2",
        dragging && "opacity-35",
        "aria-expanded:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-ink)_25%,transparent)]",
        focusRing,
      )}
      data-testid={LaneChipTestId.Root}
      ref={ref}
      type="button"
      {...rest}
    >
      {!locked && (
        <span
          aria-hidden="true"
          className="-mr-0.5 text-[10px] leading-none tracking-[-2px] text-ink-3 opacity-70"
          data-testid={LaneChipTestId.Grip}
        >
          ⋮⋮
        </span>
      )}
      {icon}
      {children}
      {own && (
        <span
          aria-hidden="true"
          className="ml-0.5 size-[5px] rounded-full bg-ink"
          data-testid={LaneChipTestId.Own}
        />
      )}
      {hint && <span data-testid={LaneChipTestId.Hint}>{hint}</span>}
    </button>
  );
}
