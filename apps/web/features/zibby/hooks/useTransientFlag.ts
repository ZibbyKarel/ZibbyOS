"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A boolean that switches on when `trigger()` is called and off again by itself after
 * `ms` (re-triggering restarts the clock). Drives the orb's short-lived `done` / `error`
 * states (~1.5 s after a turn completes / fails).
 */
export function useTransientFlag(ms: number): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const trigger = useCallback(() => {
    clearTimeout(timer.current);
    setOn(true);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return [on, trigger];
}
