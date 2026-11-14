import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum ToggleChipTestId {
  Root = "toggle-chip-root",
  Leading = "toggle-chip-leading",
}

export interface ToggleChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> {
  pressed: boolean;
  /** Small leading visual, e.g. a small AgentBadge. */
  leading?: ReactNode;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** Filter-style toggle chip (Bridge `.fchips`) — e.g. the TO recipient chips of the
 * Run Detail composer. Pressed = solid ink pill with on-ink text. */
export function ToggleChip({ pressed, leading, children, ref, ...rest }: ToggleChipProps) {
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        "flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border pr-[10px] font-sans text-[12px]",
        "transition-colors duration-150 motion-reduce:transition-none",
        leading ? "pl-1" : "pl-[10px]",
        pressed
          ? "border-foreground bg-ink text-on-ink"
          : "border-line text-ink-2 hover:border-line-2 hover:text-ink",
        focusRing,
      )}
      data-testid={ToggleChipTestId.Root}
      ref={ref}
      type="button"
      {...rest}
    >
      {leading && <span data-testid={ToggleChipTestId.Leading}>{leading}</span>}
      {children}
    </button>
  );
}
