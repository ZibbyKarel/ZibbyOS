"use client";
import type { Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum SettingsStepperTestId {
  Root = "settings-stepper-root",
  Dec = "settings-stepper-dec",
  Input = "settings-stepper-input",
  Inc = "settings-stepper-inc",
}

export interface SettingsStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Unsaved edit — ink border. */
  changed?: boolean;
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
  ref?: Ref<HTMLDivElement>;
}

const btn = cn(
  "grid size-8 place-items-center text-[15px] leading-none text-ink-2 hover:bg-panel-2 disabled:opacity-40",
  focusRing,
);

/** `− [n] +` number stepper (Bridge `.st-step`). Values clamp to `min..max`. */
export function SettingsStepper({
  label,
  value,
  min,
  max,
  onChange,
  changed = false,
  disabled = false,
  decreaseLabel = "Decrease",
  increaseLabel = "Increase",
  ref,
}: SettingsStepperProps) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));
  return (
    <div
      aria-label={label}
      className={cn(
        "inline-flex h-8 items-stretch overflow-hidden rounded-[8px] border bg-bg",
        changed ? "border-ink" : "border-line-2",
      )}
      data-testid={SettingsStepperTestId.Root}
      ref={ref}
      role="group"
    >
      <button
        aria-label={`${decreaseLabel} ${label}`}
        className={btn}
        data-testid={SettingsStepperTestId.Dec}
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
        type="button"
      >
        −
      </button>
      <input
        aria-label={label}
        className="w-11 border-x border-line bg-transparent text-center font-mono text-[13px] text-ink outline-none"
        data-testid={SettingsStepperTestId.Input}
        disabled={disabled}
        inputMode="numeric"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) set(n);
        }}
        value={value}
      />
      <button
        aria-label={`${increaseLabel} ${label}`}
        className={btn}
        data-testid={SettingsStepperTestId.Inc}
        disabled={disabled || value >= max}
        onClick={() => set(value + 1)}
        type="button"
      >
        +
      </button>
    </div>
  );
}
