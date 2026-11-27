import type { Cam } from "./components/BrainGraph";

/** Selecting a note never leaves the view zoomed out further than this. */
export const MIN_READABLE_K = 0.8;
/** Time constant (ms) of the pan towards a selected note; ~3 constants ≈ 350 ms. */
export const CAM_EASE_MS = 110;

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
