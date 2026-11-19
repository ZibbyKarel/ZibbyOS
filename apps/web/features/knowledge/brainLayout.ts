import type { BrainGraphData } from "./brainModel";

export interface LayoutGraph {
  nodes: { id: string }[];
  edges: { from: string; to: string }[];
}

export interface Pos {
  id: string;
  x: number;
  y: number;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  /** Seed position of the i-th node; defaults to a circle. Must be deterministic. */
  seed?: (id: string, i: number, n: number) => { x: number; y: number };
  /** Strength of the pull towards the target (default 0.01). */
  pullStrength?: number;
  /** Per-node pull target (default: the canvas centre). */
  pull?: (id: string) => { x: number; y: number } | undefined;
  /** Nodes that never move (the Index hub, the bridges). */
  fixed?: ReadonlySet<string>;
  /** Replaces the canvas clamp (e.g. keep a node inside its zone ellipse). */
  clamp?: (p: Pos) => void;
}

export const DEFAULT_WIDTH = 560;
export const DEFAULT_HEIGHT = 420;
/** Spring rest length and (per-endpoint) stiffness; the centre-pull strength. */
const REST_LENGTH = 90;
const SPRING = 0.04;
const CENTER_PULL = 0.01;
/** Cap repulsion so two near-coincident nodes can't fling each other off-canvas. */
const MAX_REPULSION = 40;
const MARGIN = 24;

/**
 * Tiny spring/charge simulation, deterministic for a given graph (no `Math.random`). Both forces
 * are normalized to a unit direction before being scaled — the spring displacement is
 * `(dist - rest) * stiffness` *along the unit vector*, not along the raw `(dx, dy)`, so a long
 * edge can't overshoot past the far node and oscillate to infinity. Positions are clamped to the
 * canvas and any non-finite coordinate falls back to its seed.
 * ponytail: O(n² · steps) — steps drop above 700 nodes; the real fix is the deferred
 * worker + cluster mode (A-ZN-04/20).
 */
export function simulate(graph: LayoutGraph, opts: LayoutOptions = {}): Pos[] {
  const n = graph.nodes.length;
  if (n === 0) return [];
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const seed =
    opts.seed ??
    ((_id: string, i: number, count: number) => ({
      x: width / 2 + Math.cos((i / count) * Math.PI * 2) * 140,
      y: height / 2 + Math.sin((i / count) * Math.PI * 2) * 140,
    }));
  const pos: Pos[] = graph.nodes.map((node, i) => ({ id: node.id, ...seed(node.id, i, n) }));
  const idx = new Map(pos.map((p, i) => [p.id, i]));
  const steps = n > 700 ? 60 : 220;

  for (let step = 0; step < steps; step++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos[i];
        const b = pos[j];
        if (!a || !b) continue;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const force = Math.min(2200 / (dist * dist), MAX_REPULSION);
        dx /= dist;
        dy /= dist;
        a.x += dx * force;
        a.y += dy * force;
        b.x -= dx * force;
        b.y -= dy * force;
      }
    }
    for (const e of graph.edges) {
      const ai = idx.get(e.from);
      const bi = idx.get(e.to);
      if (ai === undefined || bi === undefined) continue;
      const a = pos[ai];
      const b = pos[bi];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const disp = (dist - REST_LENGTH) * SPRING;
      const ux = dx / dist;
      const uy = dy / dist;
      a.x += ux * disp;
      a.y += uy * disp;
      b.x -= ux * disp;
      b.y -= uy * disp;
    }
    for (const p of pos) {
      const c = opts.pull?.(p.id) ?? { x: width / 2, y: height / 2 };
      const pull = opts.pullStrength ?? CENTER_PULL;
      p.x += (c.x - p.x) * pull;
      p.y += (c.y - p.y) * pull;
    }
    if (opts.fixed || opts.clamp)
      for (const p of pos) {
        if (opts.fixed?.has(p.id)) {
          const s0 = seed(p.id, idx.get(p.id) ?? 0, n);
          p.x = s0.x;
          p.y = s0.y;
        } else opts.clamp?.(p);
      }
  }
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i];
    if (!p) continue;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      const s = seed(p.id, i, n);
      p.x = s.x;
      p.y = s.y;
    }
    if (!opts.clamp) {
      p.x = Math.max(MARGIN, Math.min(width - MARGIN, p.x));
      p.y = Math.max(MARGIN, Math.min(height - MARGIN, p.y));
    }
  }
  return pos;
}

