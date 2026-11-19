import { describe, expect, it } from "vitest";
import {
  HIT_RADIUS,
  MAX_PUSH,
  MIN_READABLE_K,
  REPEL_RADIUS,
  cursorPush,
  easeCam,
  selectionCam,
} from "./brainMotion";

describe("cursorPush", () => {
  it("never moves a node under the pointer", () => {
    expect(cursorPush(HIT_RADIUS - 1, 0)).toEqual({ x: 0, y: 0 });
    expect(cursorPush(0, 0)).toEqual({ x: 0, y: 0 });
  });
  it("ignores nodes beyond the repel radius", () => {
    expect(cursorPush(REPEL_RADIUS + 1, 0)).toEqual({ x: 0, y: 0 });
  });
  it("pushes away from the pointer and never beyond the cap", () => {
    for (let d = 1; d < 120; d += 1) {
      const p = cursorPush(d, d / 2);
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(MAX_PUSH + 1e-9);
      expect(p.x).toBeGreaterThanOrEqual(0);
    }
    expect(cursorPush(-30, 0).x).toBeLessThan(0);
  });
});

describe("selectionCam", () => {
  it("keeps a readable zoom and centres the note", () => {
    expect(selectionCam({ x: 5, y: 5, k: 2 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, k: 2 });
  });
  it("only lifts the zoom up to the readable minimum, never to fit-all", () => {
    expect(selectionCam({ x: 0, y: 0, k: 0.3 }, { x: 1, y: 2 }).k).toBe(MIN_READABLE_K);
  });
});

describe("easeCam", () => {
  it("moves towards the target without overshoot and lands on it", () => {
    const target = { x: 100, y: 0, k: 1 };
    let cam = { x: 0, y: 0, k: 1 };
    let done = false;
    for (let i = 0; i < 100 && !done; i++) {
      const r = easeCam(cam, target, 16);
      expect(r.cam.x).toBeGreaterThanOrEqual(cam.x);
      expect(r.cam.x).toBeLessThanOrEqual(100);
      cam = r.cam;
      done = r.done;
    }
    expect(done).toBe(true);
    expect(cam).toEqual(target);
  });
});
