"use client";
import type { KeyboardEvent, PointerEvent, ReactNode, Ref } from "react";
import { useRef, useState } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum ZibbyPttButtonTestId {
  Root = "zibby-ptt-button-root",
  Disc = "zibby-ptt-button-disc",
  Wave = "zibby-ptt-button-wave",
  WaveBar = "zibby-ptt-button-wave-bar",
  Label = "zibby-ptt-button-label",
}

export interface ZibbyPttButtonProps {
  /** `hold`: press = start, release/leave/cancel = end (Enter/Space too). `tap`: click toggles. Default `hold`. */
  mode?: "hold" | "tap";
  /** `md` = 48 px pill with label, `lg` = 76 px round phone button (label content is not shown). Default `md`. */
  size?: "md" | "lg";
  /** Controlled talking state. Omitted → the button tracks it itself. */
  active?: boolean;
  /** Live mic level 0–1; drives the waveform bars instead of the looping animation. */
  level?: number;
  /** Fired when talking starts. */
  onTalkStart?: () => void;
  /** Fired when talking ends. */
  onTalkEnd?: () => void;
  /** Accessible name (`aria-label`). Required. */
  label: string;
  /** Visible label content of the `md` pill (text, `Kbd` …). */
  children?: ReactNode;
  disabled?: boolean;
  "data-testid"?: string;
  ref?: Ref<HTMLButtonElement>;
}

const BAR_PROFILE = [0.6, 0.9, 1, 0.8, 0.55] as const;

/** Push-to-talk button (`.ptt` / phone `.pttbig`). */
export function ZibbyPttButton({
  mode = "hold",
  size = "md",
  active,
  level,
  onTalkStart,
  onTalkEnd,
  label,
  children,
  disabled = false,
  "data-testid": testId = ZibbyPttButtonTestId.Root,
  ref,
}: ZibbyPttButtonProps) {
  const [inner, setInner] = useState(false);
  const talking = active ?? inner;
  // Guards against double start/end within one gesture (pointer + keyboard + leave).
  const heldRef = useRef(false);

  const start = () => {
    if (heldRef.current) return;
    heldRef.current = true;
    setInner(true);
    onTalkStart?.();
  };
  const end = () => {
    if (!heldRef.current) return;
    heldRef.current = false;
    setInner(false);
    onTalkEnd?.();
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    if (mode === "hold") {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointers have nothing to capture */
      }
      start();
    }
  };
  const onRelease = () => {
    if (mode === "hold") end();
  };
  const onClick = () => {
    if (disabled || mode !== "tap") return;
    if (talking) {
      heldRef.current = false;
      setInner(false);
      onTalkEnd?.();
    } else {
      heldRef.current = true;
      setInner(true);
      onTalkStart?.();
    }
  };
  const isKey = (e: KeyboardEvent) => e.key === "Enter" || e.key === " ";
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (mode !== "hold" || disabled || !isKey(e)) return;
    e.preventDefault();
    if (!e.repeat) start();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (mode !== "hold" || !isKey(e)) return;
    e.preventDefault();
    end();
  };

  const large = size === "lg";
  return (
    <button
      aria-label={label}
      aria-pressed={talking}
      className={cn(
        "select-none touch-none border text-ink",
        focusRing,
        "disabled:cursor-not-allowed disabled:opacity-50",
        large
          ? "grid h-[76px] w-[76px] place-items-center rounded-full border-2"
          : "inline-flex h-12 items-center gap-[10px] whitespace-nowrap rounded-full pl-[6px] pr-4 font-medium",
        large
          ? talking
            ? "border-state-think bg-[color-mix(in_srgb,var(--color-state-think)_20%,var(--color-panel-2))] shadow-[0_0_0_8px_color-mix(in_srgb,var(--color-state-think)_12%,transparent)]"
            : "border-line-2 bg-panel-2"
          : talking
            ? "border-[color-mix(in_srgb,var(--color-state-think)_60%,transparent)] bg-[color-mix(in_srgb,var(--color-state-think)_16%,var(--color-panel-2))]"
            : "border-line-2 bg-panel-2",
      )}
      data-testid={testId}
      disabled={disabled}
      onBlur={onRelease}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onLostPointerCapture={onRelease}
      onPointerCancel={onRelease}
      onPointerDown={onPointerDown}
      onPointerLeave={onRelease}
      onPointerUp={onRelease}
      ref={ref}
      type="button"
    >
      {large ? (
        <Icon name="mic" size="xl" />
      ) : (
        <>
          <span
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full",
              talking ? "bg-state-think text-on-status" : "bg-raised text-ink",
            )}
            data-testid={ZibbyPttButtonTestId.Disc}
          >
            <Icon name="mic" size="md" />
          </span>
          {talking ? (
            <span
              aria-hidden="true"
              className="inline-flex h-[18px] items-center gap-0.5"
              data-testid={ZibbyPttButtonTestId.Wave}
            >
              {BAR_PROFILE.map((p, i) => (
                <i
                  className={cn(
                    "block h-[18px] w-[3px] origin-center rounded-sm bg-state-think",
                    level === undefined
                      ? "[transform:scaleY(0.22)] animate-[zb-wave_0.7s_ease-in-out_infinite]"
                      : "transition-transform duration-75",
                  )}
                  data-testid={ZibbyPttButtonTestId.WaveBar}
                  key={i}
                  style={
                    level === undefined
                      ? { animationDelay: `${i * 0.11}s` }
                      : {
                          transform: `scaleY(${Number(Math.max(0.22, Math.min(1, level) * p).toFixed(3))})`,
                        }
                  }
                />
              ))}
            </span>
          ) : null}
          {children ? <span data-testid={ZibbyPttButtonTestId.Label}>{children}</span> : null}
        </>
      )}
    </button>
  );
}
