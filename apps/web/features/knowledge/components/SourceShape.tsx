import type { BrainSource } from "../brainModel";

/** The vault is violet, every team KB teal (the mockup's two hemispheres; no per-KB hue). */
export const VAULT_COLOR = "var(--color-state-work)";
export const KB_COLOR = "var(--color-state-done)";

/** CSS colour for a source id: violet for the vault, teal for any team KB. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function sourceColorFor(_sources: readonly BrainSource[]): (sourceId: string) => string {
  return (id) => (id === "vault" ? VAULT_COLOR : KB_COLOR);
}

export interface SourceShapeProps {
  color: string;
  /** vault = circle, kb = rounded square, hub = double ring, ring = an outline (open question). */
  shape: "vault" | "kb" | "hub" | "ring" | "dashed" | "line";
}

/** A 14px swatch of a source's graph marker, drawn as SVG (no inline style on DOM nodes in the app). */
export function SourceShape({ color, shape }: SourceShapeProps) {
  return (
    <svg aria-hidden="true" height={14} viewBox="0 0 14 14" width={14}>
      {shape === "hub" ? (
        <>
          <circle cx={7} cy={7} fill="none" r={6} stroke={color} strokeWidth={1.4} />
          <circle cx={7} cy={7} fill={color} r={2.5} />
        </>
      ) : shape === "ring" ? (
        <circle cx={7} cy={7} fill="none" r={5.5} stroke={color} strokeWidth={1.6} />
      ) : shape === "dashed" ? (
        <circle
          cx={7}
          cy={7}
          fill="none"
          r={4.5}
          stroke={color}
          strokeDasharray="1.8 1.8"
          strokeWidth={1.3}
        />
      ) : shape === "line" ? (
        <rect fill={color} height={2} rx={1} width={14} x={0} y={6} />
      ) : shape === "vault" ? (
        <circle cx={7} cy={7} fill={color} r={5} />
      ) : (
        <rect fill={color} height={10} rx={2.5} width={10} x={2} y={2} />
      )}
    </svg>
  );
}
