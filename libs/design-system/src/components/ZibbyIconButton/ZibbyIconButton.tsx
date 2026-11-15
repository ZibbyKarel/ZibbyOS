import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";

export enum ZibbyIconButtonTestId {
  Root = "zibby-icon-button-root",
}

/** `md` 28 px (overlay top bar) · `sm` 26 px (row actions) · `xs` 22 px (inline clear). */
export type ZibbyIconButtonSize = "md" | "sm" | "xs";

const sizeClass: Record<ZibbyIconButtonSize, string> = {
  md: "h-7 w-7 rounded-[7px]",
  sm: "h-[26px] w-[26px] rounded-[7px]",
  xs: "h-[22px] w-[22px] rounded-[6px]",
};

export interface ZibbyIconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children" | "aria-label"
> {
  icon: IconName;
  /** Accessible name — the button has no visible text. */
  label: string;
  size?: ZibbyIconButtonSize;
  /** Mirrors the glyph horizontally (a chevron pointing left). */
  mirror?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The quiet square icon button of the Zibby overlay (`.ib` in the design): faint ink at rest,
 * `raised` fill and full ink on hover/focus. Always labelled.
 */
export function ZibbyIconButton({
  icon,
  label,
  size = "md",
  mirror = false,
  type = "button",
  ref,
  ...rest
}: ZibbyIconButtonProps) {
  const glyphSize = size === "xs" ? "xs" : size === "sm" ? "sm" : "md";
  return (
    <button
      aria-label={label}
      className={cn(
        "grid shrink-0 cursor-pointer place-items-center border-none bg-transparent p-0 text-ink-3",
        "transition-colors duration-100 motion-reduce:transition-none",
        "hover:bg-raised hover:text-ink",
        sizeClass[size],
        focusRing,
      )}
      data-testid={ZibbyIconButtonTestId.Root}
      ref={ref}
      type={type}
      {...rest}
    >
      <span className={cn("grid place-items-center", mirror && "-scale-x-100")}>
        <Icon name={icon} size={glyphSize} />
      </span>
    </button>
  );
}
