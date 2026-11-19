"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** 0 = full; 1 = no wordmark text, compact search;
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
    // Desktop sub-nav starts under the first section tab: publish the tab strip's left offset
    // (`SubNav` reads `--subnav-inset`). Re-measured with every header resize / collapse step.
    const syncSubnavInset = () => {
      const nav = el.querySelector<HTMLElement>('[data-testid="app-header-nav"]');
      if (!nav) return document.documentElement.style.removeProperty("--subnav-inset");
      document.documentElement.style.setProperty(
        "--subnav-inset",
        `${Math.round(nav.getBoundingClientRect().left - el.getBoundingClientRect().left)}px`,
      );
    };
    check();
    syncSubnavInset();
    const observer = new ResizeObserver(() => {
      check();
      syncSubnavInset();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, level, watch]);

  return { ref: setEl, level };
}
