import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZibbyOverlayPhase } from "../voice/orbState";
import { SUMMON_HOLD_MS, type UseZibbySummonOptions, useZibbySummon } from "./useZibbySummon";

// Capture the handlers the hook hands the hotkey so the test can press / release by hand.
const hotkey = vi.hoisted(() => ({
  onPress: undefined as undefined | (() => void),
  onRelease: undefined as undefined | ((info: { heldMs: number }) => void),
}));
vi.mock("../shortcut/useZibbyHotkey", () => ({
  useZibbyHotkey: (opts: {
    onPress: () => void;
    onRelease: (info: { heldMs: number }) => void;
  }) => {
    hotkey.onPress = opts.onPress;
    hotkey.onRelease = opts.onRelease;
  },
}));

function setup(initial: { open: boolean; phase: ZibbyOverlayPhase }) {
  const calls = {
    setOpen: vi.fn(),
    pressTalk: vi.fn(),
    releaseTalk: vi.fn(),
    cancelTalk: vi.fn(),
  };
  const view = renderHook(
    (props: Pick<UseZibbySummonOptions, "open" | "phase">) =>
      useZibbySummon({ ...props, ...calls }),
    { initialProps: initial },
  );
  return { ...calls, rerender: view.rerender };
}

const press = () => hotkey.onPress?.();
const release = (heldMs: number) => hotkey.onRelease?.({ heldMs });

describe("useZibbySummon", () => {
  beforeEach(() => {
    hotkey.onPress = undefined;
    hotkey.onRelease = undefined;
  });

  it("a tap while closed opens the overlay and does not talk", () => {
    const s = setup({ open: false, phase: "closed" });
    press();
    expect(s.setOpen).toHaveBeenCalledWith(true);
    release(120);
    s.rerender({ open: true, phase: "open" });
    expect(s.pressTalk).not.toHaveBeenCalled();
    expect(s.releaseTalk).not.toHaveBeenCalled();
    expect(s.setOpen).toHaveBeenCalledTimes(1);
  });

  it("a tap from closed stays open even when the overlay opens instantly (reduced motion)", () => {
    const s = setup({ open: false, phase: "closed" });
    press();
    s.rerender({ open: true, phase: "open" }); // opened before the key came up
    expect(s.pressTalk).toHaveBeenCalledTimes(1);
    release(40);
    expect(s.cancelTalk).toHaveBeenCalledTimes(1);
    expect(s.setOpen).toHaveBeenCalledTimes(1);
    expect(s.setOpen).toHaveBeenCalledWith(true);
    expect(s.releaseTalk).not.toHaveBeenCalled();
  });

  it("a hold from closed opens, starts talking once the animation is over, and releasing sends", () => {
    const s = setup({ open: false, phase: "closed" });
    press();
    expect(s.setOpen).toHaveBeenCalledWith(true);
    s.rerender({ open: true, phase: "summoning" });
    expect(s.pressTalk).not.toHaveBeenCalled();
    s.rerender({ open: true, phase: "open" });
    expect(s.pressTalk).toHaveBeenCalledTimes(1);
    release(1200);
    expect(s.releaseTalk).toHaveBeenCalledTimes(1);
    expect(s.cancelTalk).not.toHaveBeenCalled();
  });

  it("releasing before the summon animation ends never starts talking", () => {
    const s = setup({ open: false, phase: "closed" });
    press();
    s.rerender({ open: true, phase: "summoning" });
    release(500);
    s.rerender({ open: true, phase: "open" });
    expect(s.pressTalk).not.toHaveBeenCalled();
    expect(s.releaseTalk).not.toHaveBeenCalled();
  });

  it("pressed while open it starts talking at once; a hold release sends", () => {
    const s = setup({ open: true, phase: "open" });
    press();
    expect(s.pressTalk).toHaveBeenCalledTimes(1);
    release(SUMMON_HOLD_MS);
    expect(s.releaseTalk).toHaveBeenCalledTimes(1);
    expect(s.setOpen).not.toHaveBeenCalled();
  });

  it("a tap while open cancels the talk it started and closes the overlay", () => {
    const s = setup({ open: true, phase: "open" });
    press();
    release(SUMMON_HOLD_MS - 1);
    expect(s.cancelTalk).toHaveBeenCalledTimes(1);
    expect(s.releaseTalk).not.toHaveBeenCalled();
    expect(s.setOpen).toHaveBeenCalledWith(false);
  });

  it("ignores a press during the summon animation", () => {
    const s = setup({ open: true, phase: "summoning" });
    press();
    release(50);
    expect(s.pressTalk).not.toHaveBeenCalled();
    expect(s.setOpen).not.toHaveBeenCalled();
  });

  it("re-summons during the leave animation", () => {
    const s = setup({ open: false, phase: "leaving" });
    press();
    expect(s.setOpen).toHaveBeenCalledWith(true);
  });
});
