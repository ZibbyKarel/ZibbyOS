"use client";

import type { KeyboardEvent, PointerEvent, ReactNode, Ref } from "react";
import { useRef, useState } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Typography } from "../Typography/Typography";

export enum StepSliderTestId {
  Root = "step-slider-root",
  Track = "step-slider-track",
  Thumb = "step-slider-thumb",
  /** Each step button is suffixed with its `value`, e.g. `step-slider-step-auto`. */
  Step = "step-slider-step",
  Mixed = "step-slider-mixed",
}

export interface StepSliderStep {
  value: string;
  label: string;
  /** Shown above the label (e.g. a `ZibbyOrb`). */
  icon?: ReactNode;
}

export interface StepSliderProps {
  steps: StepSliderStep[];
  /** The selected step's value; `null` = none exact (thumb hidden, `mixedLabel` shown). */
  value: string | null;
  onChange: (value: string) => void;
  /** Accessible name of the slider. */
  ariaLabel: string;
  /** Hint shown (and read out) while `value` is `null`. */
  mixedLabel?: string;
  disabled?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A slider with a few fixed steps: a grey → violet → amber track, a clickable icon + label per step
 * and a thumb that can be dragged (snaps to the nearest step on release) or moved with the arrow
 * keys. The thumb is the `role="slider"`; the step buttons are a pointer shortcut only.
 */
export function StepSlider({
  steps,
  value,
  onChange,
  ariaLabel,
  mixedLabel,
  disabled,
  ref,
}: StepSliderProps) {
  const n = steps.length;
  const index = steps.findIndex((s) => s.value === value);
  const trackRef = useRef<HTMLDivElement>(null);
  /** Thumb centre while dragging, 0..1 across the track; `null` when not dragging. */
  const [drag, setDrag] = useState<number | null>(null);
  const center = (i: number) => (i + 0.5) / n;
  const snap = (frac: number) => Math.min(n - 1, Math.max(0, Math.floor(frac * n)));
  const fracOf = (e: PointerEvent) => {
    const r = trackRef.current?.getBoundingClientRect();
    return r && r.width > 0 ? (e.clientX - r.left) / r.width : 0;
  };
  const select = (i: number) => {
    const step = steps[i];
    if (step && i !== index) onChange(step.value);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(fracOf(e));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (drag !== null) setDrag(fracOf(e));
  };
  const onPointerUp = (e: PointerEvent) => {
    if (drag === null) return;
    select(snap(fracOf(e)));
    setDrag(null);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const to: Record<string, number> = {
      ArrowRight: index < 0 ? 0 : index + 1,
      ArrowUp: index < 0 ? 0 : index + 1,
      ArrowLeft: index < 0 ? n - 1 : index - 1,
      ArrowDown: index < 0 ? n - 1 : index - 1,
      Home: 0,
      End: n - 1,
    };
    const next = to[e.key];
    if (next === undefined || disabled) return;
    e.preventDefault();
    select(Math.min(n - 1, Math.max(0, next)));
  };

  const pos =
    drag !== null ? Math.min(center(n - 1), Math.max(center(0), drag)) : center(Math.max(index, 0));
  const hidden = index < 0 && drag === null;
  return (
    <div className="flex flex-col gap-[6px]" data-testid={StepSliderTestId.Root} ref={ref}>
      <div className="flex">
        {steps.map((s, i) => (
          <button
            aria-label={s.label}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-center gap-[2px] rounded-[8px] py-[4px] disabled:cursor-default",
              focusRing,
              i === index ? "opacity-100" : "opacity-60 hover:opacity-100",
            )}
            data-testid={`${StepSliderTestId.Step}-${s.value}`}
            disabled={disabled}
            key={s.value}
            onClick={() => select(i)}
            tabIndex={-1}
            type="button"
          >
            {s.icon}
            <Typography size="xs" type="note" weight={i === index ? "semibold" : undefined}>
              {s.label}
            </Typography>
          </button>
        ))}
      </div>
      <div
        className="relative h-[22px] touch-none select-none"
        data-testid={StepSliderTestId.Track}
        onPointerCancel={() => setDrag(null)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={trackRef}
      >
        <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-linear-to-r from-ink/25 via-state-work to-accent" />
        <div
          aria-disabled={disabled || undefined}
          aria-label={ariaLabel}
          aria-orientation="horizontal"
          aria-valuemax={n - 1}
          aria-valuemin={0}
          aria-valuenow={index >= 0 ? index : undefined}
          aria-valuetext={index >= 0 ? steps[index]?.label : mixedLabel}
          className={cn(
            "absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-ink shadow-md active:cursor-grabbing",
            focusRing,
            hidden && "opacity-0",
          )}
          data-testid={StepSliderTestId.Thumb}
          onKeyDown={onKeyDown}
          role="slider"
          // The thumb position is the one dynamic value; no DS prop carries it.
          style={{ left: `${pos * 100}%` }}
          tabIndex={disabled ? -1 : 0}
        />
      </div>
      {index < 0 && mixedLabel ? (
        <Typography
          align="center"
          data-testid={StepSliderTestId.Mixed}
          size="xs"
          type="note"
          variant="secondary"
        >
          {mixedLabel}
        </Typography>
      ) : null}
    </div>
  );
}
