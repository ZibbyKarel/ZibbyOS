"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** 0 = full; 1 = no wordmark text, compact search, one merged usage ring;
 *  2 = inactive sections / New / Approve / engine become icon-only. */
export type HeaderCollapseLevel = 0 | 1 | 2;

const MAX_LEVEL = 2;
/** Extra px of room required before stepping back up (hysteresis against oscillation). */
const HYSTERESIS = 24;

/**
 * Measures the header's own overflow (no fixed breakpoints, so longer Czech labels simply
 * collapse a step earlier) and steps `level` down when it overflows. It remembers the width at
 * which each level overflowed and only steps back up once the header is clearly wider than that.
 * `watch` re-measures when the header's content changes without a resize.
 *
 * Returns the callback ref for the `<header>` element and the current level.
 */
export function useHeaderCollapse(watch?: unknown) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [level, setLevel] = useState<HeaderCollapseLevel>(0);
  const overflowedAt = useRef<number[]>([0, 0, 0]);

  useLayoutEffect(() => {
    if (!el) return;
    const check = () => {
      const width = el.clientWidth;
      if (el.scrollWidth > width + 1) {
        if (level < MAX_LEVEL) {
          overflowedAt.current[level] = width;
          setLevel((level + 1) as HeaderCollapseLevel);
        }
      } else if (level > 0 && width > (overflowedAt.current[level - 1] ?? 0) + HYSTERESIS) {
        setLevel((level - 1) as HeaderCollapseLevel);
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, level, watch]);

  return { ref: setEl, level };
}
