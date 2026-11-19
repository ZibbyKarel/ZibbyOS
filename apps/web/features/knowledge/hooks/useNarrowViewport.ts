"use client";

import { useSyncExternalStore } from "react";

/** The brain's three zones collapse to tabs at this width and below (phone; at 1100px the three zones stay and the tree stays a rail). */
const NARROW_QUERY = "(max-width: 800px)";

const mql = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(NARROW_QUERY)
    : null;

const subscribe = (onChange: () => void) => {
  const m = mql();
  m?.addEventListener("change", onChange);
  return () => m?.removeEventListener("change", onChange);
};

/** Whether the viewport is ≤800px (live). Server render and jsdom report `false` — the wide layout. */
export function useNarrowViewport(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mql()?.matches ?? false,
    () => false,
  );
}