/** One halo of the zoned brain: the vault (left), the team KBs (right) or the bridge strip (centre). */
export interface BrainZone {
  kind: "vault" | "kb" | "bridge";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface BrainLayout {
  pos: Map<string, Pos>;
  zones: BrainZone[];
  /** Bounding box of every placed node (world units, origin = the Index hub). */
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

/** Phyllotaxis point `i` of `n` inside a disc of radius `r` — an even, deterministic fill. */
const disc = (i: number, n: number, r: number) => {
  const a = i * 2.399963;
  const d = r * Math.sqrt((i + 0.5) / n);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
};

/**
 * Lay the unified brain out as three zones around the Index hub at the origin: the vault ellipse
 * on the left, the team-KB ellipse on the right (several KBs share it as sub-clusters), and the
 * bridge strip in the middle ("Most · <KB>" nodes). Notes are seeded per cluster (vault: department
 * shelf, else tier; KB: source), pulled to their cluster and clamped inside their zone, then relaxed
 * by the spring simulation. Deterministic.
 */
export function layoutBrain(graph: BrainGraphData): BrainLayout {
  const notes = graph.nodes.filter((n) => !n.hub);
  const k = Math.max(1, Math.sqrt(notes.length / 260));
  const vz: BrainZone = { kind: "vault", cx: -315 * k, cy: 15, rx: 335 * k, ry: 290 * k };
  const kz: BrainZone = { kind: "kb", cx: 315 * k, cy: 30, rx: 335 * k, ry: 290 * k };
  const bridges = graph.nodes.filter((n) => n.bridgeOf);
  const zones: BrainZone[] = [vz, kz];
  if (bridges.length > 0) zones.push({ kind: "bridge", cx: 0, cy: 0, rx: 90, ry: 160 });

  // clusters: key → members, and the cluster centre inside its zone
  const clusters = new Map<string, { zone: BrainZone; ids: string[] }>();
  const keyOf = (n: BrainGraphData["nodes"][number]) =>
    n.sourceId === "vault" ? `v:${n.department ?? n.tier ?? "-"}` : `k:${n.sourceId}`;
  for (const n of notes) {
    const key = keyOf(n);
    const c = clusters.get(key) ?? { zone: n.sourceId === "vault" ? vz : kz, ids: [] };
    c.ids.push(n.id);
    clusters.set(key, c);
  }
  const centreOf = new Map<string, { x: number; y: number }>();
  const seeds = new Map<string, { x: number; y: number }>();
  for (const zone of [vz, kz]) {
    const keys = [...clusters.entries()].filter(([, c]) => c.zone === zone).map(([key]) => key);
    keys.forEach((key, gi) => {
      const m = keys.length;
      const a = -Math.PI / 2 + (gi / Math.max(1, m)) * Math.PI * 2 + (zone === kz ? 0.6 : 0);
      const ring = m === 1 ? 0 : 0.5;
      const c = {
        x: zone.cx + Math.cos(a) * zone.rx * ring,
        y: zone.cy + Math.sin(a) * zone.ry * ring,
      };
      const ids = clusters.get(key)?.ids ?? [];
      centreOf.set(key, c);
      const r = Math.min(zone.ry * 0.62, 16 * Math.sqrt(ids.length) + 20);
      ids.forEach((id, i) => {
        const d = disc(i, ids.length, r);
        seeds.set(id, { x: c.x + d.x, y: c.y + d.y });
      });
    });
  }
  const keyById = new Map(notes.map((n) => [n.id, keyOf(n)]));
  const zoneById = new Map(notes.map((n) => [n.id, n.sourceId === "vault" ? vz : kz]));
  const fixed = new Set<string>();
  graph.nodes.forEach((n) => {
    if (!n.hub) return;
    fixed.add(n.id);
    const bi = bridges.findIndex((b) => b.id === n.id);
    seeds.set(
      n.id,
      bi < 0
        ? { x: 0, y: 0 }
        : { x: 0, y: bridges.length === 1 ? -100 : -100 + bi * (200 / (bridges.length - 1)) },
    );
  });

  const positions = simulate(graph, {
    width: 1,
    height: 1,
    seed: (id) => seeds.get(id) ?? { x: 0, y: 0 },
    pullStrength: 0.035,
    pull: (id) => centreOf.get(keyById.get(id) ?? ""),
    fixed,
    clamp: (p) => {
      const z = zoneById.get(p.id);
      if (!z) return;
      const dx = (p.x - z.cx) / (z.rx * 0.94);
      const dy = (p.y - z.cy) / (z.ry * 0.94);
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        p.x = z.cx + (dx / d) * z.rx * 0.94;
        p.y = z.cy + (dy / d) * z.ry * 0.94;
      }
    },
  });
  const pos = new Map(positions.map((p) => [p.id, p]));
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const bounds = {
    x0: Math.min(0, ...xs),
    y0: Math.min(0, ...ys),
    x1: Math.max(0, ...xs),
    y1: Math.max(0, ...ys),
  };
  return { pos, zones, bounds };
}
