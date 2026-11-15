"use client";
import type { Ref } from "react";
import { useEffect, useRef } from "react";
import { type OrbLive, ZIBBY_ORB_STATES, type ZibbyOrbState, registerOrb } from "./orbEngine";

export { ZIBBY_ORB_STATES };
export type { ZibbyOrbState };

export enum ZibbyOrbTestId {
  Root = "zibby-orb-root",
  Canvas = "zibby-orb-canvas",
}

export interface ZibbyOrbProps {
  /** One of the 12 orb states; colour, shape and motion morph between them. Default `ready`. */
  state?: ZibbyOrbState;
  /** Box size in px (the glow/particles overflow it by 40 % per side). Default 64. */
  size?: number;
  /** Live audio level 0–1; drives the "breath" in `listen` / `speak`. Omitted → built-in pseudo envelope. */
  level?: number;
  /** Accessible name. Default `"Zibby · <state>"`. */
  label?: string;
  "data-testid"?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Zibby's face — a wire-mesh sphere on a 2D canvas (typed port of `design/zibby/orb.js`).
 * All mounted orbs are drawn by one shared `requestAnimationFrame` loop (see `orbEngine`);
 * prop changes never restart the animation, the state just morphs. Light/dark follows the
 * nearest `data-theme` (set by `DesignSystemProvider`); `prefers-reduced-motion` freezes
 * the shape so only colour carries the state.
 */
export function ZibbyOrb({
  state = "ready",
  size = 64,
  level,
  label,
  "data-testid": testId = ZibbyOrbTestId.Root,
  ref,
}: ZibbyOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef<OrbLive>({ state, size, level });

  // Keep the live props fresh without restarting anything (runs before the register effect).
  useEffect(() => {
    latest.current = { state, size, level };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return registerOrb({ canvas, read: () => latest.current, sim: null });
  }, []);

  return (
    <div
      aria-label={label ?? `Zibby · ${state}`}
      className="relative flex-none"
      data-state={state}
      data-testid={testId}
      ref={ref}
      role="img"
      style={{ width: size, height: size }}
    >
      <canvas
        aria-hidden="true"
        className="pointer-events-none absolute -top-[40%] -left-[40%] block h-[180%] w-[180%]"
        data-testid={ZibbyOrbTestId.Canvas}
        ref={canvasRef}
      />
    </div>
  );
}
