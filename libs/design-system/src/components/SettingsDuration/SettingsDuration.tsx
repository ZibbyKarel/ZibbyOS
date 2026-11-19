"use client";
import type { Ref } from "react";
import { cn } from "../../utils/cn";

export enum SettingsDurationTestId {
  Root = "settings-duration-root",
  Hours = "settings-duration-hours",
  Minutes = "settings-duration-minutes",
}

export interface SettingsDurationProps {
  label: string;
  /** Total minutes. */
  value: number;
  onChange: (minutes: number) => void;
  hoursLabel: string;
  minutesLabel: string;
  changed?: boolean;
  disabled?: boolean;
  /** Upper bound in hours (default 168). */
  maxHours?: number;
  ref?: Ref<HTMLSpanElement>;
}

const input = (changed: boolean) =>
  cn(
    "h-8 w-[52px] rounded-[8px] border bg-bg text-center font-mono text-[13px] text-ink outline-none focus:border-ink-2",
    changed ? "border-ink" : "border-line-2",
  );

/** `[h] h [m] min` duration pair (Bridge `.st-hm`); a minute overflow carries into the hours. */
export function SettingsDuration({
  label,
  value,
  onChange,
  hoursLabel,
  minutesLabel,
  changed = false,
  disabled = false,
  maxHours = 168,
  ref,
}: SettingsDurationProps) {
  const hh = Math.floor(value / 60);
  const mm = value % 60;
  const set = (h: number, m: number) =>
    onChange(Math.max(0, Math.min(maxHours, h)) * 60 + Math.max(0, m));
  const num = (raw: string) => parseInt(raw || "0", 10) || 0;
  return (
    <span
      aria-label={label}
      className="inline-flex items-center gap-2 text-[12px] text-ink-3"
      data-testid={SettingsDurationTestId.Root}
      ref={ref}
      role="group"
    >
      <input
        aria-label={`${label}, ${hoursLabel}`}
        className={input(changed)}
        data-testid={SettingsDurationTestId.Hours}
        disabled={disabled}
        max={maxHours}
        min={0}
        onChange={(e) => set(num(e.target.value), mm)}
        type="number"
        value={hh}
      />
      <span aria-hidden="true">h</span>
      <input
        aria-label={`${label}, ${minutesLabel}`}
        className={input(changed)}
        data-testid={SettingsDurationTestId.Minutes}
        disabled={disabled}
        max={59}
        min={0}
        onChange={(e) => {
          const n = num(e.target.value);
          set(hh + Math.floor(n / 60), n % 60);
        }}
        type="number"
        value={mm}
      />
      <span aria-hidden="true">min</span>
    </span>
  );
}
