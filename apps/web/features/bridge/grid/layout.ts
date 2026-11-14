import type { BridgeWidget } from "@zibby/contracts";
import type { ResizeCorner, WidgetTier } from "@zibby/design-system";

export type { BridgeWidget };
export type WidgetType = BridgeWidget["type"];

export type WidgetTuple = readonly [WidgetType, number, number, number, number];

export interface DragOrigin {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const COLS = 12;

/** Species size range per widget type (spec §4): `[minW, minH, maxW, maxH]` in columns × rows.
 *  Applied only to NEW resizes / adds — a stored layout is never clamped at render. */
export const SIZE_LIMITS: Record<WidgetType, readonly [number, number, number, number]> = {
  briefing: [6, 2, 12, 4],
  prs: [3, 6, 12, 24],
  issues: [3, 6, 12, 24],
  runs: [3, 6, 6, 24],
  automationRuns: [3, 3, 12, 6],
  projectStatus: [2, 3, 6, 8],
  budgets: [2, 3, 6, 10],
  proposals: [3, 4, 8, 16],
  mentions: [3, 6, 8, 24],
  teamKb: [3, 6, 8, 20],
  todo: [2, 4, 6, 16],
  quickActions: [2, 2, 12, 4],
  pins: [2, 3, 6, 8],
};

export function fromArr(a: readonly WidgetTuple[]): BridgeWidget[] {
  return a.map(([type, x, y, w, h]) => ({ id: type, type, x, y, w, h }));
}

const hit = (a: BridgeWidget, b: BridgeWidget): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Priority item first, then by y, then x. Non-priority items fall to the first y free of overlap. */
export function compact(layout: readonly BridgeWidget[], priorityId?: string): BridgeWidget[] {
  const items = layout.map((i) => ({ ...i }));
  const placed: BridgeWidget[] = [];
  items
    .slice()
    .sort(
      (a, b) => (a.id === priorityId ? -1 : b.id === priorityId ? 1 : 0) || a.y - b.y || a.x - b.x,
    )
    .forEach((it) => {
      if (it.id !== priorityId) {
        let y = 0;
        while (placed.some((p) => hit({ ...it, y }, p))) y++;
        it.y = y;
      }
      placed.push(it);
    });
  return items;
}

/** Pixel delta -> whole cell delta (colW/rowH exclude the gap). */
export function toCells(
  pxDx: number,
  pxDy: number,
  colW: number,
  gap: number,
  rowH: number,
): { dx: number; dy: number } {
  return {
    dx: Math.round(pxDx / (colW + gap)),
    dy: Math.round(pxDy / (rowH + gap)),
  };
}

function withTarget(
  layout: readonly BridgeWidget[],
  id: string,
  edit: (t: BridgeWidget) => void,
): BridgeWidget[] {
  const next = layout.map((i) => ({ ...i }));
  const t = next.find((i) => i.id === id);
  if (t) edit(t);
  return compact(next, id);
}

export function dragMove(
  layout: readonly BridgeWidget[],
  id: string,
  origin: DragOrigin,
  dx: number,
  dy: number,
): BridgeWidget[] {
  return withTarget(layout, id, (t) => {
    t.x = Math.max(0, Math.min(COLS - t.w, origin.x + dx));
    t.y = Math.max(0, origin.y + dy);
  });
}

/** Resize from `corner`; the opposite edge stays anchored. Size stays inside the type's
 *  `SIZE_LIMITS` and the board (the board edge wins when both can't hold). */
export function dragResize(
  layout: readonly BridgeWidget[],
  id: string,
  origin: DragOrigin,
  dx: number,
  dy: number,
  corner: ResizeCorner = "se",
): BridgeWidget[] {
  return withTarget(layout, id, (t) => {
    const [minW, minH, maxW, maxH] = SIZE_LIMITS[t.type];
    if (corner.endsWith("w")) {
      const right = origin.x + origin.w;
      t.x = Math.max(0, right - maxW, Math.min(right - minW, origin.x + dx));
      t.w = right - t.x;
    } else {
      t.w = Math.min(maxW, COLS - origin.x, Math.max(minW, origin.w + dx));
    }
    if (corner.startsWith("n")) {
      const bottom = origin.y + origin.h;
      t.y = Math.max(0, bottom - maxH, Math.min(bottom - minH, origin.y + dy));
      t.h = bottom - t.y;
    } else {
      t.h = Math.min(maxH, Math.max(minH, origin.h + dy));
    }
  });
}

/** Smallest free id for a new widget of `type`: the type itself, else `${type}-2`, `-3`, … */
export function nextWidgetId(layout: readonly BridgeWidget[], type: WidgetType): string {
  const taken = new Set(layout.map((w) => w.id));
  if (!taken.has(type)) return type;
  let n = 2;
  while (taken.has(`${type}-${n}`)) n++;
  return `${type}-${n}`;
}

/** A new widget: 4×6 brought inside its type's `SIZE_LIMITS`, at the first free spot. */
export function addWidget(layout: readonly BridgeWidget[], type: WidgetType): BridgeWidget[] {
  const [minW, minH, maxW, maxH] = SIZE_LIMITS[type];
  const w = Math.min(maxW, Math.max(minW, 4));
  const h = Math.min(maxH, Math.max(minH, 6));
  return compact([...layout, { id: nextWidgetId(layout, type), type, x: 0, y: 999, w, h }]);
}

export function removeWidget(layout: readonly BridgeWidget[], id: string): BridgeWidget[] {
  return compact(layout.filter((i) => i.id !== id));
}

/** View mode: collapsed widgets shrink to h=1, then the board compacts. Every other widget keeps
 *  the fixed width × height the user gave it. */
export function viewLayout(
  layout: readonly BridgeWidget[],
  shrinkIds: ReadonlySet<string>,
): BridgeWidget[] {
  return compact(layout.map((it) => ({ ...it, h: shrinkIds.has(it.id) ? 1 : it.h })));
}

const TIER_RANK: Record<WidgetTier, number> = {
  hero: 0,
  primary: 1,
  standard: 2,
  ambient: 3,
  collapsed: 3,
};

/** Phone view (spec §6): one column, hero → primary → standard (`lead`), then ambient and
 *  collapsed widgets (`rest`, shown as summary rows). Desktop reading order (y, then x) within a tier. */
export function phoneOrder(
  layout: readonly BridgeWidget[],
  tiers: Readonly<Record<string, WidgetTier | undefined>>,
): { lead: BridgeWidget[]; rest: BridgeWidget[] } {
  const rank = (w: BridgeWidget) => TIER_RANK[tiers[w.id] ?? "standard"];
  const sorted = [...layout].sort((a, b) => rank(a) - rank(b) || a.y - b.y || a.x - b.x);
  return {
    lead: sorted.filter((w) => rank(w) < 3),
    rest: sorted.filter((w) => rank(w) === 3),
  };
}
