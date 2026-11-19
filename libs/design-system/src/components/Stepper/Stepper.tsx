import type { Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum StepperTestId {
  Root = "stepper-root",
  Decrease = "stepper-decrease",
  Value = "stepper-value",
  Increase = "stepper-increase",
}

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name of the whole group (e.g. "Max retries"). */
  "aria-label": string;
  decreaseLabel?: string;
  increaseLabel?: string;
  disabled?: boolean;
  ref?: Ref<HTMLDivElement>;
}

const cell = cn(
  "grid size-7 place-items-center bg-transparent font-mono text-[13px] leading-none text-ink-2",
  "hover:bg-panel-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40",
  focusRing,
);

/**
 * An inline `− value +` number stepper — the compact sibling of `NumberField` for a
 * small bounded integer (max retries, attempt counts) inside a popover or inspector row.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  "aria-label": ariaLabel,
  decreaseLabel = "Decrease",
  increaseLabel = "Increase",
  disabled = false,
  ref,
}: StepperProps) {
  return (
    <div
      aria-label={ariaLabel}
      className="inline-flex items-center overflow-hidden rounded-[8px] border border-line-2"
      data-testid={StepperTestId.Root}
      ref={ref}
      role="group"
    >
      <button
        aria-label={decreaseLabel}
        className={cell}
        data-testid={StepperTestId.Decrease}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        type="button"
      >
        −
      </button>
      <output
        aria-live="polite"
        className="min-w-8 border-x border-line text-center font-mono text-[12px] font-semibold text-ink"
        data-testid={StepperTestId.Value}
      >
        {value}
      </output>
      <button
        aria-label={increaseLabel}
        className={cell}
        data-testid={StepperTestId.Increase}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        type="button"
      >
        +
      </button>
    </div>
  );
}
