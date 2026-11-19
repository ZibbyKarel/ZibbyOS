import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum ZibbySectionTestId {
  Root = "zibby-section-root",
  OrbButton = "zibby-section-orb-button",
  OrbSlot = "zibby-section-orb-slot",
  ModeButton = "zibby-section-mode-button",
  Glyph = "zibby-section-glyph",
}

/** Zibby's operating mode: `manual` muted, `semi` violet, `auto` amber. */
export type ZibbyMode = "manual" | "semi" | "auto";

const sectionTone: Record<ZibbyMode, string> = {
  manual: "border-line-2 bg-ink/[0.04] text-ink-3",
  semi: "border-state-work/55 bg-state-work/[0.12] text-state-work",
  auto: "border-accent/70 bg-accent/15 text-accent-fg",
};

export interface ZibbySectionProps {
  mode: ZibbyMode;
  /** Accessible name of the group, e.g. "Zibby". */
  ariaLabel: string;
  /** A `ZibbySectionOrbButton` and the mode button (optionally wrapped in a popover anchor). */
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The header's Zibby section: a 32px pill split into the orb button and the mode button, tinted
 * by the mode (muted / violet / amber). The two buttons inherit its colour.
 */
export function ZibbySection({ mode, ariaLabel, children, ref }: ZibbySectionProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-8 items-stretch rounded-full border transition-colors motion-reduce:transition-none [&>span]:flex",
        sectionTone[mode],
      )}
      data-mode={mode}
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

export interface ZibbySectionModeButtonProps extends ButtonProps {
  mode: ZibbyMode;
  /** The mode's name, e.g. "Poloautomat". */
  label: string;
  /** Accessible name (required). */
  "aria-label": string;
  ref?: Ref<HTMLButtonElement>;
}

/** Mode glyph: hollow ring (manual), half-filled (semi), solid and pulsing (auto). */
function Glyph({ mode }: { mode: ZibbyMode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2 shrink-0 rounded-full",
        mode === "manual" && "border-[1.5px] border-current",
        mode === "semi" &&
          "border-[1.5px] border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]",
        mode === "auto" && "zb-header-pulse bg-current",
      )}
      data-testid={ZibbySectionTestId.Glyph}
    />
  );
}

export function ZibbySectionModeButton({ mode, label, ref, ...rest }: ZibbySectionModeButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-r-full border-l pr-2 pl-2.5 font-sans text-[12.5px] font-medium whitespace-nowrap text-inherit",
        "border-[color-mix(in_srgb,currentColor_30%,transparent)]",
        "transition-colors hover:bg-current/10 aria-expanded:bg-current/10 motion-reduce:transition-none",
        focusRing,
      )}
      data-testid={ZibbySectionTestId.ModeButton}
      ref={ref}
      type="button"
      {...rest}
    >
      <Glyph mode={mode} />
      {label}
      <Icon name="chevron" size="xs" stroke="medium" />
    </button>
  );
}
