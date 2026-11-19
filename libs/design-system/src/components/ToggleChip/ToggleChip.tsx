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
  /** `solid` (default) fills a pressed chip with ink; `quiet` only tints it (no border) and `plain` is bare text — a low-chrome filter row. */
  tone?: "solid" | "quiet" | "plain";
  ref?: Ref<HTMLButtonElement>;
}

/** Filter-style toggle chip (Bridge `.fchips`) — e.g. the TO recipient chips of the
 * Run Detail composer. Pressed = solid ink pill with on-ink text. */
export function ToggleChip({
  pressed,
  leading,
  children,
  tone = "solid",
  ref,
  ...rest
}: ToggleChipProps) {
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-full border pr-[10px] font-sans",
        tone === "solid" ? "h-[26px] text-[12px]" : "h-[22px] text-[11.5px]",
        "transition-colors duration-150 motion-reduce:transition-none",
        leading ? "pl-1" : "pl-[10px]",
        pressed
          ? tone === "quiet"
            ? "border-transparent bg-ink/[0.10] text-ink"
            : tone === "plain"
              ? "border-transparent text-ink"
              : "border-foreground bg-ink text-on-ink"
          : tone === "quiet"
            ? "border-transparent bg-ink/[0.04] text-ink-3 hover:text-ink"
            : tone === "plain"
              ? "border-transparent text-ink-3 hover:text-ink"
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
