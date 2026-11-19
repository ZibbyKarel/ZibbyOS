import { type BridgeWidget, type WidgetTuple, compact, fromArr } from "./layout";

export const DEFAULT_PRESET = "DEFAULT";
export const REVIEW_PRESET = "REVIEW";

/** Direction A (design `aDefault`): Today (7) + Indicators (5) over 12 columns; PRs 5 + Runs 4 + a span-3 column
 *  (Proposals / Project status / Automation runs); Issues 5 + a span-4 column (Mentions / Team
 *  knowledge) + a span-3 column (Budgets / TODO / Quick actions / Pinned). Heights sit inside the
 *  species min–max (spec §4, `SIZE_LIMITS`). */
const DEFAULT_TUPLES: readonly WidgetTuple[] = [
  ["briefing", 0, 0, 7, 3],
  ["indicators", 7, 0, 5, 3],
  ["prs", 0, 3, 5, 14],
  ["runs", 5, 3, 4, 14],
  ["proposals", 9, 3, 3, 6],
  ["projectStatus", 9, 9, 3, 5],
  ["automationRuns", 9, 14, 3, 3],
  ["issues", 0, 17, 5, 13],
  ["mentions", 5, 17, 4, 6],
  ["teamKb", 5, 23, 4, 7],
  ["budgets", 9, 17, 3, 8],
  ["todo", 9, 25, 3, 4],
  ["quickActions", 9, 29, 3, 2],
  ["pins", 9, 31, 3, 3],
];

/** Design `aReview`: Today + slim Indicators (2 rows), PRs 6 wide, two span-3 columns
 *  (Issues / Mentions and Runs / Proposals / Project status). */
const REVIEW_TUPLES: readonly WidgetTuple[] = [
  ["briefing", 0, 0, 6, 2],
  ["indicators", 6, 0, 6, 2],
  ["prs", 0, 2, 6, 20],
  ["issues", 6, 2, 3, 12],
  ["mentions", 6, 14, 3, 8],
  ["runs", 9, 2, 3, 10],
  ["proposals", 9, 12, 3, 4],
  ["projectStatus", 9, 16, 3, 6],
];

export const DEFAULT_LAYOUT: BridgeWidget[] = fromArr(DEFAULT_TUPLES);
export const REVIEW_LAYOUT: BridgeWidget[] = fromArr(REVIEW_TUPLES);

/**
 * Compacted layout for a preset name: DEFAULT (a saved `DEFAULT` overrides the built-in), a saved layout, the built-in REVIEW (a saved
 * `REVIEW` — written when it is edited — overrides it), else empty.
 */
export function presetLayout(
  name: string,
  saved: Readonly<Record<string, readonly BridgeWidget[]>>,
): BridgeWidget[] {
  if (name === DEFAULT_PRESET) return compact(saved.DEFAULT ?? DEFAULT_LAYOUT);
  return compact(saved[name] ?? (name === REVIEW_PRESET ? REVIEW_LAYOUT : []));
}

/** Every layout name except DEFAULT (whose edits live in `saved.DEFAULT`): the built-in REVIEW (unless removed), then saved names. */
export function layoutNames(
  saved: Readonly<Record<string, unknown>>,
  removed: readonly string[],
): string[] {
  const names = Object.keys(saved).filter((n) => n !== DEFAULT_PRESET);
  return removed.includes(REVIEW_PRESET) || names.includes(REVIEW_PRESET)
    ? names
    : [REVIEW_PRESET, ...names];
}

/** Which layouts sit in the header (`shown`, in order) and which behind its dropdown. DEFAULT is one of them. */
export interface Arrangement {
  shown: string[];
  hidden: string[];
}

/**
 * The effective arrangement of DEFAULT + `layouts`. Never arranged (`null`): DEFAULT, REVIEW and the
 * legacy favorites are shown. Otherwise stale names are dropped and names it doesn't know yet go last in hidden.
 */
export function arrangement(
  layouts: readonly string[],
  arranged: Arrangement | null,
  favorites: readonly string[],
): Arrangement {
  const names = [DEFAULT_PRESET, ...layouts];
  if (!arranged) {
    const shown = names.filter(
      (n) => n === DEFAULT_PRESET || n === REVIEW_PRESET || favorites.includes(n),
    );
    return { shown, hidden: names.filter((n) => !shown.includes(n)) };
  }
  const shown = arranged.shown.filter((n) => names.includes(n));
  const hidden = arranged.hidden.filter((n) => names.includes(n) && !shown.includes(n));
  // A persisted arrangement from before DEFAULT was movable has no DEFAULT: it leads the header.
  if (!shown.includes(DEFAULT_PRESET) && !hidden.includes(DEFAULT_PRESET))
    shown.unshift(DEFAULT_PRESET);
  const rest = names.filter((n) => !shown.includes(n) && !hidden.includes(n));
  return { shown, hidden: [...hidden, ...rest] };
}

/** First free `MY LAYOUT NN` (two digits). */
export function nextSavedName(saved: Readonly<Record<string, unknown>>): string {
  for (let n = 1; ; n++) {
    const name = `MY LAYOUT ${String(n).padStart(2, "0")}`;
    if (!(name in saved)) return name;
  }
}

const RESERVED = ["DEFAULT", "REVIEW", "CUSTOM"];

/** Why a layout name can't be saved (checked on the trimmed name), or null if it can. */
export function layoutNameError(
  name: string,
  saved: Readonly<Record<string, unknown>>,
): "required" | "tooLong" | "reserved" | "taken" | null {
  const n = name.trim().toUpperCase();
  if (!n) return "required";
  if (n.length > 40) return "tooLong";
  if (RESERVED.includes(n)) return "reserved";
  if (Object.keys(saved).some((k) => k.toUpperCase() === n)) return "taken";
  return null;
}
