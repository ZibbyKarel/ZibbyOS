import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum ZibbySectionTestId {
  Root = "zibby-section-root",
  OrbButton = "zibby-section-orb-button",
  OrbSlot = "zibby-section-orb-slot",
  StatusButton = "zibby-section-status-button",
}

/** Whether Zibby runs: `run` violet, `auto` amber (full Automat), `paused` muted. */
export type ZibbyStatus = "run" | "auto" | "paused";

const sectionTone: Record<ZibbyStatus, string> = {
  paused: "border-line-2 bg-ink/[0.04] text-ink-3",
  auto: "border-accent/55 bg-accent/[0.14] text-accent-fg",
  run: "border-state-work/55 bg-state-work/[0.12] text-state-work",
};

export interface ZibbySectionProps {
  status: ZibbyStatus;
  /** Accessible name of the group, e.g. "Zibby". */
  ariaLabel: string;
  /** A `ZibbySectionOrbButton` and the status button (optionally wrapped in a popover anchor). */
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The header's Zibby section: a 32px pill split into the orb button and the status button, tinted
 * by the status (violet running / amber full Automat / muted paused). The two buttons inherit its colour.
 */
export function ZibbySection({ status, ariaLabel, children, ref }: ZibbySectionProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-8 items-stretch rounded-full border transition-colors motion-reduce:transition-none [&>span]:flex",
        sectionTone[status],
      )}
      data-status={status}
      data-testid={ZibbySectionTestId.Root}
      ref={ref}
      role="group"
    >
      {children}
    </div>
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "type">;

export interface ZibbySectionOrbButtonProps extends ButtonProps {
  /** The orb (pass `<ZibbyOrb size={20} />`). */
  orb: ReactNode;
  /** Visible label; omit when compact. */
  children?: ReactNode;
  /** Accessible name (required: it carries the shortcut). */
  "aria-label": string;
  ref?: Ref<HTMLButtonElement>;
}

export function ZibbySectionOrbButton({ orb, children, ref, ...rest }: ZibbySectionOrbButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center gap-[7px] rounded-l-full pr-2.5 pl-1.5 font-sans text-[12.5px] font-medium whitespace-nowrap text-inherit",
        "transition-colors hover:bg-current/10 motion-reduce:transition-none",
        !children && "pr-1",
        focusRing,
      )}
      data-testid={ZibbySectionTestId.OrbButton}
      ref={ref}
      type="button"
      {...rest}
    >
      <span className="grid size-5 place-items-center" data-testid={ZibbySectionTestId.OrbSlot}>
        {orb}
      </span>
      {children}
    </button>
  );
}

export interface ZibbySectionStatusButtonProps extends ButtonProps {
  /** The status text, e.g. "Běží" (the status never relies on colour alone). */
  label: string;
  /** Accessible name (required). */
  "aria-label": string;
  ref?: Ref<HTMLButtonElement>;
}

export function ZibbySectionStatusButton({ label, ref, ...rest }: ZibbySectionStatusButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-r-full border-l pr-2 pl-2.5 font-sans text-[12.5px] font-medium whitespace-nowrap text-inherit",
        "border-[color-mix(in_srgb,currentColor_30%,transparent)]",
        "transition-colors hover:bg-current/10 aria-expanded:bg-current/10 motion-reduce:transition-none",
        focusRing,
      )}
      data-testid={ZibbySectionTestId.StatusButton}
      ref={ref}
      type="button"
      {...rest}
    >
      {label}
      <Icon name="chevron" size="xs" stroke="medium" />
    </button>
  );
}
