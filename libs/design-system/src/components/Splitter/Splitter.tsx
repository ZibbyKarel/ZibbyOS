"use client";

import { type KeyboardEvent, type PointerEvent, type Ref, useRef, useState } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum SplitterTestId {
  Root = "splitter-root",
  Grip = "splitter-grip",
}

export interface SplitterProps {
  /** Current size, in px, of the pane this handle resizes. */
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** Accessible name of the separator (what it resizes). */
  label: string;
  /** Which side the resized pane sits on: `start` = left of the handle, `end` = right. */
  pane?: "start" | "end";
  /** Keyboard step in px (Shift = x4). */
  step?: number;
  ref?: Ref<HTMLDivElement>;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Vertical drag handle between two panes. It is controlled and parent-agnostic: it reports
 * the new pane size (px) while dragging or on ArrowLeft/ArrowRight/Home/End, the parent
 * applies it. Exposed as an ARIA `separator` (focusable, with value now/min/max).
 */
export function Splitter({
  value,
  min,
  max,
  onChange,
  label,
  pane = "start",
  step = 16,
  ref,
}: SplitterProps) {
  const drag = useRef<{ x: number; start: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dir = pane === "start" ? 1 : -1;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, start: value };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onChange(clamp(drag.current.start + (e.clientX - drag.current.x) * dir, min, max));
  };
  const end = () => {
    drag.current = null;
    setDragging(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const s = e.shiftKey ? step * 4 : step;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = value + s * dir;
    else if (e.key === "ArrowLeft") next = value - s * dir;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    if (next === null) return;
    e.preventDefault();
    onChange(clamp(next, min, max));
  };

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={Math.round(value)}
      className={cn(
        "group relative z-[4] grid w-[10px] flex-none cursor-col-resize touch-none place-items-center bg-background",
        "before:absolute before:top-0 before:bottom-0 before:left-[4.5px] before:w-px before:bg-line-2",
        focusRing,
      )}
      data-testid={SplitterTestId.Root}
      onKeyDown={onKeyDown}
      onLostPointerCapture={end}
      onPointerCancel={end}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      ref={ref}
      role="separator"
      tabIndex={0}
    >
      <span
        className={cn(
          "relative h-[30px] w-1 rounded bg-line-2 transition-colors group-hover:bg-ink-3 group-focus-visible:bg-ink-3",
          dragging && "bg-ink-3",
        )}
        data-testid={SplitterTestId.Grip}
      />
    </div>
  );
}
