import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useZibbyHotkey } from "./useZibbyHotkey";
import {
  ZIBBY_SHORTCUT_STORAGE_KEY,
  beginShortcutRecording,
  resetZibbyShortcutStoreForTests,
} from "./useZibbyShortcut";

const onPress = vi.fn();
const onRelease = vi.fn();

function setup(enabled?: boolean) {
  return renderHook(
    (props: { enabled?: boolean }) =>
      useZibbyHotkey({ enabled: props.enabled ?? true, onPress, onRelease }),
    { initialProps: { enabled } },
  );
}

function down(target: EventTarget = window, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    code: "Space",
    key: " ",
    altKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => void target.dispatchEvent(event));
  return event;
}

function up(target: EventTarget = window, init: KeyboardEventInit = {}) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keyup", {
        code: "Space",
        key: " ",
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  resetZibbyShortcutStoreForTests();
  onPress.mockReset();
  onRelease.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  resetZibbyShortcutStoreForTests();
});

describe("useZibbyHotkey", () => {
  it("press then release reports heldMs (tap)", () => {
    setup();
    const event = down();
    expect(event.defaultPrevented).toBe(true);
    expect(onPress).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(120));
    up();
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledWith({ heldMs: 120 });
  });

  it("reports a long hold", () => {
    setup();
    down();
    act(() => void vi.advanceTimersByTime(1500));
    up();
    expect(onRelease).toHaveBeenCalledWith({ heldMs: 1500 });
  });

  it("ignores auto-repeat but still swallows it", () => {
    setup();
    down();
    const repeat = down(window, { repeat: true });
    down(window, { repeat: true });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(repeat.defaultPrevented).toBe(true);
    up();
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("does not react to other keys or modifiers", () => {
    setup();
    down(window, { code: "KeyA" });
    down(window, { altKey: false });
    down(window, { altKey: true, shiftKey: true });
    expect(onPress).not.toHaveBeenCalled();
    up();
    expect(onRelease).not.toHaveBeenCalled();
  });

  it("fires in the capture phase while an input is focused", () => {
    setup();
    render(<input aria-label="field" />);
    const input = screen.getByLabelText("field");
    input.focus();
    const bubbleSpy = vi.fn();
    input.addEventListener("keydown", bubbleSpy);
    const event = down(input);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    up(input);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("releases when the modifier is lifted before the key", () => {
    setup();
    down();
    act(() => void vi.advanceTimersByTime(300));
    up(window, { code: "AltLeft", key: "Alt" });
    expect(onRelease).toHaveBeenCalledWith({ heldMs: 300 });
    up();
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("releases on window blur", () => {
    setup();
    down();
    act(() => void vi.advanceTimersByTime(50));
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(onRelease).toHaveBeenCalledWith({ heldMs: 50 });
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("is suspended while the shortcut is being recorded", () => {
    setup();
    const end = beginShortcutRecording();
    const event = down();
    expect(onPress).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    end();
    down();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled and attaches once enabled", () => {
    const { rerender } = setup(false);
    down();
    expect(onPress).not.toHaveBeenCalled();
    rerender({ enabled: true });
    down();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("accepts Ctrl+Space as an alias while the default is stored (non-mac)", () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("Win32");
    setup();
    down(window, { altKey: false, ctrlKey: true });
    expect(onPress).toHaveBeenCalledTimes(1);
    up(window, { code: "ControlLeft", key: "Control" });
    expect(onRelease).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("follows a customised shortcut without re-attaching and drops the alias", () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("Win32");
    window.localStorage.setItem(ZIBBY_SHORTCUT_STORAGE_KEY, "Alt+Shift+KeyJ");
    setup();
    down(window, { altKey: false, ctrlKey: true });
    expect(onPress).not.toHaveBeenCalled();
    down(window, { code: "KeyJ", key: "J", shiftKey: true });
    expect(onPress).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("uses the latest handlers without re-subscribing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const addSpy = vi.spyOn(window, "addEventListener");
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useZibbyHotkey({ onPress: cb, onRelease }),
      { initialProps: { cb: first } },
    );
    const attached = addSpy.mock.calls.filter(([type]) => type === "keydown").length;
    rerender({ cb: second });
    down();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(addSpy.mock.calls.filter(([type]) => type === "keydown").length).toBe(attached);
    addSpy.mockRestore();
  });

  it("removes its listeners on unmount", () => {
    const { unmount } = setup();
    unmount();
    down();
    expect(onPress).not.toHaveBeenCalled();
  });
});
