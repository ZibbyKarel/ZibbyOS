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
      p.x += (width / 2 - p.x) * CENTER_PULL;
      p.y += (height / 2 - p.y) * CENTER_PULL;
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
    p.x = Math.max(MARGIN, Math.min(width - MARGIN, p.x));
    p.y = Math.max(MARGIN, Math.min(height - MARGIN, p.y));
  }
  return pos;
}

/** World (SVG viewBox) size for `n` nodes: roomier as the brain grows so nodes do not pile up. */
export function worldSize(n: number): { width: number; height: number } {
  const k = Math.max(1, Math.sqrt(n / 120));
  return { width: Math.round(1000 * k), height: Math.round(680 * k) };
}

/**
 * Lay the unified brain out in "hemispheres": each source's notes are seeded on a small circle
 * around its own anchor on a ring (the vault on the left, team KBs spreading right), the Index hub
 * in the middle, then the spring simulation relaxes them. Deterministic.
 */
export function layoutBrain(graph: BrainGraphData): {
  pos: Map<string, Pos>;
  width: number;
  height: number;
} {
  const { width, height } = worldSize(graph.nodes.length);
  const sources = [...new Set(graph.nodes.filter((n) => !n.hub).map((n) => n.sourceId))];
  const bySource = new Map<string, string[]>();
  for (const n of graph.nodes) {
    if (n.hub) continue;
    bySource.set(n.sourceId, [...(bySource.get(n.sourceId) ?? []), n.id]);
  }
  const seeds = new Map<string, { x: number; y: number }>();
  const ring = 0.22 * Math.min(width, height);
  sources.forEach((sid, s) => {
    const a = Math.PI + (s * Math.PI * 2) / sources.length;
    const cx = width / 2 + Math.cos(a) * ring;
    const cy = height / 2 + Math.sin(a) * ring;
    const ids = bySource.get(sid) ?? [];
    const r = Math.min(0.2 * Math.min(width, height), 18 * Math.sqrt(ids.length));
    ids.forEach((id, i) => {
      const t = (i / ids.length) * Math.PI * 2;
      seeds.set(id, { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    });
  });
  const positions = simulate(graph, {
    width,
    height,
    seed: (id) => seeds.get(id) ?? { x: width / 2, y: height / 2 },
  });
  return { pos: new Map(positions.map((p) => [p.id, p])), width, height };
}
