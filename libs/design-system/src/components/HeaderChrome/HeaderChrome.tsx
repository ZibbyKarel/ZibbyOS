import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";

/**
 * The small controls of the top-chrome header (`AppHeader` zones B and C): the
 * filled "New" button, the status chip, the mode group, the icon button with a
 * badge and the usage ring. They are plain buttons - the app owns the popovers.
 */
export enum HeaderChromeTestId {
  NewButton = "header-new-button",
  Status = "header-status",
  StatusDot = "header-status-dot",
  StatusCount = "header-status-count",
  StatusRings = "header-status-rings",
  StatusUpdate = "header-status-update",
  ModeGroup = "header-mode-group",
  ModeButton = "header-mode-button",
  ModeLiveDot = "header-mode-live-dot",
  IconButton = "header-icon-button",
  IconButtonBadge = "header-icon-button-badge",
  UsageRing = "header-usage-ring",
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
// Status chip
// ---------------------------------------------------------------------------

export type HeaderStatusState = "idle" | "working" | "blocked";

const dotClass: Record<HeaderStatusState, string> = {
  idle: "bg-state-idle",
  working: "bg-state-work",
  blocked: "bg-state-block",
};

export interface HeaderStatusProps extends ButtonProps {
  /** The number shown in mono (items waiting, otherwise agents running). */
  count: ReactNode;
  /** Colour of the leading dot - same as the brand knot. Default `working`. */
  state?: HeaderStatusState;
  /** Something waits for the operator: amber border, tint and bold count. */
  attention?: boolean;
  /** Usage rings, separated by a hairline (`<UsageRing />` x1-2). */
  rings?: ReactNode;
  /** Update-available badge content (an icon); omit for no badge. */
  update?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** `.tc-stat` - the system status trigger. Pass a full `aria-label` (it is the only text a screen reader gets). */
export function HeaderStatus({
  count,
  state = "working",
  attention = false,
  rings,
  update,
  ref,
  ...rest
}: HeaderStatusProps) {
  return (
    <button
      className={cn(
        "inline-flex h-[30px] cursor-pointer items-center gap-[7px] rounded-lg border py-0 pr-[7px] pl-2.5 font-sans text-[12px] whitespace-nowrap text-ink-2",
        "transition-colors motion-reduce:transition-none",
        attention
          ? "border-accent/45 bg-accent-soft"
          : "border-line hover:border-line-2 hover:bg-panel-2",
        focusRing,
      )}
      data-attention={attention || undefined}
      data-testid={HeaderChromeTestId.Status}
      ref={ref}
      type="button"
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn("size-[7px] shrink-0 rounded-full", dotClass[state])}
        data-testid={HeaderChromeTestId.StatusDot}
      />
      <span
        className={cn(
          "font-mono text-[11.5px]",
          attention ? "font-semibold text-accent-fg" : "text-ink",
        )}
        data-testid={HeaderChromeTestId.StatusCount}
      >
        {count}
      </span>
      {rings && (
        <span
          className="inline-flex gap-[3px] border-l border-line pl-[7px]"
          data-testid={HeaderChromeTestId.StatusRings}
        >
          {rings}
        </span>
      )}
      {update && (
        <span
          className="inline-grid size-5 place-items-center rounded-md bg-state-think/15 text-state-think"
          data-testid={HeaderChromeTestId.StatusUpdate}
        >
          {update}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mode group
// ---------------------------------------------------------------------------

export interface HeaderModeGroupProps {
  /** Accessible name of the group (e.g. "Operating mode"). */
  ariaLabel: string;
  /** One or more `HeaderModeButton`s. */
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** `.tc-mode` - a segmented 30px group of mode buttons. */
export function HeaderModeGroup({ ariaLabel, children, ref }: HeaderModeGroupProps) {
  return (
    <div
      aria-label={ariaLabel}
      className="inline-flex h-[30px] items-stretch rounded-lg border border-line-2"
      data-testid={HeaderChromeTestId.ModeGroup}
      ref={ref}
      role="group"
    >
      {children}
    </div>
  );
}

export interface HeaderModeButtonProps extends ButtonProps {
  /** Leading glyph (ignored when `live`). */
  icon?: IconName;
  /** Replace the icon with the pulsing amber dot (Autopilot on). */
  live?: boolean;
  /** Visible label; omit for icon-only (then pass `aria-label`). */
  label?: string;
  /** Extra leading content before the icon (e.g. an engine tile). */
  leading?: ReactNode;
  /** Trailing content (e.g. a small chevron). */
  trailing?: ReactNode;
  /** Pressed state. */
  pressed?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function HeaderModeButton({
  icon,
  live = false,
  label,
  leading,
  trailing,
  pressed,
  ref,
  ...rest
}: HeaderModeButtonProps) {
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 px-[9px] font-sans text-[12px] font-medium whitespace-nowrap text-ink-2",
        "transition-colors hover:bg-panel-2 hover:text-ink motion-reduce:transition-none",
        "rounded-none first:rounded-l-[7px] last:rounded-r-[7px]",
        "border-l border-line-2 first:border-l-0",
        focusRing,
      )}
      data-testid={HeaderChromeTestId.ModeButton}
      ref={ref}
      type="button"
      {...rest}
    >
      {leading}
      {live ? (
        <span
          aria-hidden="true"
          className="zb-header-pulse size-[7px] shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-brand)_25%,transparent)]"
          data-testid={HeaderChromeTestId.ModeLiveDot}
        />
      ) : (
        icon && <Icon name={icon} size="sm" />
      )}
      {label}
      {trailing}
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

// ---------------------------------------------------------------------------
// Usage ring
// ---------------------------------------------------------------------------

export interface UsageRingProps {
  /** Used share, 0-100. */
  value: number;
  /** Accessible name; when set the ring is an `img`, otherwise decorative. */
  label?: string;
  /** The ring turns amber from this value up. Default 80. */
  hotAt?: number;
}

const RING_R = 6;
const RING_C = 2 * Math.PI * RING_R;

/** 16px usage arc (stroke 2.2, round caps) - ink-2, amber from `hotAt`. */
export function UsageRing({ value, label, hotAt = 80 }: UsageRingProps) {
  const pct = Math.max(0, Math.min(100, value));
  const hot = pct >= hotAt;
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className="block"
      data-hot={hot || undefined}
      data-testid={HeaderChromeTestId.UsageRing}
      height={16}
      role={label ? "img" : undefined}
      viewBox="0 0 16 16"
      width={16}
    >
      <circle className="stroke-line-2" cx={8} cy={8} fill="none" r={RING_R} strokeWidth={2.2} />
      <circle
        className={hot ? "stroke-accent" : "stroke-ink-2"}
        cx={8}
        cy={8}
        fill="none"
        r={RING_R}
        strokeDasharray={`${(RING_C * pct) / 100} ${RING_C}`}
        strokeLinecap="round"
        strokeWidth={2.2}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}
