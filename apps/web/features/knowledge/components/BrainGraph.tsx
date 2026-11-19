"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Button,
  Chip,
  Container,
  Panel,
  SegmentedControl,
  Stack,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type BrainGraphData, type BrainNode, isStructural } from "../brainModel";
import { layoutBrain } from "../brainLayout";
import { cursorPush, easeCam, selectionCam } from "../brainMotion";
import { BrainMinimap } from "./BrainMinimap";
import { SourceShape } from "./SourceShape";

export enum BrainGraphTestId {
  Root = "brain-graph",
  Svg = "brain-graph-svg",
  /** Suffixed with the unified note id. */
  Node = "brain-graph-node",
  ZoomIn = "brain-graph-zoom-in",
  ZoomOut = "brain-graph-zoom-out",
  Fit = "brain-graph-fit",
  Tooltip = "brain-graph-tooltip",
  Legend = "brain-graph-legend",
  Toolbar = "brain-graph-toolbar",
  Minimap = "brain-graph-minimap",
  MinimapToggle = "brain-graph-minimap-toggle",
  PhysicsToggle = "brain-graph-physics-toggle",
  /** Suffixed with the zone kind (vault / kb / bridge). */
  ZoneLabel = "brain-graph-zone",
}

export interface BrainGraphProps {
  graph: BrainGraphData;
  /** CSS colour (a token reference) per source id. */
  sourceColor: (sourceId: string) => string;
  /** Display name per source id (tooltip + zone labels). */
  sourceName: (sourceId: string) => string;
  selectedId: string | null;
  /** Search hits: matching notes get a ring, the rest fade. null = no search. */
  matchIds: ReadonlySet<string> | null;
  onSelect: (id: string) => void;
  /** A click on empty canvas (not a node, not a drag) — drops the selection. */
  onDeselect?: () => void;
}

export interface Cam {
  /** World point at the centre of the canvas. */
  x: number;
  y: number;
  k: number;
}
export type LabelMode = "auto" | "all" | "off";

const MIN_K = 0.25;
const MAX_K = 4;
const FALLBACK = { w: 800, h: 520 };
/** A "map of content" hub: at least this many links, and at most this share of the notes. */
const MOC_MIN_DEGREE = 6;
const MOC_SHARE = 0.05;

/** Mockup hover timings: highlight after this dwell, tooltip after the second. */
const HL_DWELL = 480;
const TIP_DWELL = 320;

interface HoverInfo {
  node: BrainNode;
  px: number;
  py: number;
  maxLeft: number;
}
interface Anim {
  hl: number;
  hs: number;
  tip: number;
  hid: string | null;
  lastHover: HoverInfo | null;
  off: ReadonlyMap<string, { x: number; y: number }>;
}
interface Motion {
  off: Map<string, { x: number; y: number }>;
  hl: number;
  hs: number;
  tip: number;
  hoverAt: number;
  hid: string | null;
  lastHover: HoverInfo | null;
  cursor: { x: number; y: number } | null;
  camT: Cam | null;
}
const IDLE: Anim = { hl: 0, hs: 0, tip: 0, hid: null, lastHover: null, off: new Map() };

const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));
/** Stable 0.35–1 depth per id: fades some leaf nodes so the cloud reads as layered. */
const depthOf = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 0.35 + ((h % 1000) / 1000) * 0.65;
};
const truncate = (s: string) => (s.length > 34 ? `${s.slice(0, 32)}…` : s);

/**
 * The brain canvas: one SVG with the whole unified brain laid out in zones — the vault on the
 * left, the team KBs on the right, the Index and its "Most · <KB>" bridges in the middle — each
 * with a soft halo and a mono zone label. Leaf notes are small and unlabelled; maps of content
 * (the best-connected notes) are bigger and labelled. Pan by dragging, zoom with the wheel or the
 * toolbar, "Popisky" picks the label density, the minimap shows where the view sits. The tree
 * beside it is the keyboard twin, so nodes are only tab stops in small graphs.
 */
