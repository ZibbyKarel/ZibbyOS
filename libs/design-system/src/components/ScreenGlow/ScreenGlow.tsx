import type { HTMLAttributes, Ref } from "react";

export enum ScreenGlowTestId {
  Root = "screen-glow-root",
}

export interface ScreenGlowProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * The Autopilot frame: an amber hairline plus a soft inner glow along the whole
 * viewport edge, breathing slowly - the "ZIBBY is acting on its own" signal. Mount
 * it only while that state holds.
 *
 * Fixed over the viewport, decorative (`aria-hidden`) and `pointer-events: none`, so
 * it never blocks content. The look and the 3.2s breathing live in `.zb-screen-glow`
 * (`globals.css`); under `prefers-reduced-motion` it stays static.
 *
 * Deliberate exception to the matte "no glow" canon (DS.md 1.2): the operator asked
 * for this one ambient signal explicitly.
 */
export function ScreenGlow({ ref, ...rest }: ScreenGlowProps) {
  return (
    <div
      aria-hidden="true"
      className="zb-screen-glow pointer-events-none fixed inset-0 z-[9999]"
      data-testid={ScreenGlowTestId.Root}
      ref={ref}
      {...rest}
    />
  );
}
