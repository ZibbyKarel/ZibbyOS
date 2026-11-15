"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_ZIBBY_SHORTCUT,
  type ShortcutPlatform,
  type ZibbyShortcut,
  detectShortcutPlatform,
  parseShortcut,
  serializeShortcut,
  shortcutsEqual,
} from "./shortcut";

/**
 * Per-browser preference, same posture as theme/motion (`state/appearance.tsx`):
 * `localStorage`, never read during the server/hydration render (the external
 * store's server snapshot is the default; React re-renders with the stored value
 * right after hydration), try/catch around storage, cross-tab sync through the
 * `storage` event.
 */
export const ZIBBY_SHORTCUT_STORAGE_KEY = "zibby-shortcut";

type Listener = () => void;

let current: ZibbyShortcut = DEFAULT_ZIBBY_SHORTCUT;
let loaded = false;
const listeners = new Set<Listener>();
let storageListening = false;

function readStored(): ZibbyShortcut {
  try {
    return (
      parseShortcut(window.localStorage.getItem(ZIBBY_SHORTCUT_STORAGE_KEY)) ??
      DEFAULT_ZIBBY_SHORTCUT
    );
  } catch {
    return DEFAULT_ZIBBY_SHORTCUT;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== ZIBBY_SHORTCUT_STORAGE_KEY) return;
  const next = readStored();
  if (shortcutsEqual(next, current)) return;
  current = next;
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (!storageListening) {
    window.addEventListener("storage", onStorage);
    storageListening = true;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && storageListening) {
      window.removeEventListener("storage", onStorage);
      storageListening = false;
    }
  };
}

function getSnapshot(): ZibbyShortcut {
  if (!loaded) {
    loaded = true;
    current = readStored();
  }
  return current;
}

function getServerSnapshot(): ZibbyShortcut {
  return DEFAULT_ZIBBY_SHORTCUT;
}

function setShortcut(next: ZibbyShortcut): void {
  loaded = true;
  current = shortcutsEqual(next, DEFAULT_ZIBBY_SHORTCUT) ? DEFAULT_ZIBBY_SHORTCUT : next;
  try {
    window.localStorage.setItem(ZIBBY_SHORTCUT_STORAGE_KEY, serializeShortcut(current));
  } catch {
    // Storage unavailable — the choice still applies for this session.
  }
  emit();
}

function reset(): void {
  loaded = true;
  current = DEFAULT_ZIBBY_SHORTCUT;
  try {
    window.localStorage.removeItem(ZIBBY_SHORTCUT_STORAGE_KEY);
  } catch {
    // ignore
  }
  emit();
}

/** Test helper: forget the cached value so the next read hits storage again. */
export function resetZibbyShortcutStoreForTests(): void {
  loaded = false;
  current = DEFAULT_ZIBBY_SHORTCUT;
}

export interface UseZibbyShortcutResult {
  shortcut: ZibbyShortcut;
  setShortcut: (next: ZibbyShortcut) => void;
  /** Back to the default (Alt+Space) and forget the stored choice. */
  reset: () => void;
  isDefault: boolean;
}

/** The operator's summon shortcut; shared across every component (module-level store). */
export function useZibbyShortcut(): UseZibbyShortcutResult {
  const shortcut = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    shortcut,
    setShortcut,
    reset,
    isDefault: shortcutsEqual(shortcut, DEFAULT_ZIBBY_SHORTCUT),
  };
}

const noopSubscribe = () => () => {};

/** Client platform without a hydration mismatch (server/hydration render sees `"linux"`). */
export function useShortcutPlatform(): ShortcutPlatform {
  return useSyncExternalStore(
    noopSubscribe,
    () => detectShortcutPlatform(),
    () => "linux",
  );
}

// ── Recording suspension ────────────────────────────────────────────────

let recordingCount = 0;

/** True while any Settings recorder is capturing a combination (the hotkey is suspended). */
export function isShortcutRecording(): boolean {
  return recordingCount > 0;
}

/** Suspends the global hotkey until the returned release function is called (idempotent). */
export function beginShortcutRecording(): () => void {
  recordingCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    recordingCount = Math.max(0, recordingCount - 1);
  };
}
