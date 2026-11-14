import type { HTMLAttributes, Ref } from "react";
import type { StateTone } from "../../stateTone";
import { cn } from "../../utils/cn";
import { Icon, type IconName } from "../Icon/Icon";

export enum StateGlyphTestId {
  Root = "state-glyph-root",
}

/** A state colour, or `neutral` for a glyph that names a kind, not a state (tracker, source). */
export type StateGlyphTone = StateTone | "neutral";

/** Glyph colour + a 10 % tint of it as the fill (amber: `accent-fg` text on the amber fill token). */
const TONE: Record<StateGlyphTone, string> = {
  working: "text-state-work bg-[color-mix(in_srgb,var(--color-state-work)_10%,transparent)]",
  thinking: "text-state-think bg-[color-mix(in_srgb,var(--color-state-think)_10%,transparent)]",
  blocked: "text-accent-fg bg-accent-dim",
  error: "text-state-err bg-[color-mix(in_srgb,var(--color-state-err)_11%,transparent)]",
  done: "text-state-done bg-[color-mix(in_srgb,var(--color-state-done)_10%,transparent)]",
  idle: "text-ink-3 bg-[color-mix(in_srgb,var(--color-ink)_4.5%,transparent)]",
  neutral: "text-ink-2 bg-[color-mix(in_srgb,var(--color-ink)_6%,transparent)]",
};

export interface StateGlyphProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  "className" | "children"
> {
  tone: StateGlyphTone;
  icon: IconName;
  /** What the glyph means — its accessible name and hover tooltip. */
  label: string;
  /** Spin the glyph (a check in progress); off under `prefers-reduced-motion`. */
  spin?: boolean;
  ref?: Ref<HTMLSpanElement>;
}

/**
 * The 20px rounded state square a row leads with (spec: "CI čtverec", tracker glyph): a small
 * state-coloured icon on a tint of the same colour. State lives here, never in a row stripe.
 */
export function StateGlyph({ tone, icon, label, spin = false, ref, ...props }: StateGlyphProps) {
  return (
    <span
      aria-label={label}
      className={cn("mt-px grid size-5 flex-none place-items-center rounded-[6px]", TONE[tone])}
      data-testid={StateGlyphTestId.Root}
      ref={ref}
      role="img"
      title={label}
      {...props}
    >
      <span
        className={cn(
          "flex",
          spin && "animate-[zt-spin_1.4s_linear_infinite] motion-reduce:animate-none",
        )}
      >
        <Icon name={icon} size="xs" stroke="medium" />
      </span>
    </span>
  );
}
