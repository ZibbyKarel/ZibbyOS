"use client";

import { useEffect, useRef } from "react";
import { useZibbyHotkey } from "../shortcut/useZibbyHotkey";
import type { ZibbyOverlayPhase } from "../voice/orbState";

/** A hold shorter than this is a tap (mirrors the voice engine's minimum utterance). */
export const SUMMON_HOLD_MS = 300;

export interface UseZibbySummonOptions {
  /** The overlay's open flag (`ChatContext.dockOpen`). */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Phase reported by the overlay frame. */
  phase: ZibbyOverlayPhase;
  /** Mode-aware talk start (`ZibbyVoice.pressTalk`). */
  pressTalk: () => void;
  /** Mode-aware talk end (`ZibbyVoice.releaseTalk`) — sends in push-to-talk. */
  releaseTalk: () => void;
  /** Abort without sending (`ZibbyVoice.cancelTalk`). */
  cancelTalk: () => void;
}

interface Hold {
  /** The press opened the overlay (it was closed). */
  fromClosed: boolean;
  /** Talking has been started for this hold. */
  talking: boolean;
}

/**
 * The global summon shortcut (default ⌥ Space), tap vs hold:
 *
 * - **Tap** (< {@link SUMMON_HOLD_MS}) toggles: closed → opens (and stays open, even when the
 *   overlay opens instantly under reduced motion); open → closes (the talk the press started is
 *   cancelled, nothing is sent).
 * - **Hold** is the walkie-talkie: pressed while open it starts talking at once; pressed while
 *   closed it opens the overlay and — once the summon animation is over and the key is still
 *   held — starts talking. Releasing a hold ends push-to-talk, which sends (hands-free keeps
 *   listening until silence; its release is a no-op in the voice hook).
 *
 * A press during the summon/leave animation is ignored unless the overlay is closed or open.
 */
export function useZibbySummon({
  open,
  setOpen,
  phase,
  pressTalk,
  releaseTalk,
  cancelTalk,
}: UseZibbySummonOptions): void {
  const holdRef = useRef<Hold | null>(null);

  useZibbyHotkey({
    onPress: () => {
      if (phase === "open" && open) {
        holdRef.current = { fromClosed: false, talking: true };
        pressTalk();
      } else if (!open) {
        holdRef.current = { fromClosed: true, talking: false };
        setOpen(true);
      }
    },
    onRelease: ({ heldMs }) => {
      const hold = holdRef.current;
      holdRef.current = null;
      if (!hold) return;
      if (heldMs >= SUMMON_HOLD_MS) {
        if (hold.talking) releaseTalk();
        return;
      }
      // A tap. Whatever talk it started (instant open under reduced motion) is dropped; only a tap
      // that began on an already-open overlay closes it.
      if (hold.talking) cancelTalk();
      if (!hold.fromClosed) setOpen(false);
    },
  });

  // Hold from closed: the key is still down when the summon animation ends → start talking.
  const pressTalkRef = useRef(pressTalk);
  useEffect(() => {
    pressTalkRef.current = pressTalk;
  });
  useEffect(() => {
    const hold = holdRef.current;
    if (phase === "open" && hold?.fromClosed && !hold.talking) {
      hold.talking = true;
      pressTalkRef.current();
    }
  }, [phase]);
}
