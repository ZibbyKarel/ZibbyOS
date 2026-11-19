/** Drag payload from the palette onto the canvas: a new agent phase or a deterministic step. */
export const PHASE_DND = "application/x-zibby-phase";

export type PhaseDrop = { kind: "agent"; id: string } | { kind: "step"; type: "tool" | "workflow" };

export const parsePhaseDrop = (raw: string): PhaseDrop | null => {
  try {
    const v = JSON.parse(raw) as PhaseDrop;
    if (v.kind === "agent" && typeof v.id === "string") return v;
    if (v.kind === "step" && (v.type === "tool" || v.type === "workflow")) return v;
  } catch {
    // not ours
  }
  return null;
};
