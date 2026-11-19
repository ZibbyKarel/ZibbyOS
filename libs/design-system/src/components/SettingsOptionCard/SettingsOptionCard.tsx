"use client";
import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum SettingsOptionCardTestId {
  Group = "settings-option-group",
  Root = "settings-option-card",
  Media = "settings-option-media",
  Radio = "settings-option-radio",
  Meta = "settings-option-meta",
}

export interface SettingsOptionGroupProps {
  ariaLabel: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Two-up grid (one column on phones) of {@link SettingsOptionCard}s — `role="radiogroup"`. */
export function SettingsOptionGroup({ ariaLabel, children, ref }: SettingsOptionGroupProps) {
  return (
    <div
      aria-label={ariaLabel}
      className="grid grid-cols-1 gap-3 px-4 pb-4 min-[700px]:grid-cols-2"
      data-testid={SettingsOptionCardTestId.Group}
      ref={ref}
      role="radiogroup"
    >
      {children}
    </div>
  );
}

export interface SettingsOptionCardProps {
  label: string;
  hint?: ReactNode;
  /** Short mono glyph in the left tile ("Cl", "oc"). */
  media?: string;
  /** Status badge at the right edge (used when `radio` is off). */
  badge?: ReactNode;
  /** Extra lines under the text: installed badge + version, a path. */
  meta?: ReactNode;
  checked: boolean;
  /** Show the radio dot at the right edge. */
  radio?: boolean;
  /** Focusable but not selectable (`aria-disabled`). */
  disabled?: boolean;
  onSelect?: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/** One option of a {@link SettingsOptionGroup}: tile, name, hint, optional badge / radio dot / meta (Bridge `.st-eng`). */
export function SettingsOptionCard({
  label,
  hint,
  media,
  badge,
  meta,
  checked,
  radio = true,
  disabled = false,
  onSelect,
  ref,
}: SettingsOptionCardProps) {
  return (
    <button
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[10px] border bg-bg px-3 py-[11px] text-left",
        "transition-colors motion-reduce:transition-none",
        checked ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line hover:bg-panel-2",
        disabled ? "cursor-default" : "cursor-pointer",
        focusRing,
      )}
      data-testid={SettingsOptionCardTestId.Root}
      onClick={() => {
        if (!disabled) onSelect?.();
      }}
      ref={ref}
      role="radio"
      type="button"
    >
      <span className="flex items-center gap-3">
        {media && (
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-line-2 bg-panel-2 font-mono text-[11px] font-semibold text-ink-2"
            data-testid={SettingsOptionCardTestId.Media}
          >
            {media}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <b className="block text-[13.5px] font-semibold text-ink">{label}</b>
          {hint && <small className="block text-[12px] text-ink-3">{hint}</small>}
        </span>
        {badge}
        {radio && (
          <span
            aria-hidden="true"
            className={cn(
              "grid size-[18px] shrink-0 place-items-center rounded-full border",
              checked ? "border-ink bg-ink" : "border-line-2",
            )}
            data-testid={SettingsOptionCardTestId.Radio}
          >
            {checked && <span className="size-[6px] rounded-full bg-bg" />}
          </span>
        )}
      </span>
      {meta && (
        <span
          className="flex min-w-0 flex-col gap-[6px]"
          data-testid={SettingsOptionCardTestId.Meta}
        >
          {meta}
        </span>
      )}
    </button>
  );
}
