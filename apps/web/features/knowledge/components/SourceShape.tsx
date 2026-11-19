import type { BrainSource } from "../brainModel";

/** Tone tokens a team KB cycles through; the vault is always the accent. */
const KB_COLORS = ["var(--color-ok)", "var(--color-run)", "var(--color-state-think)"];

/** CSS colour for a source id: the vault is the accent, KBs cycle `KB_COLORS` in registry order. */
export function sourceColorFor(sources: readonly BrainSource[]): (sourceId: string) => string {
  const kbs = sources.filter((s) => s.kind === "kb").map((s) => s.id);
  return (id) =>
    id === "vault"
      ? "var(--color-accent)"
      : (KB_COLORS[Math.max(0, kbs.indexOf(id)) % KB_COLORS.length] ?? "var(--color-ok)");
}

export interface SourceShapeProps {
  color: string;
  /** vault = circle, kb = rounded square, hub = double ring, ring = an outline (open question). */
  shape: "vault" | "kb" | "hub" | "ring";
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
      ) : shape === "vault" ? (
        <circle cx={7} cy={7} fill={color} r={5} />
      ) : (
        <rect fill={color} height={10} rx={2.5} width={10} x={2} y={2} />
      )}
    </svg>
  );
}
