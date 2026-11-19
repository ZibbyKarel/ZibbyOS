import type { Cam } from "./components/BrainGraph";

/**
 * Largest distance (screen px) the cursor may push a node away. The mockup pushes up to 17px (and
 * 22px around a hovered node), which made notes hard to land on; a third of that keeps the cloud
 * alive without it running from the pointer.
 */
export const MAX_PUSH = 6;
/** Nodes closer than this to the pointer (screen px) do not move at all, so they stay catchable. */
export const HIT_RADIUS = 10;
/** Nodes farther than this from the pointer are not affected (screen px). */
export const REPEL_RADIUS = 85;
/** Selecting a note never leaves the view zoomed out further than this. */
export const MIN_READABLE_K = 0.8;
/** Time constant (ms) of the pan towards a selected note; ~3 constants ≈ 350 ms. */
export const CAM_EASE_MS = 110;

/**
 * Push on one node, in screen px, away from a pointer at `(dx, dy)` from the node's rest position
 * (`dx = node − pointer`). Zero inside {@link HIT_RADIUS}, ramping in over 12px, quadratic falloff
 * to {@link REPEL_RADIUS}, never more than {@link MAX_PUSH}.
 */
export function cursorPush(dx: number, dy: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (d <= HIT_RADIUS || d >= REPEL_RADIUS) return { x: 0, y: 0 };
  const f = 1 - d / REPEL_RADIUS;
  const ramp = Math.min(1, (d - HIT_RADIUS) / 12);
  const m = Math.min(MAX_PUSH, MAX_PUSH * f * f * 1.6) * ramp;
  return { x: (dx / d) * m, y: (dy / d) * m };
}

/**
 * Camera target for selecting a note: keep the current zoom (only lift it to the readable
 * minimum) and put the note at the centre of the viewport. Never refits the whole graph.
 */
export function selectionCam(cam: Cam, p: { x: number; y: number }): Cam {
  return { x: p.x, y: p.y, k: Math.max(cam.k, MIN_READABLE_K) };
}

/** One time-based easing step of the camera towards `target`; `done` when it has arrived. */
export function easeCam(cam: Cam, target: Cam, dtMs: number): { cam: Cam; done: boolean } {
  const a = 1 - Math.exp(-dtMs / CAM_EASE_MS);
  const next = {
    x: cam.x + (target.x - cam.x) * a,
    y: cam.y + (target.y - cam.y) * a,
    k: cam.k + (target.k - cam.k) * a,
  };
  const done =
    Math.abs(target.x - next.x) * next.k < 0.4 &&
    Math.abs(target.y - next.y) * next.k < 0.4 &&
    Math.abs(target.k - next.k) < 0.003;
  return { cam: done ? { ...target } : next, done };
}
