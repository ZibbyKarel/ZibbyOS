/**
 * Pure geometry for the workflow page canvas. The page editor keeps the graph a single
 * auto-laid-out chain (positions are never persisted), so a card's place is a function of its
 * index; everything here is world-space maths the canvas shell and its tests share.
 */
import type { GraphNode, ReworkEdge } from "../WorkflowDialog/workflow-graph";

export const CARD_W = 232;
export const CARD_H = 92;
export const GAP_X = 128;
export const END_W = 176;
export const END_H = 48;
export const PAD_X = 120;
/** Centre line of the chain in world space — leaves headroom above for loop arcs. */
export const ROW_CY = 280;
/** Vertical gap between the stacked branch cards of a parallel (fork) phase. */
export const BRANCH_GAP = 24;
export const FAIL_W = 116;
export const FAIL_H = 30;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 1.6;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Pt {
  x: number;
  y: number;
}
export interface View {
  x: number;
  y: number;
  zoom: number;
}

export interface Placement {
  /**
   * One rect per phase. A `parallel` phase's rect is its whole fork column (all branch cards
   * stacked, centred on ROW_CY), so ports, loop arcs and bounds treat it like any card.
   */
  cards: Map<string, Rect>;
  /** `parallel` phase id → its branch cards, top to bottom. */
  branches: Map<string, Rect[]>;
  /** The virtual delivery end node (shown when the workflow opens a PR). */
  end?: Rect;
  /** Where the last card's outgoing connector ends when there is no end node. */
  stub?: Pt;
}

export const placeChain = (nodes: readonly GraphNode[], withEnd: boolean): Placement => {
  const cards = new Map<string, Rect>();
  const branches = new Map<string, Rect[]>();
  nodes.forEach((n, i) => {
    const x = PAD_X + i * (CARD_W + GAP_X);
    const count = n.type === "parallel" ? (n.branches?.length ?? 0) : 0;
    if (count < 1) {
      cards.set(n.id, { x, y: ROW_CY - CARD_H / 2, w: CARD_W, h: CARD_H });
      return;
    }
    const h = count * CARD_H + (count - 1) * BRANCH_GAP;
    const top = ROW_CY - h / 2;
    cards.set(n.id, { x, y: top, w: CARD_W, h });
    branches.set(
      n.id,
      Array.from({ length: count }, (_, j) => ({
        x,
        y: top + j * (CARD_H + BRANCH_GAP),
        w: CARD_W,
        h: CARD_H,
      })),
    );
  });
  const last = nodes.length ? cards.get(nodes[nodes.length - 1]!.id) : undefined;
  if (!last) return { cards, branches };
  if (withEnd) {
    return {
      cards,
      branches,
      end: { x: last.x + last.w + GAP_X, y: ROW_CY - END_H / 2, w: END_W, h: END_H },
    };
  }
  return { cards, branches, stub: { x: last.x + last.w + GAP_X * 0.6, y: ROW_CY } };
};

export const rightPort = (r: Rect): Pt => ({ x: r.x + r.w, y: r.y + r.h / 2 });
export const leftPort = (r: Rect): Pt => ({ x: r.x, y: r.y + r.h / 2 });
export const topPort = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y });

export const flowPath = (a: Pt, b: Pt): string => {
  const dx = Math.max(30, (b.x - a.x) / 2);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
};

/** How high above its cards a loop arc peaks — wider spans ride higher so arcs nest. */
export const arcLift = (span: number): number => 56 + 30 * Math.max(1, span);

export interface Arc {
  path: string;
  /** Where the label pill sits (the arc's apex). */
  mid: Pt;
}

/**
 * Extra lift a loop arc needs to clear a tall fork column between (or at) its ends: how far the
 * highest card in `order[a..b]` sits above the arc's own start card. 0 for a plain chain.
 */
export const arcClearance = (
  placement: Placement,
  order: readonly GraphNode[],
  a: number,
  b: number,
): number => {
  const own = placement.cards.get(order[a]?.id ?? "")?.y;
  if (own === undefined) return 0;
  const tops = order
    .slice(Math.min(a, b), Math.max(a, b) + 1)
    .map((n) => placement.cards.get(n.id)?.y ?? own);
  return Math.max(0, own - Math.min(...tops));
};

