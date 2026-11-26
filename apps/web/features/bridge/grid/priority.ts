import type { WidgetTier } from "@zibby/design-system";
import type { BridgeWidget } from "./layout";

/** Weights of the spec's score formula. A widget reports `you` plus an `urgency` it sums itself
 *  from the non-"you" terms (`blocked`, `proposal`, `error`, `budgetOver85`). */
export const PRIORITY_WEIGHT = { you: 3, blocked: 3, proposal: 3, error: 2, budgetOver85: 1 };

/** At most this many widgets are raised to `primary`. */
const MAX_PRIMARY = 2;

/** Widget types whose empty state is an inline add row or a link — they never auto-collapse. */
const KEEPS_BODY_WHEN_EMPTY: ReadonlySet<BridgeWidget["type"]> = new Set([
  "todo",
  "quickActions",
  "goals",
]);

export interface PriorityInput {
  you?: number;
  /** Weighted sum of the non-"you" score terms. */
  urgency?: number;
}

export const widgetScore = (i: PriorityInput | undefined): number =>
  PRIORITY_WEIGHT.you * (i?.you ?? 0) + (i?.urgency ?? 0);

/**
 * Tier of every widget. The score never moves a widget, it only picks its container level:
 * briefing is always `hero`; the two highest positive scores are `primary` (ties: reading order);
 * other positive scores are `standard`; an empty widget with nothing for the operator is
 * `collapsed`; the rest is `ambient`.
 *
 * `collapsed[id]` is the operator's own toggle and wins over the automatic collapse both ways:
 * `true` collapses any widget, `false` keeps an empty one open.
 */
export function widgetTiers(
  layout: readonly BridgeWidget[],
  info: Readonly<Record<string, PriorityInput | undefined>>,
  empty: Readonly<Record<string, boolean | undefined>>,
  collapsed: Readonly<Record<string, boolean | undefined>> = {},
): Record<string, WidgetTier> {
  const primary = new Set(
    layout
      .filter((w) => w.type !== "briefing" && collapsed[w.id] !== true)
      .map((w) => ({ w, score: widgetScore(info[w.id]) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.w.y - b.w.y || a.w.x - b.w.x)
      .slice(0, MAX_PRIMARY)
      .map((s) => s.w.id),
  );
  return Object.fromEntries(
    layout.map((w): [string, WidgetTier] => {
      if (w.type === "briefing") return [w.id, "hero"];
      if (collapsed[w.id] === true) return [w.id, "collapsed"];
      const score = widgetScore(info[w.id]);
      if (primary.has(w.id)) return [w.id, "primary"];
      if (score > 0) return [w.id, "standard"];
      const autoCollapse =
        !!empty[w.id] && collapsed[w.id] === undefined && !KEEPS_BODY_WHEN_EMPTY.has(w.type);
      return [w.id, autoCollapse ? "collapsed" : "ambient"];
    }),
  );
}
