import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";

/**
 * The small controls of the top-chrome header (`AppHeader` zones B and C): the
 * filled "New" button and the icon button with a
 * badge. They are plain buttons - the app owns the popovers.
 */
export enum HeaderChromeTestId {
  NewButton = "header-new-button",
  IconButton = "header-icon-button",
  IconButtonBadge = "header-icon-button-badge",
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

// ---------------------------------------------------------------------------
// New button
// ---------------------------------------------------------------------------

export interface HeaderNewButtonProps extends ButtonProps {
  /** Visible label; omit for the icon-only variant (then pass `aria-label`). */
  label?: string;
  icon?: IconName;
  /** Trailing dropdown chevron (default true). */
  chevron?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** `.tc-new` - the ink-filled primary "create" trigger (amber is reserved for "waits for you"). */
export function HeaderNewButton({
  label,
  icon = "plus",
  chevron = true,
  ref,
  ...rest
}: HeaderNewButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg bg-ink px-2 font-sans text-[12.5px] font-medium whitespace-nowrap text-on-ink",
        "transition-colors hover:bg-[color-mix(in_srgb,var(--color-ink)_84%,var(--color-bg))] motion-reduce:transition-none",
        !label && "w-[30px] justify-center px-0",
        focusRing,
      )}
      data-testid={HeaderChromeTestId.NewButton}
      ref={ref}
      type="button"
      {...rest}
    >
      <Icon name={icon} size="sm" stroke="medium" />
      {label}
      {label && chevron && (
        <span className="-ml-px flex rotate-90 opacity-55">
          <Icon name="chevron" size="xs" stroke="medium" />
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icon button
// ---------------------------------------------------------------------------

export interface HeaderIconButtonProps extends ButtonProps {
  /** The glyph (an `<Icon />`). */
  children: ReactNode;
  /** Count badge (e.g. unread). Omit for none. */
  badge?: ReactNode;
  /** Badge colour: `ink` (default) or amber `attention` (something needs action). */
  badgeTone?: "ink" | "attention";
  /** Bare amber dot instead of a count (phone toolbar). */
  dot?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** `.tc-ib` - 32px ghost icon button with an optional badge. Needs an `aria-label`. */
export function HeaderIconButton({
  children,
  badge,
  badgeTone = "ink",
  dot = false,
  ref,
  ...rest
}: HeaderIconButtonProps) {
  return (
    <button
      className={cn(
        "relative inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-2",
        "transition-colors hover:bg-panel-2 hover:text-ink motion-reduce:transition-none",
        focusRing,
      )}
      data-testid={HeaderChromeTestId.IconButton}
      ref={ref}
      type="button"
      {...rest}
    >
      {children}
      {badge != null && (
        <b
          aria-hidden="true"
          className={cn(
            "absolute top-0.5 right-0 grid h-[15px] min-w-[15px] place-items-center rounded-full px-1 font-sans text-[9.5px] font-semibold shadow-[0_0_0_2px_var(--color-panel)]",
            badgeTone === "attention" ? "bg-accent text-accent-contrast" : "bg-ink text-on-ink",
          )}
          data-testid={HeaderChromeTestId.IconButtonBadge}
        >
          {badge}
        </b>
      )}
      {dot && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 size-[7px] rounded-full bg-accent shadow-[0_0_0_2px_var(--color-panel)]"
          data-testid={HeaderChromeTestId.IconButtonBadge}
        />
      )}
    </button>
  );
}
