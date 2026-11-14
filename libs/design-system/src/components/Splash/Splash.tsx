"use client";
import type { Ref } from "react";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "../BrandMark/BrandMark";
import { StatusDot } from "../StatusDot/StatusDot";
import { Wordmark } from "../Wordmark/Wordmark";

export enum SplashTestId {
  Root = "splash-root",
  Glyph = "splash-glyph",
  Wordmark = "splash-wordmark",
  Progress = "splash-progress",
  ProgressFill = "splash-progress-fill",
  Status = "splash-status",
  Footer = "splash-footer",
}

/** The boot sequence's discrete stages — `"done"` means unmounted (the
 *  component renders `null` from there on). */
export type SplashPhase = "intro" | "settled" | "exit" | "done";

/** The state actually stored — `"exit"` is never set directly; it is derived
 *  each render from `"settled" && ready`, so the ready→exit transition never
 *  needs a `setState` inside an effect. */
type StoredPhase = Exclude<SplashPhase, "exit">;

/** The whole entrance (brand doc: "Celé trvá ~2,6 s") — wings unfold, the knot
 *  pops in and starts its wave, the wordmark and progress rise, steps tick. */
export const SPLASH_INTRO_MS = 2600;
/** One boot step on the status line. */
export const SPLASH_STEP_MS = 560;
/** Exit fade once `ready` — pointer-events are already `none` throughout it. */
export const SPLASH_EXIT_MS = 320;

/** Defensive by design (mirrors `DesignSystemProvider`'s `matchMedia` guard):
 *  `window.matchMedia` is absent in SSR and throws "not implemented" in some
 *  jsdom versions — never let a motion-preference read crash the splash. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export interface SplashProps {
  /** Flips true once the app has finished loading. It only gates the exit
   *  fade — the entrance always plays in full (a minimum splash time) unless
   *  the operator prefers reduced motion. */
  ready: boolean;
  /** Fires once the exit fade completes. From that point the component
   *  renders nothing — it never re-intercepts clicks, even if the caller is
   *  slow to remove it from the tree. */
  onDone?: () => void;
  /** Overrides the `zibby.` lettering — passed through to `Wordmark`. */
  wordmark?: string;
  /** Boot steps shown one by one on the status line (every `SPLASH_STEP_MS`),
   *  driving the progress bar. The last one is the "ready" line. */
  steps?: readonly string[];
  /** Accessible label, and the status line when no `steps` are given. */
  status?: string;
  /** Small mono line at the bottom, e.g. `zibby os v0.9 · Můstek`. */
  footer?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The boot screen (`design/brand/ZibbyCorp – Brand.html`, "Splash"): the bow
 * tie unfolds, its knot lights up amber and sends out waves, the wordmark
 * rises, then the real boot steps tick along a thin progress bar. A soft
 * amber radial and a faded grid sit behind it. Exits with a fade once both
 * the entrance has played (`SPLASH_INTRO_MS`) and `ready` is true. Reduced
 * motion shows the final frame at once and fades out instantly once ready.
 */
export function Splash({
  ready,
  onDone,
  wordmark,
  steps,
  status = "Booting",
  footer,
  ref,
}: SplashProps) {
  // Lazy initializer — computed once, on mount, never re-read during render.
  const [reducedMotion] = useState(prefersReducedMotion);
  const lastStep = steps && steps.length > 0 ? steps.length - 1 : 0;

  const [phase, setPhase] = useState<StoredPhase>(reducedMotion ? "settled" : "intro");
  const [step, setStep] = useState(reducedMotion ? lastStep : 0);

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("settled"), SPLASH_INTRO_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (step >= lastStep) return;
    const t = setTimeout(() => setStep((s) => s + 1), SPLASH_STEP_MS);
    return () => clearTimeout(t);
  }, [step, lastStep]);

  const displayPhase: SplashPhase = phase === "settled" && ready ? "exit" : phase;

  useEffect(() => {
    if (displayPhase !== "exit") return;
    const t = setTimeout(
      () => {
        setPhase("done");
        onDoneRef.current?.();
      },
      reducedMotion ? 0 : SPLASH_EXIT_MS,
    );
    return () => clearTimeout(t);
  }, [reducedMotion, displayPhase]);

  if (displayPhase === "done") return null;

  const exiting = displayPhase === "exit";
  const hasSteps = Boolean(steps && steps.length > 1);
  const finished = step >= lastStep;
  const line = steps?.[step] ?? status;
  const pct = hasSteps ? Math.round((step / lastStep) * 100) : 0;

  return (
    <div
      aria-busy={!exiting}
      aria-label={status}
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-background text-ink"
      data-phase={displayPhase}
      data-testid={SplashTestId.Root}
      ref={ref}
      role="status"
      style={{
        backgroundImage:
          "radial-gradient(640px 420px at 50% 44%, color-mix(in srgb, var(--color-accent) 7%, transparent), transparent 70%)",
        opacity: exiting ? 0 : 1,
        pointerEvents: exiting ? "none" : undefined,
        transitionDuration: reducedMotion ? "0ms" : `${SPLASH_EXIT_MS}ms`,
        transitionProperty: "opacity",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-line) 1px, transparent 1px)," +
            "linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(520px 360px at 50% 46%, #000, transparent 75%)",
          WebkitMaskImage: "radial-gradient(520px 360px at 50% 46%, #000, transparent 75%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-[22px]">
        <div
          className="text-ink [&>svg]:size-[92px] md:[&>svg]:size-[116px]"
          data-testid={SplashTestId.Glyph}
        >
          <BrandMark intro size={116} state="blocked" />
        </div>

        <div className="zb-brand-rise [animation-delay:1.05s]" data-testid={SplashTestId.Wordmark}>
          <Wordmark size="lg">{wordmark}</Wordmark>
        </div>

        <div className="zb-brand-rise flex flex-col items-center gap-3 [animation-delay:1.25s]">
          {hasSteps && (
            <div
              aria-label={status}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={pct}
              className="h-0.5 w-[220px] overflow-hidden rounded-sm bg-line-2"
              data-testid={SplashTestId.Progress}
              role="progressbar"
            >
              <span
                className="block h-full bg-ink-2 transition-[width] duration-[450ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                data-testid={SplashTestId.ProgressFill}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          <span
            className="flex h-[18px] items-center gap-2 font-mono text-[12px] text-ink-3"
            data-testid={SplashTestId.Status}
          >
            <StatusDot pulse tone={finished && hasSteps ? "done" : "working"} />
            {finished || !hasSteps ? line : `${line}…`}
          </span>
        </div>
      </div>

      {footer && (
        <span
          className="absolute inset-x-0 bottom-7 text-center font-mono text-[11px] text-ink-3"
          data-testid={SplashTestId.Footer}
        >
          {footer}
        </span>
      )}
    </div>
  );
}
