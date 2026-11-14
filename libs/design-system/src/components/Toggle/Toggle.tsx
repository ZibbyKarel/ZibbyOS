import type { Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum ToggleTestId {
  Root = "switch-root",
  Thumb = "switch-thumb",
}

export type ToggleSize = "sm" | "md";

/** Track dimensions per size, sealed to a small scale. */
const track: Record<ToggleSize, string> = {
  sm: "h-[20px] w-[36px] p-[2px]",
  md: "h-[26px] w-[46px] p-[3px]",
};

const thumb: Record<ToggleSize, string> = {
  sm: "size-[14px]",
  md: "size-[18px]",
};

export interface ToggleProps {
  /** Controlled on/off state. */
  checked: boolean;
  /** Fired with the next state when the user toggles. */
  onChange: (next: boolean) => void;
  /** Accessible name — required since the control has no visible text. */
  label: string;
  size?: ToggleSize;
  disabled?: boolean;
  /** Control id — set by `Field`/`ToggleField` to wire a visible `<label htmlFor>`. */
  id?: string;
  /** Id of a describing message — set by `Field`/`ToggleField`. */
  "aria-describedby"?: string;
  /** Invalid flag — set by `Field`/`ToggleField`. */
  "aria-invalid"?: boolean;
  /** Overrides the default root test id (e.g. `ToggleField` re-labels it). */
  "data-testid"?: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A HUD on/off toggle. Renders a `role="switch"` button with a sliding thumb;
 * accent-lit when on, muted when off. Controlled only — the consumer owns state.
 */
export function Toggle({
  checked,
  onChange,
  label,
  size = "md",
  disabled = false,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  "data-testid": testId = ToggleTestId.Root,
  ref,
}: ToggleProps) {
  return (
    <button
      aria-checked={checked}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border transition-colors duration-150 motion-reduce:transition-none",
        focusRing,
        track[size],
        checked ? "justify-end border-ink bg-ink" : "justify-start border-line-2 bg-panel",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
      data-testid={testId}
      disabled={disabled}
      id={id}
      onClick={() => onChange(!checked)}
      ref={ref}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "rounded-full transition-all duration-150 motion-reduce:transition-none",
          thumb[size],
          checked ? "bg-on-ink" : "bg-ink-3",
        )}
        data-testid={ToggleTestId.Thumb}
      />
    </button>
  );
}
