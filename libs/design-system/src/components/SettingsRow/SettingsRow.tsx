import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum SettingsRowTestId {
  Root = "settings-row-root",
  Label = "settings-row-label",
  Changed = "settings-row-changed",
  Was = "settings-row-was",
  Control = "settings-row-control",
}

export interface SettingsRowProps {
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Extra chips after the label (a "this Mac" tag, a badge). */
  labelEnd?: ReactNode;
  /** Unsaved edit: ink dot before the label (+ `was` value). */
  changed?: boolean;
  /** The previous saved value, shown mono next to the dot while changed. */
  was?: ReactNode;
  /** Control under the label instead of at the right edge. */
  stack?: boolean;
  disabled?: boolean;
  /** The control(s); right-aligned. */
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * One setting inside a {@link SettingsPanel}: label + hint left, control right (Bridge
 * `.st-row`). The dirty grammar lives here: an ink dot and "was …" mark an unsaved edit.
 */
export function SettingsRow({
  id,
  label,
  hint,
  labelEnd,
  changed = false,
  was,
  stack = false,
  disabled = false,
  children,
  ref,
}: SettingsRowProps) {
  return (
    <div
      aria-disabled={disabled || undefined}
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-[10px] border-t border-line px-4 py-3",
        disabled && "opacity-50",
      )}
      data-testid={SettingsRowTestId.Root}
      id={id}
      ref={ref}
    >
      <div className="min-w-0 flex-[1_1_250px]">
        <div
          className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink"
          data-testid={SettingsRowTestId.Label}
        >
          {changed && (
            <span
              aria-hidden="true"
              className="size-[6px] shrink-0 rounded-full bg-ink"
              data-testid={SettingsRowTestId.Changed}
            />
          )}
          {label}
          {changed && was !== undefined && (
            <span
              className="font-mono text-[11.5px] font-normal text-ink-3"
              data-testid={SettingsRowTestId.Was}
            >
              was {was}
            </span>
          )}
          {labelEnd}
        </div>
        {hint && (
          <small className="mt-[2px] block max-w-[56ch] text-[12px] leading-[1.45] text-pretty text-ink-3">
            {hint}
          </small>
        )}
      </div>
      {children !== undefined && children !== null && (
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-2",
            stack ? "basis-full justify-start" : "ml-auto flex-[0_1_auto] justify-end",
          )}
          data-testid={SettingsRowTestId.Control}
        >
          {children}
        </div>
      )}
    </div>
  );
}