/** A loop arc between two top ports (`to` is earlier in the chain). */
export const loopArc = (from: Pt, to: Pt, span: number, clearance = 0): Arc => {
  const k = arcLift(span) + clearance;
  return {
    path: `M${from.x},${from.y} C${from.x},${from.y - k} ${to.x},${to.y - k} ${to.x},${to.y}`,
    mid: { x: (from.x + to.x) / 2, y: from.y - k * 0.75 },
  };
};

/** The virtual "Fail run" terminal a `loop.to: "fail"` points at, above-right of its source. */
export const failTerminal = (src: Rect): Rect => ({
  x: src.x + src.w * 0.55,
  y: src.y - 118,
  w: FAIL_W,
  h: FAIL_H,
});

/** Arc from a source card's top port to the left edge of its fail terminal. */
export const failArc = (src: Rect, term: Rect): Arc => {
  const a = topPort(src);
  const b: Pt = { x: term.x, y: term.y + term.h / 2 };
  return {
    path: `M${a.x},${a.y} C${a.x},${b.y} ${b.x - 40},${b.y} ${b.x},${b.y}`,
    mid: { x: (a.x + b.x) / 2 - 8, y: (a.y + b.y) / 2 + 10 },
  };
};

/** Bounding box of everything the canvas draws (cards, end, stub, loop arcs, fail terminals). */
export const contentBounds = (
  placement: Placement,
  rework: readonly ReworkEdge[],
  nodes: readonly GraphNode[],
  order: readonly GraphNode[],
): Rect => {
  const rects: Rect[] = [...placement.cards.values()];
  if (placement.end) rects.push(placement.end);
  const idx = new Map(order.map((n, i) => [n.id, i]));
  for (const r of rework) {
    const a = placement.cards.get(r.from);
    if (!a) continue;
    const fi = idx.get(r.from) ?? 0;
    const ti = idx.get(r.to) ?? 0;
    const lift = arcLift(Math.abs(fi - ti)) + arcClearance(placement, order, fi, ti);
    rects.push({ x: a.x, y: a.y - lift * 0.8, w: a.w, h: 1 });
  }
  for (const n of nodes) {
    if (n.looseLoop?.to === "fail") {
      const a = placement.cards.get(n.id);
      if (a) rects.push(failTerminal(a));
    }
  }
  if (rects.length === 0) return { x: 0, y: ROW_CY - 120, w: 560, h: 240 };
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

export const clampZoom = (z: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/**
 * Fit `bounds` into the viewport. `minZoom` keeps cards readable: a flow too long for the
 * viewport at that scale is left-aligned (panned/scrolled) instead of shrunk.
 */
export const fitView = (bounds: Rect, vw: number, vh: number, pad = 72, minZoom = 0): View => {
  const fitted = Math.min(
    1,
    (vw - pad * 2) / Math.max(bounds.w, 1),
    (vh - pad * 2) / Math.max(bounds.h, 1),
  );
  const zoom = clampZoom(Math.max(fitted, minZoom));
  const overflowsX = bounds.w * zoom + pad * 2 > vw;
  return {
    zoom,
    x: overflowsX ? pad - bounds.x * zoom : (vw - bounds.w * zoom) / 2 - bounds.x * zoom,
    y: (vh - bounds.h * zoom) / 2 - bounds.y * zoom,
  };
};

/** Zoom keeping the world point under `anchor` (viewport coords) fixed. */
export const zoomAt = (view: View, nextZoom: number, anchor: Pt): View => {
  const zoom = clampZoom(nextZoom);
  const wx = (anchor.x - view.x) / view.zoom;
  const wy = (anchor.y - view.y) / view.zoom;
  return { zoom, x: anchor.x - wx * zoom, y: anchor.y - wy * zoom };
};

export const toWorld = (view: View, p: Pt): Pt => ({
  x: (p.x - view.x) / view.zoom,
  y: (p.y - view.y) / view.zoom,
});
export const toScreen = (view: View, p: Pt): Pt => ({
  x: view.x + p.x * view.zoom,
  y: view.y + p.y * view.zoom,
});

/** Chain index a world-space x lands on: 0 = before the first card … n = after the last. */
export const insertIndexAt = (
  placement: Placement,
  order: readonly GraphNode[],
  wx: number,
): number => {
  let i = 0;
  for (const n of order) {
    const r = placement.cards.get(n.id);
    if (r && wx > r.x + r.w / 2) i++;
  }
  return i;
};

export type Lod = "full" | "mid" | "far";
export const lodFor = (zoom: number): Lod => (zoom >= 0.7 ? "full" : zoom >= 0.45 ? "mid" : "far");
