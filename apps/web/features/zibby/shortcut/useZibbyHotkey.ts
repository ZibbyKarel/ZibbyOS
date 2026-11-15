"use client";

import { useEffect, useRef } from "react";
import { detectShortcutPlatform, matchesZibbyShortcut } from "./shortcut";
import { isShortcutRecording, useZibbyShortcut } from "./useZibbyShortcut";

export interface ZibbyHotkeyRelease {
  /** How long the combination was held, in milliseconds. */
  heldMs: number;
}

export interface UseZibbyHotkeyOptions {
  /** Default `true`. While `false` no listener is attached. */
  enabled?: boolean;
  /** The combination went down (first, non-repeat keydown). `preventDefault()` was already called. */
  onPress: () => void;
  /** The combination ended: key up, a required modifier lifted first, or window blur. */
  onRelease: (info: ZibbyHotkeyRelease) => void;
}

type ModifierKey = "Alt" | "Control" | "Meta" | "Shift";

/**
 * Global summon hotkey. Listens on `window` in the capture phase so it fires while
 * focus is inside an input. A tap = press then quick release; a hold = walkie-talkie
 * (`heldMs` tells which). Handlers and the stored shortcut are read via refs, so the
 * listeners are attached once per `enabled` change. Suspended while Settings records a
 * new combination. Disabling/unmounting mid-hold drops the hold without `onRelease`.
 */
export function useZibbyHotkey({
  enabled = true,
  onPress,
  onRelease,
}: UseZibbyHotkeyOptions): void {
  const { shortcut } = useZibbyShortcut();
  const shortcutRef = useRef(shortcut);
  const onPressRef = useRef(onPress);
  const onReleaseRef = useRef(onRelease);

  useEffect(() => {
    shortcutRef.current = shortcut;
    onPressRef.current = onPress;
    onReleaseRef.current = onRelease;
  });

  useEffect(() => {
    if (!enabled) return;

    let active: { startedAt: number; code: string; modifiers: ModifierKey[] } | null = null;

    const release = () => {
      if (!active) return;
      const heldMs = Math.max(0, Date.now() - active.startedAt);
      active = null;
      onReleaseRef.current({ heldMs });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcutRecording()) return;
      if (!matchesZibbyShortcut(event, shortcutRef.current, detectShortcutPlatform())) return;
      // Swallow it (no space typed into an input, no OS/page default) — also on repeats.
      event.preventDefault();
      if (event.repeat || active) return;
      const modifiers: ModifierKey[] = [];
      if (event.altKey) modifiers.push("Alt");
      if (event.ctrlKey) modifiers.push("Control");
      if (event.metaKey) modifiers.push("Meta");
      if (event.shiftKey) modifiers.push("Shift");
      active = { startedAt: Date.now(), code: event.code, modifiers };
      onPressRef.current();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!active) return;
      const lifted = event.code === active.code;
      const modifierLifted = (active.modifiers as string[]).includes(event.key);
      if (!lifted && !modifierLifted) return;
      event.preventDefault();
      release();
    };

    const onBlur = () => release();

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      active = null;
    };
  }, [enabled]);
}
