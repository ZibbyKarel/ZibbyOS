import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ZIBBY_SHORTCUT } from "./shortcut";
import {
  ZIBBY_SHORTCUT_STORAGE_KEY,
  beginShortcutRecording,
  isShortcutRecording,
  resetZibbyShortcutStoreForTests,
  useZibbyShortcut,
} from "./useZibbyShortcut";

const CUSTOM = { code: "KeyJ", alt: true, ctrl: false, meta: false, shift: true };

beforeEach(() => {
  window.localStorage.clear();
  resetZibbyShortcutStoreForTests();
});
afterEach(() => {
  window.localStorage.clear();
  resetZibbyShortcutStoreForTests();
});

describe("useZibbyShortcut", () => {
  it("defaults to Alt+Space", () => {
    const { result } = renderHook(() => useZibbyShortcut());
    expect(result.current.shortcut).toEqual(DEFAULT_ZIBBY_SHORTCUT);
    expect(result.current.isDefault).toBe(true);
  });

  it("reads a stored shortcut", () => {
    window.localStorage.setItem(ZIBBY_SHORTCUT_STORAGE_KEY, "Alt+Shift+KeyJ");
    const { result } = renderHook(() => useZibbyShortcut());
    expect(result.current.shortcut).toEqual(CUSTOM);
    expect(result.current.isDefault).toBe(false);
  });

  it("ignores garbage in storage", () => {
    window.localStorage.setItem(ZIBBY_SHORTCUT_STORAGE_KEY, "garbage");
    const { result } = renderHook(() => useZibbyShortcut());
    expect(result.current.shortcut).toEqual(DEFAULT_ZIBBY_SHORTCUT);
  });

  it("setShortcut persists and is shared between hook instances", () => {
    const a = renderHook(() => useZibbyShortcut());
    const b = renderHook(() => useZibbyShortcut());
    act(() => a.result.current.setShortcut(CUSTOM));
    expect(window.localStorage.getItem(ZIBBY_SHORTCUT_STORAGE_KEY)).toBe("Alt+Shift+KeyJ");
    expect(b.result.current.shortcut).toEqual(CUSTOM);
    expect(b.result.current.isDefault).toBe(false);
  });

  it("reset restores the default and clears storage", () => {
    const { result } = renderHook(() => useZibbyShortcut());
    act(() => result.current.setShortcut(CUSTOM));
    act(() => result.current.reset());
    expect(result.current.shortcut).toEqual(DEFAULT_ZIBBY_SHORTCUT);
    expect(result.current.isDefault).toBe(true);
    expect(window.localStorage.getItem(ZIBBY_SHORTCUT_STORAGE_KEY)).toBeNull();
  });

  it("syncs from another tab via the storage event", () => {
    const { result } = renderHook(() => useZibbyShortcut());
    act(() => {
      window.localStorage.setItem(ZIBBY_SHORTCUT_STORAGE_KEY, "Alt+Shift+KeyJ");
      window.dispatchEvent(new StorageEvent("storage", { key: ZIBBY_SHORTCUT_STORAGE_KEY }));
    });
    expect(result.current.shortcut).toEqual(CUSTOM);
    act(() => {
      window.localStorage.removeItem(ZIBBY_SHORTCUT_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: ZIBBY_SHORTCUT_STORAGE_KEY }));
    });
    expect(result.current.isDefault).toBe(true);
  });

  it("ignores storage events for other keys", () => {
    const { result } = renderHook(() => useZibbyShortcut());
    act(() => {
      window.localStorage.setItem(ZIBBY_SHORTCUT_STORAGE_KEY, "Alt+Shift+KeyJ");
      window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    });
    expect(result.current.isDefault).toBe(true);
  });
});

describe("recording suspension", () => {
  it("counts holders and release is idempotent", () => {
    expect(isShortcutRecording()).toBe(false);
    const a = beginShortcutRecording();
    const b = beginShortcutRecording();
    a();
    a();
    expect(isShortcutRecording()).toBe(true);
    b();
    expect(isShortcutRecording()).toBe(false);
  });
});