export function BrainGraph({
  graph,
  sourceColor,
  sourceName,
  selectedId,
  matchIds,
  onSelect,
  onDeselect,
}: BrainGraphProps) {
  const t = useTranslations("knowledge.brain.graph");
  const haloId = useId();
  const svg = useRef<SVGSVGElement>(null);
  const pan = useRef<{ x: number; y: number; cam: Cam } | null>(null);
  /** Set once a pointer-down drags past the click slop, so the click that follows is not a deselect. */
  const dragged = useRef(false);
  const [size, setSize] = useState(FALLBACK);
  const [override, setOverride] = useState<Cam | null>(null);
  const [labels, setLabels] = useState<LabelMode>("auto");
  const [minimap, setMinimap] = useState(true);
  const [drift, setDrift] = useState(true);
  const [tick, setTick] = useState(0);
  /** Eased motion state, republished by the rAF loop: hover highlight/tooltip fades, node offsets. */
  const [anim, setAnim] = useState<Anim>(IDLE);
  const motion = useRef<Motion>({
    off: new Map(),
    hl: 0,
    hs: 0,
    tip: 0,
    hoverAt: 0,
    hid: null,
    lastHover: null,
    cursor: null,
    camT: null,
  });
  const [hover, setHover] = useState<{
    node: BrainNode;
    px: number;
    py: number;
    maxLeft: number;
  } | null>(null);

  const layout = useMemo(() => layoutBrain(graph), [graph]);
  const notes = useMemo(() => graph.nodes.filter((n) => !n.hub), [graph.nodes]);

  const degrees = useMemo(() => {
    const d = new Map<string, { out: number; in: number }>();
    for (const e of graph.edges) {
      if (isStructural(e.from) || isStructural(e.to)) continue;
      d.set(e.from, { out: (d.get(e.from)?.out ?? 0) + 1, in: d.get(e.from)?.in ?? 0 });
      d.set(e.to, { out: d.get(e.to)?.out ?? 0, in: (d.get(e.to)?.in ?? 0) + 1 });
    }
    return d;
  }, [graph.edges]);
  const deg = (id: string) => (degrees.get(id)?.out ?? 0) + (degrees.get(id)?.in ?? 0);

  /** Maps of content: the best-connected few notes of the brain. */
  const mocs = useMemo(() => {
    const cap = Math.max(1, Math.ceil(notes.length * MOC_SHARE));
    return new Set(
      notes
        .map((n) => [n.id, deg(n.id)] as const)
        .filter(([, d]) => d >= MOC_MIN_DEGREE)
        .sort((a, b) => b[1] - a[1])
        .slice(0, cap)
        .map(([id]) => id),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, degrees]);

  const fitCam = useMemo<Cam>(() => {
    const { x0, y0, x1, y1 } = layout.bounds;
    const k = Math.min(
      2.2,
      Math.max(MIN_K, Math.min(size.w / (x1 - x0 + 110), size.h / (y1 - y0 + 150))),
    );
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 - 8, k };
  }, [layout.bounds, size]);
  const cam = override ?? fitCam;

  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // React's onWheel is passive and cannot stop the page from scrolling, so attach natively.
  const camRef = useRef(cam);
  const sizeRef = useRef(size);
  const hoverRef = useRef<typeof hover>(null);
  useEffect(() => {
    camRef.current = cam;
    sizeRef.current = size;
    hoverRef.current = hover;
    if (hover) motion.current.lastHover = hover;
  });
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const c = camRef.current;
      const sx = e.clientX - r.left - r.width / 2;
      const sy = e.clientY - r.top - r.height / 2;
      const k = clampK(c.k * Math.exp(-e.deltaY * 0.0015));
      motion.current.camT = null;
      setOverride({ k, x: c.x + sx / c.k - sx / k, y: c.y + sy / c.k - sy / k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Idle drift: a slow shared current moves every node a few pixels (off for reduced motion).
  const still =
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motionOn = drift && !still && notes.length <= 600;
  const posRef = useRef(layout.pos);
  useEffect(() => {
    posRef.current = layout.pos;
  });

  // A different set of notes (a filter, a source loading) re-fits the view to what is there.
  const noteCount = graph.nodes.length;
  const [seenCount, setSeenCount] = useState(noteCount);
  if (noteCount !== seenCount) {
    setSeenCount(noteCount);
    setOverride(null);
  }

  // Selecting a note keeps the zoom and eases the camera so the note comes to the centre.
  useEffect(() => {
    if (!selectedId) return;
    const p = posRef.current.get(selectedId);
    if (!p) return;
    const target = selectionCam(camRef.current, p);
    if (still) setOverride(target);
    else motion.current.camT = target;
  }, [selectedId, still]);

  // One rAF loop: camera pan, cursor repulsion, hover highlight / tooltip fades, idle drift tick.
  useEffect(() => {
    if (still) return;
    let raf = 0;
    let prev = performance.now();
    let lastPub = 0;
    const loop = (now: number) => {
      const m = motion.current;
      const dt = Math.min(64, now - prev);
      prev = now;
      let busy = false;

      if (m.camT) {
        const r = easeCam(camRef.current, m.camT, dt);
        camRef.current = r.cam;
        setOverride(r.cam);
        if (r.done) m.camT = null;
      }

      const h = hoverRef.current;
      if (!h) m.hoverAt = 0;
      else if (m.hoverAt === 0 || h.node.id !== m.hid) {
        m.hid = h.node.id;
        m.hoverAt = now;
      }
      const dwell = h ? now - m.hoverAt : 0;
      const ease = (v: number, target: number, rate: number) => {
        const n = v + (target - v) * Math.min(1, dt * rate);
        return Math.abs(target - n) < 0.004 ? target : n;
      };
      // mockup timings: highlight after a 480 ms dwell (fade .0045/ms in, .009/ms out),
      // tooltip after 320 ms, hovered node grows at once.
      const hl = ease(m.hl, h && dwell > HL_DWELL ? 1 : 0, h ? 0.0045 : 0.009);
      const hs = ease(m.hs, h ? 1 : 0, 0.012);
      const tip = ease(m.tip, h && dwell > TIP_DWELL ? 1 : 0, 0.012);
      busy = hl !== m.hl || hs !== m.hs || tip !== m.tip;
      m.hl = hl;
      m.hs = hs;
      m.tip = tip;

      let off = m.off;
      if (motionOn) {
        // Cursor repulsion (or parting around a hovered node): eased offsets, rest positions in.
        const c = m.cursor;
        const cam = camRef.current;
        const sz = sizeRef.current;
        const centre = h
          ? posRef.current.get(h.node.id)
          : c
            ? { x: (c.x - sz.w / 2) / cam.k + cam.x, y: (c.y - sz.h / 2) / cam.k + cam.y }
            : undefined;
        const next = new Map<string, { x: number; y: number }>();
        const a = Math.min(1, dt * 0.0075);
        for (const [id, p] of posRef.current) {
          const cur = off.get(id) ?? { x: 0, y: 0 };
          let tx = 0;
          let ty = 0;
          if (centre && id !== h?.node.id) {
            const push = cursorPush((p.x - centre.x) * cam.k, (p.y - centre.y) * cam.k);
            tx = push.x / cam.k;
            ty = push.y / cam.k;
          }
          const nx = cur.x + (tx - cur.x) * a;
          const ny = cur.y + (ty - cur.y) * a;
          if (Math.abs(nx) > 0.01 || Math.abs(ny) > 0.01) next.set(id, { x: nx, y: ny });
        }
        off = next;
        m.off = next;
      } else if (m.off.size) {
        off = new Map();
        m.off = off;
        busy = true;
      }

      if ((motionOn || busy) && now - lastPub > 33) {
        lastPub = now;
        setTick(now);
        setAnim({ hl, hs, tip, hid: m.hid, lastHover: m.lastHover, off });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [still, motionOn]);

  // Hover emphasis fades in/out; while it fades out the last hovered node stays the subject.
  const fading = !hover && anim.hl > 0.02 && anim.hid !== null;
  const live = hover?.node.id ?? (fading ? anim.hid : selectedId);
  const emph = hover || fading ? (still ? 1 : anim.hl) : 1;
  const tipHover = hover ?? (still ? null : anim.lastHover);
  const tipA = still ? (hover ? 1 : 0) : hover || fading || anim.tip > 0 ? anim.tip : 0;
  const grow = hover || fading ? (still ? 1 : anim.hs) : 0;
  const near = useMemo(() => {
    const s = new Set<string>();
    if (!live) return s;
    for (const e of graph.edges) {
      if (e.from === live) s.add(e.to);
      if (e.to === live) s.add(e.from);
    }
    return s;
  }, [graph.edges, live]);

  const tabbable = graph.nodes.length <= 150;
  const hasOpen = graph.nodes.some((n) => n.open);
  const kbNames = [
    ...new Set(notes.filter((n) => n.sourceId !== "vault").map((n) => n.sourceId)),
  ].map((id) => sourceName(id).toUpperCase());
  const hasVault = notes.some((n) => n.sourceId === "vault");

  // world → rest position, plus the idle drift offset (a shared current + a lazy wobble per node)
  const at = (id: string) => {
    const p = layout.pos.get(id);
    if (!p) return null;
    const o = anim.off.get(id);
    if (!drift || still || (isStructural(id) && id === "index") || tick === 0)
      return { x: p.x + (o?.x ?? 0), y: p.y + (o?.y ?? 0) };
    const d = 0.45 + 0.55 * depthOf(id);
    const cx =
      Math.sin(p.y * 0.013 + tick * 0.00034) +
      0.65 * Math.sin((p.x + p.y) * 0.0075 - tick * 0.00021);
    const cy =
      Math.cos(p.x * 0.012 - tick * 0.00029) +
      0.65 * Math.cos((p.x - p.y) * 0.0082 + tick * 0.00025);
    return { x: p.x + cx * 5.2 * d + (o?.x ?? 0), y: p.y + cy * 5.2 * d + (o?.y ?? 0) };
  };
  const toScr = (p: { x: number; y: number }) => ({
    x: (p.x - cam.x) * cam.k + size.w / 2,
    y: (p.y - cam.y) * cam.k + size.h / 2,
  });
  const radius = (n: BrainNode) => {
    if (n.id === "index") return 11;
    if (n.bridgeOf) return 6.5;
    const d = deg(n.id);
    const r = mocs.has(n.id)
      ? 5.5 + Math.min(d, 50) * 0.1
      : (2 + Math.sqrt(d) * 0.8) * (0.8 + 0.2 * depthOf(n.id));
    return Math.max(r, 1.7 / cam.k);
  };
  const curved = (a: BrainNode | undefined, b: BrainNode | undefined) =>
    !!a && !!b && !a.hub && !b.hub && a.sourceId !== b.sourceId;
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const hue = (n: BrainNode) => (n.hub ? "var(--color-ink)" : sourceColor(n.sourceId));

  const zoomBy = (f: number) => {
    motion.current.camT = null;
    setOverride({ ...cam, k: clampK(cam.k * f) });
  };
  const dim = matchIds !== null;

  // ---- screen-space labels (collision-checked, highest priority first) ----
  const labelsOut = (() => {
    const cand: { n: BrainNode; pr: number }[] = [];
    for (const n of graph.nodes) {
      let pr = -1;
      if (n.id === live && hover?.node.id === n.id) pr = 0;
      else if (n.id === selectedId) pr = 1;
      else if (hover && near.has(n.id)) pr = 3;
      else if (matchIds?.has(n.id)) pr = 4;
      else if (labels !== "off" && (n.id === "index" || n.bridgeOf)) pr = 4.5;
      else if (labels !== "off" && mocs.has(n.id) && cam.k > 0.42) pr = 5;
      else if (labels === "all" && cam.k > 0.8) pr = 6;
      if (pr >= 0) cand.push({ n, pr });
    }
    cand.sort((a, b) => a.pr - b.pr || deg(b.n.id) - deg(a.n.id));
    const placed: number[][] = [];
    const out: { n: BrainNode; pr: number; lx: number; ly: number; w: number }[] = [];
    for (const { n, pr } of cand.slice(0, 140)) {
      const p = at(n.id);
      if (!p) continue;
      const s = toScr(p);
      if (s.x < -60 || s.x > size.w + 20 || s.y < -20 || s.y > size.h + 20) continue;
      const w = truncate(n.label).length * 5.9 + 10;
      const lx = s.x + radius(n) * cam.k + 6 + 10 * Math.min(cam.k, 1.6);
      const ly = s.y - 9;
      const clash = placed.some(
        (q) => lx < q[0]! + q[2]! && lx + w > q[0]! && ly < q[1]! + 18 && ly + 18 > q[1]!,
      );
      if (clash && pr > 1) continue;
      placed.push([lx, ly, w]);
      out.push({ n, pr, lx, ly, w });
    }
    return out;
  })();

  const halo = (
    zone: { cx: number; cy: number; rx: number; ry: number },
    c: string,
    id: string,
  ) => (
    <circle
      cx={zone.cx}
      cy={zone.cy}
      fill={`url(#${haloId}-${id})`}
      key={id}
      r={Math.max(zone.rx, zone.ry) * 1.16}
    />
  );
  const zoneLabel = (kind: "vault" | "kb" | "bridge") => {
    const z = layout.zones.find((x) => x.kind === kind);
    if (!z || (kind === "vault" && !hasVault) || (kind === "kb" && kbNames.length === 0))
      return null;
    const wx = kind === "bridge" ? 0 : z.cx;
    const wy = kind === "bridge" ? -310 : z.cy - z.ry - 10;
    const s = toScr({ x: wx, y: wy });
    if (s.y < 50 || s.y > size.h - 10) return null;
    const text =
      kind === "vault"
        ? `${t("zoneVault")} · ${sourceName("vault").toUpperCase()}`
        : kind === "kb"
          ? `${t("zoneKb")} · ${kbNames.join(" · ")}`
          : t("zoneBridge");
    return (
      <text
        data-testid={`${BrainGraphTestId.ZoneLabel}-${kind}`}
        fill={
          kind === "vault"
            ? "var(--color-state-work)"
            : kind === "kb"
              ? "var(--color-state-done)"
              : "var(--color-ink-2)"
        }
        fontFamily="var(--font-mono, ui-monospace, monospace)"
        fontSize={10.5}
        fontWeight={500}
        key={kind}
        letterSpacing={0.6}
        opacity={0.85}
        textAnchor="middle"
        x={s.x}
        y={s.y}
      >
        {text}
      </text>
    );
  };

  const vz = layout.zones.find((z) => z.kind === "vault");
  const kz = layout.zones.find((z) => z.kind === "kb");

  return (
    <Container data-testid={BrainGraphTestId.Root} height="100%" position="relative" width="100%">
      <svg
        aria-label={t("label")}
        data-testid={BrainGraphTestId.Svg}
        height="100%"
        onClick={() => {
          if (!dragged.current) onDeselect?.();
        }}
        onPointerCancel={() => (pan.current = null)}
        onPointerDown={(e) => {
          motion.current.camT = null;
          dragged.current = false;
          pan.current = { x: e.clientX, y: e.clientY, cam };
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerLeave={() => (motion.current.cursor = null)}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          motion.current.cursor = { x: e.clientX - box.left, y: e.clientY - box.top };
          const p = pan.current;
          if (!p) return;
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) dragged.current = true;
          motion.current.camT = null;
          motion.current.cursor = null;
          setOverride({
            k: p.cam.k,
            x: p.cam.x - (e.clientX - p.x) / p.cam.k,
            y: p.cam.y - (e.clientY - p.y) / p.cam.k,
          });
        }}
        onPointerUp={() => (pan.current = null)}
        ref={svg}
        role="group"
        viewBox={`0 0 ${size.w} ${size.h}`}
        width="100%"
      >
        <defs>
          {[
            ["vault", "var(--color-state-work)", 0.1],
            ["kb", "var(--color-state-done)", 0.09],
          ].map(([id, c, o]) => (
            <radialGradient id={`${haloId}-${id}`} key={String(id)}>
              <stop offset="0%" stopColor={String(c)} stopOpacity={Number(o)} />
              <stop offset="100%" stopColor={String(c)} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>
        <g
          transform={`translate(${size.w / 2} ${size.h / 2}) scale(${cam.k}) translate(${-cam.x} ${-cam.y})`}
        >
          {vz && halo(vz, "var(--color-state-work)", "vault")}
          {kz && halo(kz, "var(--color-state-done)", "kb")}
          {[vz, kz].map(
            (z) =>
              z && (
                <ellipse
                  cx={z.cx}
                  cy={z.cy}
                  fill="none"
                  key={z.kind}
                  rx={z.rx}
                  ry={z.ry}
                  stroke="var(--color-ink)"
                  strokeDasharray="2 6"
                  strokeOpacity={0.1}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ),
          )}
          {graph.edges.map((e, i) => {
            const a = at(e.from);
            const b = at(e.to);
            if (!a || !b) return null;
            const lit = live !== null && (e.from === live || e.to === live);
            const edgeBase = dim ? 0.05 : 0.14;
            const tone = lit
              ? hue(byId.get(live) ?? ({ sourceId: "vault" } as BrainNode))
              : "var(--color-ink-2)";
            const common = {
              fill: "none",
              opacity: lit
                ? edgeBase + (0.8 - edgeBase) * emph
                : live
                  ? edgeBase + (0.07 - edgeBase) * emph
                  : edgeBase,
              stroke: tone,
              strokeWidth: lit ? 1.4 : 1,
              vectorEffect: "non-scaling-stroke" as const,
            };
            const key = `${e.from}>${e.to}>${i}`;
            return curved(byId.get(e.from), byId.get(e.to)) ? (
              <path
                d={`M${a.x} ${a.y} Q${(a.x + b.x) * 0.12} ${(a.y + b.y) * 0.28} ${b.x} ${b.y}`}
                key={key}
                {...common}
              />
            ) : (
              <line key={key} x1={a.x} x2={b.x} y1={a.y} y2={b.y} {...common} />
            );
          })}
          {graph.nodes.map((n) => {
            const p = at(n.id);
            if (!p) return null;
            const selected = n.id === selectedId;
            const hit = matchIds?.has(n.id) ?? false;
            const faded = dim && !hit && !n.hub;
            const hovered = live === n.id && (hover?.node.id === n.id || fading);
            const r = radius(n) * (hovered ? 1 + 0.28 * grow : 1);
            const c = hue(n);
            const neigh = live !== null && (n.id === live || near.has(n.id));
            const baseOp = faded ? 0.14 : n.hub ? 1 : 0.5 + 0.5 * depthOf(n.id);
            const op = faded ? 0.14 : live && !neigh ? baseOp + (0.3 - baseOp) * emph : baseOp;
            const kb = !n.hub && n.sourceId !== "vault";
            const pad = 5 / Math.max(cam.k, 0.7);
            return (
              <g
                aria-label={n.label}
                cursor={n.hub ? "default" : "pointer"}
                data-testid={`${BrainGraphTestId.Node}-${n.id}`}
                key={n.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!n.hub) onSelect(n.id);
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !n.hub) onSelect(n.id);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerEnter={(e) => {
                  const box = svg.current?.getBoundingClientRect();
                  setHover({
                    node: n,
                    px: e.clientX - (box?.left ?? 0),
                    py: e.clientY - (box?.top ?? 0),
                    maxLeft: Math.max(0, (box?.width ?? 600) - 300),
                  });
                }}
                onPointerLeave={() => setHover(null)}
                role="button"
                tabIndex={tabbable && !n.hub ? 0 : -1}
              >
                <circle cx={p.x} cy={p.y} fill="transparent" r={r + pad} />
                {n.hub && <circle cx={p.x} cy={p.y} fill={c} opacity={0.14 * op} r={r * 2.6} />}
                {hovered && <circle cx={p.x} cy={p.y} fill={c} opacity={0.25 * grow} r={r * 2.4} />}
                {n.raw && !n.hub ? (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    fill={c}
                    fillOpacity={0.14}
                    opacity={op}
                    r={r + 0.6}
                    stroke={c}
                    strokeDasharray="2 2"
                    strokeWidth={1.3}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : kb ? (
                  <rect
                    fill={c}
                    height={r * 1.84}
                    opacity={op}
                    rx={r * 0.46}
                    width={r * 1.84}
                    x={p.x - r * 0.92}
                    y={p.y - r * 0.92}
                  />
                ) : (
                  <circle cx={p.x} cy={p.y} fill={c} opacity={op} r={r} />
                )}
                {n.hub && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    fill="none"
                    opacity={0.55 * op}
                    r={r + 3}
                    stroke={c}
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {n.id === "index" && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    fill="none"
                    opacity={0.3}
                    r={r + 8}
                    stroke={c}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {n.open && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    fill="none"
                    r={r + 3.4}
                    stroke="var(--color-warn)"
                    strokeWidth={1.7}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {(selected || hit) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    fill="none"
                    r={r + pad}
                    stroke="var(--color-ink)"
                    strokeWidth={selected ? 2 : 1.4}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}
        </g>

        <g pointerEvents="none">
          {(["vault", "kb", "bridge"] as const).map(zoneLabel)}
          {labelsOut.map(({ n, pr, lx, ly, w }) => (
            <g key={n.id}>
              <rect
                fill="var(--color-bg)"
                fillOpacity={pr <= 1 ? 0.93 : 0.74}
                height={18}
                rx={5}
                stroke={pr <= 1 ? hue(n) : "none"}
                strokeOpacity={0.5}
                width={w}
                x={lx}
                y={ly}
              />
              <text
                fill={pr <= 3 || n.id === "index" ? "var(--color-ink)" : "var(--color-ink-2)"}
                fontSize={n.hub || pr <= 1 ? 11.5 : 11}
                fontWeight={n.hub || pr <= 1 ? 500 : 400}
                x={lx + 5}
                y={ly + 12.8}
              >
                {truncate(n.label)}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {tipHover && tipA > 0.01 && !tipHover.node.hub && (
        <Container
          data-testid={BrainGraphTestId.Tooltip}
          left={`${Math.min(tipHover.px + 14, tipHover.maxLeft)}px`}
          pointerEvents="none"
          position="absolute"
          style={{
            opacity: tipA,
            transform: `translateY(${(1 - tipA) * 4}px) scale(${0.97 + 0.03 * tipA})`,
            transformOrigin: "top left",
          }}
          top={`${tipHover.py + 14}px`}
          width="280px"
          zIndex={8}
        >
          <Panel elevated padding="150">
            <Stack gap="50">
              <Typography type="label" weight="semibold">
                {tipHover.node.label}
              </Typography>
              <Typography mono size="2xs" type="note" variant="tertiary">
                {sourceName(tipHover.node.sourceId)} · {tipHover.node.localId}
              </Typography>
              <Typography mono size="2xs" type="note" variant="secondary">
                {t("linksInOut", {
                  out: degrees.get(tipHover.node.id)?.out ?? 0,
                  in: degrees.get(tipHover.node.id)?.in ?? 0,
                })}
              </Typography>
              {tipHover.node.open && (
                <Chip dot tone="wait">
                  {t("openQuestion")}
                </Chip>
              )}
            </Stack>
          </Panel>
        </Container>
      )}

      <Container
        bottom="12px"
        data-testid={BrainGraphTestId.Legend}
        left="12px"
        position="absolute"
        zIndex={3}
      >
        <Panel padding="100">
          <Stack gap="50">
            <Stack align="center" direction="row" gap="75">
              <SourceShape color="var(--color-state-work)" shape="vault" />
              <Typography size="2xs" type="note" variant="secondary">
                {t("legendVault")}
              </Typography>
            </Stack>
            <Stack align="center" direction="row" gap="75">
              <SourceShape color="var(--color-state-done)" shape="kb" />
              <Typography size="2xs" type="note" variant="secondary">
                {t("legendKb")}
              </Typography>
            </Stack>
            <Stack align="center" direction="row" gap="75">
              <SourceShape color="var(--color-ink)" shape="hub" />
              <Typography size="2xs" type="note" variant="secondary">
                {t("legendHub")}
              </Typography>
            </Stack>
            <Stack align="center" direction="row" gap="75">
              <SourceShape color="var(--color-warn)" shape="ring" />
              <Typography size="2xs" type="note" variant="secondary">
                {hasOpen ? t("legendOpen") : t("legendOpen")}
              </Typography>
            </Stack>
            <Stack align="center" direction="row" gap="75">
              <SourceShape color="var(--color-ink-3)" shape="dashed" />
              <Typography size="2xs" type="note" variant="secondary">
                {t("legendUnsorted")}
              </Typography>
            </Stack>
            <Stack align="center" direction="row" gap="75">
              <SourceShape color="var(--color-ink-2)" shape="line" />
              <Typography size="2xs" type="note" variant="secondary">
                {t("legendLink")}
              </Typography>
            </Stack>
          </Stack>
        </Panel>
      </Container>

      <Container bottom="12px" position="absolute" right="12px" zIndex={3}>
        <Stack align="end" gap="100">
          {minimap && (
            <BrainMinimap
              cam={cam}
              data-testid={BrainGraphTestId.Minimap}
              hue={hue}
              label={t("minimap")}
              nodes={graph.nodes}
              onCenter={(x, y) => setOverride({ ...cam, x, y })}
              pos={at}
              radius={(n) => (n.hub ? 2.6 : 1.6)}
              size={size}
            />
          )}
          <Container data-testid={BrainGraphTestId.Toolbar}>
            <Panel padding="50">
              <Stack align="center" direction="row" gap="50">
                <Button
                  aria-label={t("zoomIn")}
                  data-testid={BrainGraphTestId.ZoomIn}
                  icon="plus"
                  intent="ghost"
                  onClick={() => zoomBy(1.25)}
                  size="sm"
                />
                <Button
                  aria-label={t("zoomOut")}
                  data-testid={BrainGraphTestId.ZoomOut}
                  intent="ghost"
                  onClick={() => zoomBy(0.8)}
                  size="sm"
                >
                  −
                </Button>
                <Button
                  aria-label={t("fit")}
                  data-testid={BrainGraphTestId.Fit}
                  icon="expand"
                  intent="ghost"
                  onClick={() => setOverride(null)}
                  size="sm"
                />
                <Typography size="2xs" type="note" variant="tertiary">
                  {t("labels")}
                </Typography>
                <SegmentedControl
                  ariaLabel={t("labels")}
                  items={[
                    { value: "auto", label: t("labelsAuto") },
                    { value: "all", label: t("labelsAll") },
                    { value: "off", label: t("labelsOff") },
                  ]}
                  onChange={(v) => setLabels(v as LabelMode)}
                  size="sm"
                  value={labels}
                />
                <Button
                  aria-label={t("minimapToggle")}
                  aria-pressed={minimap}
                  data-testid={BrainGraphTestId.MinimapToggle}
                  icon="layout"
                  intent={minimap ? "secondary" : "ghost"}
                  onClick={() => setMinimap((v) => !v)}
                  size="sm"
                />
                <Button
                  aria-label={t("physicsToggle")}
                  aria-pressed={drift}
                  data-testid={BrainGraphTestId.PhysicsToggle}
                  icon="pulse"
                  intent={drift ? "secondary" : "ghost"}
                  onClick={() => setDrift((v) => !v)}
                  size="sm"
                />
              </Stack>
            </Panel>
          </Container>
        </Stack>
      </Container>
    </Container>
  );
}
