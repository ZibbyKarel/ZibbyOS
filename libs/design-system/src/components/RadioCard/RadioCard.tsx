"use client";

import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum RadioCardGroupTestId {
  Root = "radio-card-group-root",
}

export enum RadioCardTestId {
  Root = "radio-card-root",
  Media = "radio-card-media",
  Label = "radio-card-label",
  Hint = "radio-card-hint",
}

/** Tint of the checked card: `neutral` ink, `violet` (work/think), `amber` (the autopilot colour). */
export type RadioCardTone = "neutral" | "violet" | "amber";

export interface RadioCardGroupProps {
  /** Accessible name of the radiogroup. */
  ariaLabel: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A row of {@link RadioCard}s (`role="radiogroup"`). Arrow keys move focus between the enabled
 * cards without selecting (selecting may open a confirm dialog); Enter / Space selects.
 */
export function RadioCardGroup({ ariaLabel, children, ref }: RadioCardGroupProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    const radios = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'),
    );
    const at = radios.indexOf(document.activeElement as HTMLElement);
    const next = radios[at + step];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };
  return (
    <div
      aria-label={ariaLabel}
      className="grid grid-cols-3 gap-1.5"
      data-testid={RadioCardGroupTestId.Root}
      onKeyDown={onKeyDown}
      ref={ref}
      role="radiogroup"
    >
      {children}
    </div>
  );
}

const checkedClass: Record<RadioCardTone, string> = {
  neutral: "border-ink-3 bg-ink/[0.06]",
  violet:
    "border-state-work/70 bg-state-work/[0.11] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-state-work)_40%,transparent)]",
  amber:
    "border-accent/75 bg-accent/[0.12] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_40%,transparent)]",
};

const checkedLabel: Record<RadioCardTone, string> = {
  neutral: "text-ink",
  violet: "text-state-work",
  amber: "text-accent-fg",
};

export interface RadioCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children" | "type" | "role" | "onSelect"
> {
  /** Visual above the label, e.g. a `ZibbyOrb`. */
  media?: ReactNode;
  label: string;
  /** Small second line under the label. */
  hint?: string;
  checked: boolean;
  tone?: RadioCardTone;
  /** Not selectable but still focusable, so its `title` can explain why (`aria-disabled`). */
  disabled?: boolean;
  onSelect?: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/** One option of a {@link RadioCardGroup}: a big card with a media slot, label and hint. */
export function RadioCard({
  media,
  label,
  hint,
  checked,
  tone = "neutral",
  disabled = false,
  onSelect,
  onClick,
  ref,
  ...rest
}: RadioCardProps) {
  return (
    <button
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2.5 rounded-[10px] border px-1.5 pt-4 pb-3 text-center text-ink",
        "transition-colors motion-reduce:transition-none",
        checked ? checkedClass[tone] : "border-line-2 hover:bg-panel-2",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
        focusRing,
      )}
      data-testid={RadioCardTestId.Root}
      onClick={(e) => {
        onClick?.(e);
        if (!disabled) onSelect?.();
      }}
      ref={ref}
      role="radio"
      type="button"
      {...rest}
    >
      {media && <span data-testid={RadioCardTestId.Media}>{media}</span>}
      <span className="block">
        <b
          className={cn(
            "block text-[12.5px] font-semibold",
            checked ? checkedLabel[tone] : "text-ink",
          )}
          data-testid={RadioCardTestId.Label}
        >
          {label}
        </b>
        {hint && (
          <small className="mt-px block text-[11px] text-ink-3" data-testid={RadioCardTestId.Hint}>
            {hint}
          </small>
        )}
      </span>
    </button>
  );
}
