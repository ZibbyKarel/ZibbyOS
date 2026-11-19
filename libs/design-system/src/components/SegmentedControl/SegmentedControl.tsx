"use client";

import type { KeyboardEvent, ReactNode, Ref } from "react";
import type { StateTone } from "../../stateTone";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { StateDot } from "../StatePill/StatePill";

export type SegmentedControlSize = "sm" | "md";

export interface SegmentedControlItem {
  value: string;
  label: string;
  /** Leading status dot, tinted by the canonical state vocabulary. */
  dot?: StateTone;
  /** Leading glyph (e.g. an orb) shown before the label. */
  leading?: ReactNode;
  /** Tints the selected item instead of the neutral fill: violet (work) or amber (autopilot). */
  tone?: "violet" | "amber";
  disabled?: boolean;
}

export enum SegmentedControlTestId {
  Root = "segmented-control-root",
  /** Each item button is suffixed with its `value`, e.g. `segmented-control-item-auto`. */
  Item = "segmented-control-item",
  Dot = "segmented-control-dot",
}

export interface SegmentedControlProps {
  items: SegmentedControlItem[];
  value: string;
  onChange: (value: string) => void;
  size?: SegmentedControlSize;
  /** Regular weight at the surrounding letter-spacing (inside a mono bar) instead of the semibold default. */
  plain?: boolean;
  /** Stretch to the container width with equal-width items (inspector fields). */
  fill?: boolean;
  /** Accessible label for the radiogroup. */
  ariaLabel?: string;
  /** Id of an external label element — wins over `ariaLabel`. */
  ariaLabelledby?: string;
  ref?: Ref<HTMLDivElement>;
}

const sizeClass: Record<SegmentedControlSize, string> = {
  sm: "px-[8px] py-[3px] text-[12px]",
  md: "px-[10px] py-[4px] text-[12px]",
};

/** Every enabled item button inside the closest `role="radiogroup"` ancestor, in DOM order. */
function queryItems(current: HTMLElement): HTMLButtonElement[] {
  const group = current.closest('[role="radiogroup"]');
  return group
    ? Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'))
    : [];
}

/**
 * DS.md §8 segmented control — a hairline-bounded row of mutually exclusive
 * options, the selected one filled `--ink`. WAI-ARIA APG "Radio Group": arrow
 * keys move focus *and* selection together (unlike a tablist, where Enter/Space
 * is a separate activation step); `Home`/`End` jump to the first/last item.
 */
export function SegmentedControl({
  items,
  value,
  onChange,
  size = "md",
  plain = false,
  fill = false,
  ariaLabel,
  ariaLabelledby,
  ref,
}: SegmentedControlProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const all = queryItems(e.currentTarget);
    if (all.length === 0) return;
    // Disabled items are skipped: `all` and `enabled` line up index for index.
    const enabled = items.filter((i) => !i.disabled);
    const at = enabled.indexOf(items[index] as SegmentedControlItem);
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIndex = (at + 1) % enabled.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nextIndex = (at - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = enabled.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const target = all[nextIndex];
    const nextItem = enabled[nextIndex];
    if (!target || !nextItem) return;
    target.focus();
    onChange(nextItem.value);
  };

  return (
    <div
      aria-label={ariaLabelledby ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledby}
      className={cn(
        "max-w-full gap-0.5 overflow-x-auto rounded-[9px] border border-line bg-panel p-[3px]",
        fill ? "flex w-full" : "inline-flex",
      )}
      data-testid={SegmentedControlTestId.Root}
      ref={ref}
      role="radiogroup"
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            aria-checked={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm border-none font-sans transition-colors motion-reduce:transition-none",
              fill && "flex-1 justify-center whitespace-nowrap",
              plain ? "font-normal" : "font-medium",
              focusRingInset,
              sizeClass[size],
              active
                ? item.tone === "violet"
                  ? "bg-state-work/[0.16] text-state-work"
                  : item.tone === "amber"
                    ? "bg-accent/[0.18] text-accent-fg"
                    : "bg-raised text-ink"
                : "bg-transparent text-ink-3 hover:text-ink",
              item.disabled && "cursor-not-allowed opacity-50",
            )}
            data-testid={`${SegmentedControlTestId.Item}-${item.value}`}
            disabled={item.disabled}
            key={item.value}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            role="radio"
            tabIndex={active ? 0 : -1}
            type="button"
          >
            {item.leading}
            {item.dot && (
              <StateDot data-testid={SegmentedControlTestId.Dot} px={6} state={item.dot} />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
