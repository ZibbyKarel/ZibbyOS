import { type ButtonHTMLAttributes } from "react";
import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "../../utils/cn";
import { disabledClasses, focusRingOffset } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";
import { StatusDot } from "../StatusDot/StatusDot";

/**
 * The single button system (Zibby 2.0 design) — 8px radius, 1px border, sans
 * sentence-case label, weight 500:
 *   primary   — amber fill, on-amber text ("Run all")
 *   secondary — `--line2` hairline, `--ink` text, `--p2` hover (Bridge `.btn`)
 *   outline   — `--ink` hairline, `--ink` text (the Bridge EDIT LAYOUT toggle; DONE is `primary`)
 *   ghost     — secondary without the hairline (quietest action)
 *   ink       — solid `--ink` fill, page-coloured text (Bridge `.btn.ink`, the white "primary" of a dark page)
 *   danger    — secondary + a leading `--s-err` dot, never a red fill
 * An icon-only button (no children): 9px side padding.
 * `joined` squares the inner corners of a split-button segment (`DropDownButton`)
 * so the pair reads as one control.
 */
const button = cva(
  [
    "inline-flex items-center justify-center gap-1.5 border font-sans font-medium",
    "cursor-pointer rounded-md whitespace-nowrap transition-colors duration-150",
    focusRingOffset,
    disabledClasses,
  ],
  {
    variants: {
      intent: {
        primary: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
        secondary: "border-line-2 bg-transparent text-ink hover:bg-panel-2",
        outline: "border-ink bg-transparent text-ink hover:bg-panel-2",
        ghost: "border-transparent bg-transparent text-ink-2 hover:bg-panel-2 hover:text-ink",
        ink: "border-ink bg-ink text-bg hover:opacity-85",
        danger: "border-line-2 bg-transparent text-ink hover:bg-panel-2",
      },
      // Bridge `.btn` (30px, 12.5px) / `.btn.sm` (26px, 12px).
      size: {
        sm: "h-[26px] px-[9px] text-[12px]",
        md: "h-[30px] px-[12px] text-[12.5px]",
      },
      iconOnly: { true: "px-[9px]", false: "" },
      block: { true: "w-full", false: "" },
      joined: { start: "rounded-r-none", end: "rounded-l-none", none: "" },
    },
    defaultVariants: {
      intent: "primary",
      size: "md",
      iconOnly: false,
      block: false,
      joined: "none",
    },
  },
);

/** The button class recipe, shared with `HoldButton` so both stay one look. Not public. */
export const buttonClasses = button;

/** Spinner border color per intent — primary spins in the panel-contrast color. */
const spinnerClass: Record<ButtonIntent, string> = {
  primary: "border-accent-contrast/30 border-t-accent-contrast",
  secondary: "border-ink/30 border-t-ink",
  outline: "border-ink/30 border-t-ink",
  ghost: "border-ink-2/30 border-t-ink-2",
  ink: "border-bg/30 border-t-bg",
  danger: "border-ink/30 border-t-ink",
};

export type ButtonIntent = "primary" | "secondary" | "outline" | "ghost" | "danger" | "ink";
export type ButtonSize = "sm" | "md";

export enum ButtonTestId {
  Root = "button-root",
  Icon = "button-icon",
  Spinner = "button-spinner",
  /** The `--s-err` dot a `danger` button leads with. */
  Dot = "button-dot",
}

export interface ButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">,
    Omit<VariantProps<typeof button>, "intent" | "size" | "iconOnly"> {
  intent?: ButtonIntent;
  size?: ButtonSize;
  /** Optional leading icon glyph. */
  icon?: IconName;
  /** Replaces the icon with a spinner and suppresses clicks. */
  loading?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  intent = "primary",
  size = "md",
  block,
  joined,
  icon,
  loading = false,
  children,
  type = "button",
  disabled,
  onClick,
  ref,
  ...props
}: ButtonProps) {
  const iconSize = size === "sm" ? "xs" : "sm";

  return (
    <button
      aria-busy={loading || undefined}
      className={button({ intent, size, block, joined, iconOnly: children == null })}
      data-testid={ButtonTestId.Root}
      disabled={disabled}
      onClick={loading ? undefined : onClick}
      ref={ref}
      type={type}
      {...props}
    >
      {intent === "danger" && (
        <StatusDot aria-hidden data-testid={ButtonTestId.Dot} size="75" tone="error" />
      )}
      {loading ? (
        <span
          className={cn(
            "h-3 w-3 shrink-0 rounded-full border-[1.5px] animate-spinner motion-reduce:animate-none",
            spinnerClass[intent],
          )}
          data-testid={ButtonTestId.Spinner}
        />
      ) : icon ? (
        <Icon data-testid={ButtonTestId.Icon} name={icon} size={iconSize} stroke="medium" />
      ) : null}
      {children}
    </button>
  );
}
