"use client";
import type { Ref } from "react";
import { useId } from "react";
import { type StateTone, stateToneVar } from "../../stateTone";

export enum BrandMarkTestId {
  Root = "brand-mark-root",
  Wings = "brand-mark-wings",
  Glow = "brand-mark-glow",
  Ring = "brand-mark-ring",
  Knot = "brand-mark-knot",
}

/** The sanctioned render sizes (sealed sizing), in px. ≤24 is the small cut
 *  (heavier wings, larger knot); ≥40 adds the soft knot glow. */
export type BrandMarkSize = 16 | 24 | 32 | 48 | 64 | 92 | 116;

/** The system states the knot can show (brand doc "Motýlek"): `idle` = calm,
 *  `working` = agents are working, `blocked` = something waits on the operator. */
export type BrandMarkState = Extract<StateTone, "idle" | "working" | "blocked">;

export interface BrandMarkProps {
  /** Render size in px. Defaults to 24 (the app-header size). */
  size?: BrandMarkSize;
  /** Knot colour. Defaults to `blocked` — the amber static brand mark; `done` is the static
   *  emerald logo (no system state). */
  state?: BrandMarkState | "done";
  /** Live knot: the glow breathes at the state's tempo (idle 4.5s, working
   *  1.1s, blocked 1.8s) and `blocked` sends out a ring wave. */
  live?: boolean;
  /** Splash entrance: wings unfold, the knot pops in, its glow fades up and a
   *  ring wave starts. Plays once on mount. */
  intro?: boolean;
  /** Accessible name. Omit when the mark sits beside the wordmark — it is then
   *  decorative and hidden from assistive tech. */
  label?: string;
  /** Single-colour cut (mockup `mono`): the knot takes `currentColor` and the
   *  glow is dropped — for one-ink contexts (print, emboss, tinted chrome). */
  mono?: boolean;
  ref?: Ref<SVGSVGElement>;
}

/**
 * The ZibbyOS logo mark — the butler's bow tie ("Motýlek",
 * `design/brand/ZibbyCorp – Brand.html`). Two calm wings in `currentColor`
 * around a live knot coloured by the system state (`--color-state-*`). The
 * knot is cut out of the wings with a mask, so the mark sits on any surface.
 * Motion (`zb-mark-*` in `theme/globals.css`) only runs under
 * `prefers-reduced-motion: no-preference`.
 */
export function BrandMark({
  size = 24,
  state = "blocked",
  live = false,
  intro = false,
  label,
  mono = false,
  ref,
}: BrandMarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const maskId = `zb-mark-cut-${uid}`;
  const blurId = `zb-mark-blur-${uid}`;
  const small = size <= 24;
  const glow = size >= 40 && !mono;
  const knot = mono ? "currentColor" : stateToneVar[state];
  const ring = intro || (live && state === "blocked");

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className="zb-mark block shrink-0 overflow-visible"
      data-intro={intro || undefined}
      data-live={live || undefined}
      data-state={state}
      data-testid={BrandMarkTestId.Root}
      fill="none"
      focusable="false"
      height={size}
      ref={ref}
      role={label ? "img" : undefined}
      viewBox="0 0 64 64"
      width={size}
    >
      <defs>
        <mask height="80" id={maskId} maskUnits="userSpaceOnUse" width="80" x="-8" y="-8">
          <rect fill="white" height="80" width="80" x="-8" y="-8" />
          <circle cx="32" cy="32" fill="black" r={small ? 8 : 8.6} />
        </mask>
        {glow && (
          <filter height="300%" id={blurId} width="300%" x="-100%" y="-100%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
        )}
      </defs>
      <g
        data-testid={BrandMarkTestId.Wings}
        fill="currentColor"
        mask={`url(#${maskId})`}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={small ? 6 : 4}
      >
        <path className="zb-mark-wing zb-mark-wing-l" d="M8 16L28.5 30V34L8 48Z" />
        <path className="zb-mark-wing zb-mark-wing-r" d="M56 16L35.5 30V34L56 48Z" />
      </g>
      {glow && (
        <circle
          className="zb-mark-glow"
          cx="32"
          cy="32"
          data-testid={BrandMarkTestId.Glow}
          fill={knot}
          filter={`url(#${blurId})`}
          r="8"
        />
      )}
      {ring && (
        <circle
          className="zb-mark-ring"
          cx="32"
          cy="32"
          data-testid={BrandMarkTestId.Ring}
          r="6.4"
          stroke={knot}
          strokeWidth="1.4"
        />
      )}
      <circle
        className="zb-mark-knot"
        cx="32"
        cy="32"
        data-testid={BrandMarkTestId.Knot}
        fill={knot}
        r={small ? 6.5 : 6.2}
      />
    </svg>
  );
}
