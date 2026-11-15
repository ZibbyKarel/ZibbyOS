"use client";

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ZibbyOrbState, ZibbyOverlayPhase } from "../voice/orbState";

/** What the rest of the shell may know about the overlay: its phase and its live orb state. */
export interface ZibbyLive {
  phase: ZibbyOverlayPhase;
  orbState: ZibbyOrbState;
}

interface ZibbyLiveStore extends ZibbyLive {
  publish: (next: ZibbyLive) => void;
}

const CLOSED: ZibbyLive = { phase: "closed", orbState: "sleep" };

const ZibbyLiveContext = createContext<ZibbyLiveStore | null>(null);

/**
 * Bridges `ZibbyHost` (which owns the overlay and derives the orb state) to the header's
 * summon chip, so the chip's small orb mirrors the live state while the overlay is open.
 * A separate context (not `ChatContext`) keeps orb-state churn from re-rendering every chat consumer.
 */
export function ZibbyLiveProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<ZibbyLive>(CLOSED);
  const publish = useCallback((next: ZibbyLive) => {
    setLive((prev) => (prev.phase === next.phase && prev.orbState === next.orbState ? prev : next));
  }, []);
  const value = useMemo<ZibbyLiveStore>(() => ({ ...live, publish }), [live, publish]);
  return <ZibbyLiveContext.Provider value={value}>{children}</ZibbyLiveContext.Provider>;
}

/** The overlay's live phase + orb state; the closed/asleep default outside a provider. */
export function useZibbyLive(): ZibbyLive {
  const ctx = useContext(ZibbyLiveContext);
  return ctx ?? CLOSED;
}

/** Host-side publisher; a no-op outside a provider. */
export function usePublishZibbyLive(): (next: ZibbyLive) => void {
  const ctx = useContext(ZibbyLiveContext);
  return ctx?.publish ?? NOOP;
}

const NOOP = () => undefined;
