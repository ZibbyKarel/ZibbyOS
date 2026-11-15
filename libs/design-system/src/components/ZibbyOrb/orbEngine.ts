/**
 * Zibby orb engine — a typed port of `design/zibby/orb.js`.
 *
 * A wire-mesh sphere on a 2D canvas. One module-level `requestAnimationFrame` loop
 * draws every registered canvas; it starts with the first registration and stops with the
 * last. Per-state parameters and colours ease towards their targets, so a state change
 * morphs instead of cutting. Nothing here touches `window`/`document` at module load.
 */

export const ZIBBY_ORB_STATES = [
  "sleep",
  "ready",
  "wake",
  "listen",
  "think",
  "search",
  "work",
  "speak",
  "needs",
  "done",
  "error",
  "paused",
] as const;

export type ZibbyOrbState = (typeof ZIBBY_ORB_STATES)[number];

type RGB = [number, number, number];
type Palette = [RGB, RGB, RGB];

/** Per-state gradient colours: [primary, secondary, tertiary]. */
export const ORB_COLORS: Record<ZibbyOrbState, Palette> = {
  sleep: [
    [71, 85, 105],
    [100, 116, 139],
    [148, 163, 184],
  ],
  ready: [
    [37, 99, 235],
    [139, 92, 246],
    [217, 70, 239],
  ],
  wake: [
    [245, 165, 36],
    [244, 114, 182],
    [167, 139, 250],
  ],
  listen: [
    [56, 189, 248],
    [99, 102, 241],
    [125, 211, 252],
  ],
  think: [
    [139, 92, 246],
    [217, 70, 239],
    [99, 102, 241],
  ],
  search: [
    [14, 165, 233],
    [56, 189, 248],
    [165, 243, 252],
  ],
  work: [
    [99, 102, 241],
    [167, 139, 250],
    [56, 189, 248],
  ],
  speak: [
    [245, 158, 11],
    [244, 114, 182],
    [167, 139, 250],
  ],
  needs: [
    [245, 165, 36],
    [251, 146, 60],
    [253, 224, 71],
  ],
  done: [
    [16, 185, 129],
    [52, 211, 153],
    [167, 243, 208],
  ],
  error: [
    [225, 29, 72],
    [251, 113, 133],
    [190, 18, 60],
  ],
  paused: [
    [75, 85, 99],
    [107, 114, 128],
    [156, 163, 175],
  ],
};

interface Params {
  spin: number;
  scale: number;
  amp: number;
  freq: number;
  speed: number;
  twist: number;
  wave: number;
  pulse: number;
  lineA: number;
  glow: number;
  halo: number;
  burst: number;
  band: number;
  sats: number;
  ring: number;
  bob: number;
  jitter: number;
  sweep: number;
  sparse: number;
}
type ParamKey = keyof Params;

const BASE: Params = {
  spin: 0.25,
  scale: 1,
  amp: 0.07,
  freq: 1,
  speed: 1,
  twist: 0,
  wave: 0,
  pulse: 0,
  lineA: 0.75,
  glow: 0.6,
  halo: 0.6,
  burst: 0,
  band: 0,
  sats: 0,
  ring: 0,
  bob: 0,
  jitter: 0,
  sweep: 0,
  sparse: 0,
};
const KEYS = Object.keys(BASE) as ParamKey[];

/** Per-state overrides of `BASE`. */
const STATE_PARAMS: Record<ZibbyOrbState, Partial<Params>> = {
  sleep: { spin: 0.08, scale: 0.8, amp: 0.03, speed: 0.35, lineA: 0.35, glow: 0.2, halo: 0.15 },
  ready: { spin: 0.22, amp: 0.07, speed: 0.8, lineA: 0.75, glow: 0.6, halo: 0.6 },
  wake: {
    spin: 1.6,
    scale: 1.06,
    amp: 0.16,
    freq: 1.4,
    speed: 3,
    twist: 0.6,
    lineA: 0.9,
    glow: 1,
    halo: 1,
    burst: 1,
  },
  listen: { spin: 0.3, amp: 0.05, speed: 1, wave: 0.045, lineA: 0.8, glow: 0.7, halo: 0.75 },
  think: {
    spin: 0.9,
    amp: 0.1,
    freq: 1.15,
    speed: 2.2,
    twist: 1.1,
    lineA: 0.85,
    glow: 0.8,
    halo: 0.8,
  },
  search: {
    spin: 0.4,
    scale: 0.96,
    amp: 0.04,
    speed: 0.7,
    band: 1,
    lineA: 0.55,
    glow: 0.55,
    halo: 0.5,
  },
  work: {
    spin: 0.55,
    scale: 0.84,
    amp: 0.06,
    speed: 1.2,
    sats: 1,
    lineA: 0.7,
    glow: 0.6,
    halo: 0.45,
  },
  speak: { spin: 0.35, amp: 0.06, speed: 1.4, pulse: 0.1, lineA: 0.85, glow: 0.8, halo: 0.8 },
  needs: { spin: 0.25, amp: 0.07, speed: 1, ring: 1, bob: 1, lineA: 0.85, glow: 0.85, halo: 0.7 },
  done: {
    spin: 0.16,
    scale: 0.96,
    amp: 0.005,
    speed: 0.4,
    sweep: 1,
    lineA: 0.75,
    glow: 0.6,
    halo: 0.4,
  },
  error: {
    spin: 0.6,
    amp: 0.1,
    freq: 1.6,
    speed: 2,
    jitter: 1,
    lineA: 0.75,
    glow: 0.7,
    halo: 0.5,
  },
  paused: {
    spin: 0,
    scale: 0.88,
    amp: 0.04,
    speed: 0,
    lineA: 0.35,
    glow: 0.15,
    halo: 0.1,
    sparse: 1,
  },
};

function targetParams(st: ZibbyOrbState): Params {
  return { ...BASE, ...STATE_PARAMS[st] };
}

const TAU = 6.2832;

function mix(a: RGB, b: RGB, f: number): RGB {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
function rgba(c: RGB, a: number): string {
  const al = a < 0 ? 0 : a > 1 ? 1 : a;
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al.toFixed(3)})`;
}
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
/** Typed-array read that stays strict under `noUncheckedIndexedAccess`. */
function at(a: ArrayLike<number>, i: number): number {
  return a[i] ?? 0;
}

type HaloPoint = [number, number, number, number, number];
const HALO_CACHE = new Map<number, HaloPoint[]>();
function haloPoints(m: number): HaloPoint[] {
  const cached = HALO_CACHE.get(m);
  if (cached) return cached;
  const a: HaloPoint[] = [];
  for (let i = 0; i < m; i++) {
    const u = hash(i * 3.1) * 2 - 1;
    const ph = hash(i * 7.7) * TAU;
    const r = Math.sqrt(1 - u * u);
    a.push([
      Math.cos(ph) * r,
      u,
      Math.sin(ph) * r,
      1.04 + Math.pow(hash(i * 1.3), 2.2) * 0.42,
      hash(i * 9.9) * TAU,
    ]);
  }
  HALO_CACHE.set(m, a);
  return a;
}

// ---------------------------------------------------------------------------
// Registry + shared loop
// ---------------------------------------------------------------------------

/** What a mounted orb currently wants — read fresh on every frame. */
export interface OrbLive {
  state: ZibbyOrbState;
  size: number;
  /** Live audio level 0–1, or `undefined` for the built-in pseudo envelope. */
  level: number | undefined;
}

interface Sim {
  p: Params;
  c: Palette;
  rot: number;
  t: number;
  nt: number;
  st: ZibbyOrbState;
  since: number;
  trail: [number, number][][];
  /** Smoothed `level`. */
  lv: number;
  bufN: number;
  X: Float32Array;
  Y: Float32Array;
  Z: Float32Array;
  YB: Float32Array;
  LON: Float32Array;
}

export interface OrbEntry {
  canvas: HTMLCanvasElement;
  read: () => OrbLive;
  sim: Sim | null;
}

const registry = new Set<OrbEntry>();
let rafId: number | null = null;
let lastTime: number | null = null;
let reduce = false;
let mql: MediaQueryList | null = null;

function onMotionChange(e: MediaQueryListEvent) {
  reduce = e.matches;
}

function startLoop() {
  if (typeof window === "undefined") return;
  if (window.matchMedia) {
    mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduce = mql.matches;
    mql.addEventListener("change", onMotionChange);
  }
  lastTime = null;
  rafId = window.requestAnimationFrame(frame);
}

function stopLoop() {
  if (rafId !== null) window.cancelAnimationFrame(rafId);
  rafId = null;
  lastTime = null;
  if (mql) mql.removeEventListener("change", onMotionChange);
  mql = null;
}

function frame(now: number) {
  const dt = lastTime === null ? 1 / 60 : Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  for (const entry of registry) {
    try {
      draw(entry, dt, now / 1000);
    } catch {
      // A broken frame of one orb must never take the shared loop down.
    }
  }
  rafId = registry.size > 0 ? window.requestAnimationFrame(frame) : null;
}

/** Add an orb to the shared loop; returns the unregister function. */
export function registerOrb(entry: OrbEntry): () => void {
  registry.add(entry);
  if (registry.size === 1) startLoop();
  return () => {
    registry.delete(entry);
    if (registry.size === 0) stopLoop();
  };
}

/** Test hook: number of orbs currently drawn by the shared loop. */
export function orbRegistrySize(): number {
  return registry.size;
}

function isLight(cv: HTMLCanvasElement): boolean {
  // The DS marks its theme with `data-theme` on the provider root (and on <html>).
  return cv.closest("[data-theme]")?.getAttribute("data-theme") === "light";
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function draw(entry: OrbEntry, dt: number, T: number) {
  const cv = entry.canvas;
  const rect = cv.getBoundingClientRect();
  if (
    !rect.width ||
    rect.bottom < -80 ||
    rect.top > window.innerHeight + 80 ||
    rect.right < -80 ||
    rect.left > window.innerWidth + 80
  )
    return;
  const live = entry.read();
  const size = live.size;
  if (!(size > 0)) return;
  const st = live.state;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(size * 1.8 * dpr);
  if (cv.width !== pw) {
    cv.width = pw;
    cv.height = pw;
  }
  const ctx = cv.getContext("2d");
  if (!ctx) return;

  const tg = targetParams(st);
  const col = ORB_COLORS[st];
  let s = entry.sim;
  if (!s) {
    s = {
      p: targetParams(st),
      c: [[...col[0]], [...col[1]], [...col[2]]],
      rot: hash(size) * 6,
      t: hash(size + 3) * 40,
      nt: 0,
      st,
      since: T,
      trail: [[], [], []],
      lv: live.level ?? 0,
      bufN: 0,
      X: new Float32Array(0),
      Y: new Float32Array(0),
      Z: new Float32Array(0),
      YB: new Float32Array(0),
      LON: new Float32Array(0),
    };
    entry.sim = s;
  }
  if (s.st !== st) {
    s.st = st;
    s.since = T;
  }
  const k = 1 - Math.exp(-dt * (reduce ? 60 : 3.2));
  for (const key of KEYS) s.p[key] += (tg[key] - s.p[key]) * k;
  for (let i = 0; i < 3; i++) {
    const cur = s.c[i as 0 | 1 | 2];
    const dst = col[i as 0 | 1 | 2];
    for (let j = 0; j < 3; j++)
      cur[j as 0 | 1 | 2] += (dst[j as 0 | 1 | 2] - cur[j as 0 | 1 | 2]) * k;
  }
  // Live audio level: fast attack, slower release, so it follows the voice without jitter.
  if (live.level !== undefined) {
    const lt = Math.max(0, Math.min(1, live.level));
    s.lv += (lt - s.lv) * (1 - Math.exp(-dt * (lt > s.lv ? 24 : 9)));
  }

  const P = s.p;
  const mv = reduce ? 0 : 1;
  s.t += dt * mv;
  s.nt += dt * P.speed * mv;
  s.rot += dt * P.spin * mv;
  const t = s.t;
  const nt = s.nt;
  const age = T - s.since;
  const light = isLight(cv);
  const cc: Palette = light
    ? [
        mix(s.c[0], [20, 22, 40], 0.22),
        mix(s.c[1], [20, 22, 40], 0.22),
        mix(s.c[2], [20, 22, 40], 0.22),
      ]
    : s.c;
  const lc: Palette = light
    ? cc
    : [
        mix(cc[0], [255, 255, 255], 0.22),
        mix(cc[1], [255, 255, 255], 0.22),
        mix(cc[2], [255, 255, 255], 0.22),
      ];

  const W = cv.width;
  const cx = W / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, W);
  const pseudoEnv =
    Math.max(0, Math.sin(t * 9.3)) * 0.6 + Math.max(0, Math.sin(t * 5.1 + 1.3)) * 0.4;
  const env = live.level !== undefined ? s.lv : pseudoEnv;
  // `level` also scales the listen wave: 1 at the reference amplitude for a mid-level voice.
  const waveK = live.level !== undefined ? 0.3 + 1.4 * s.lv : 1;
  const wave = P.wave * waveK;
  const R = size * dpr * 0.48 * P.scale * (1 + P.pulse * env);
  const cy = cx - P.bob * Math.abs(Math.sin(t * 2.6)) * size * dpr * 0.04;
  const lw = Math.max(0.45, Math.min(0.9, size / 240)) * dpr;
  const add: GlobalCompositeOperation = light ? "source-over" : "lighter";

  // --- glow: first colour top-left, third bottom-right (radial gradients, no edges) ---
  const gr = Math.min((W / 2) * 0.99, R * 1.8);
  const glow = (x: number, y: number, c: RGB, a: number, r: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };
  ctx.globalCompositeOperation = add;
  const ga = P.glow * (light ? 0.22 : 0.55);
  glow(cx, cy, cc[1], ga * 0.8, gr);
  glow(
    cx - R * 0.35,
    cy - R * 0.25,
    cc[0],
    ga,
    Math.min(gr, (W / 2) * 0.99 - R * 0.4 + R * 0.35) * 0.95,
  );
  glow(cx + R * 0.4, cy + R * 0.45, cc[2], ga * 1.05, Math.min(gr * 0.8, (W / 2) * 0.99 - R * 0.6));
  // body — darker interior so the mesh stands out
  ctx.globalCompositeOperation = "source-over";
  const bg = ctx.createRadialGradient(cx + R * 0.1, cy + R * 0.1, 0, cx, cy, R * 1.05);
  if (light) {
    bg.addColorStop(0, rgba(cc[1], 0.07));
    bg.addColorStop(1, rgba(cc[1], 0));
  } else {
    bg.addColorStop(0, rgba(mix(cc[1], [8, 6, 30], 0.7), 0.55));
    bg.addColorStop(0.8, rgba(mix(cc[1], [8, 6, 30], 0.55), 0.25));
    bg.addColorStop(1, rgba(cc[1], 0));
  }
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.05, 0, TAU);
  ctx.fill();

  // --- mesh ---
  const nLat = Math.round(Math.max(10, Math.min(58, size / 5.2)));
  const nLon = Math.round(nLat * 1.3);
  const NV = (nLat + 1) * nLon;
  if (s.bufN !== NV) {
    s.bufN = NV;
    s.X = new Float32Array(NV);
    s.Y = new Float32Array(NV);
    s.Z = new Float32Array(NV);
    s.YB = new Float32Array(NV);
    s.LON = new Float32Array(NV);
  }
  const { X, Y, Z, YB, LON } = s;
  const tilt = 0.32 + 0.06 * Math.sin(t * 0.4);
  const ct = Math.cos(tilt);
  const stl = Math.sin(tilt);
  const cr = Math.cos(s.rot);
  const sr = Math.sin(s.rot);
  const fq = P.freq;
  const A = P.amp;
  const slice = Math.sin(Math.floor(t * 2.5) * 12.9) * 0.7;
  const sliceOn = P.jitter > 0.05 && hash(Math.floor(t * 2.5)) > 0.35;
  for (let la = 0; la <= nLat; la++) {
    const th = (la / nLat) * Math.PI;
    const sy = Math.cos(th);
    const sxz = Math.sin(th);
    for (let lo = 0; lo < nLon; lo++) {
      const ph = (lo / nLon) * TAU;
      const x = sxz * Math.cos(ph);
      const y = sy;
      const z = sxz * Math.sin(ph);
      const id = la * nLon + lo;
      let d =
        1 +
        A *
          (Math.sin(5.3 * fq * x + nt * 1.1 + 1.3) * Math.sin(4.7 * fq * y - nt * 0.8) * 0.7 +
            Math.sin(6.1 * fq * (y + z) + nt * 1.4) * Math.cos(5.2 * fq * x - nt) * 0.55 +
            Math.sin(7.3 * fq * (x - z) + 4 * y - nt * 1.6) * 0.25) +
        A *
          0.55 *
          (Math.sin(1.7 * x + nt * 0.5) * Math.cos(1.9 * y - nt * 0.4) +
            Math.sin(2.1 * z + nt * 0.6) * 0.6) +
        wave * Math.sin(y * 12 - t * 10) * (0.55 + 0.45 * Math.sin(t * 3.3 + x * 2)) +
        P.burst * 0.1 * Math.sin(5 * x + 4 * y + t * 11);
      if (P.jitter > 0.05 && hash(id * 0.37 + Math.floor(t * 10) * 13) < 0.07)
        d += (hash(id + Math.floor(t * 10)) - 0.5) * 0.4 * P.jitter;
      const tw = P.twist * y;
      const cw = Math.cos(tw);
      const sw = Math.sin(tw);
      const x1 = (x * cw - z * sw) * d;
      const z1 = (x * sw + z * cw) * d;
      const y1 = y * d;
      const x2 = x1 * cr - z1 * sr;
      const z2 = x1 * sr + z1 * cr;
      const y3 = y1 * ct - z2 * stl;
      const z3 = y1 * stl + z2 * ct;
      const f = 1 / (1 - z3 * 0.16);
      const jx = sliceOn && Math.abs(y3 - slice) < 0.12 ? 0.14 * P.jitter : 0;
      X[id] = cx + (x2 + jx) * R * f;
      Y[id] = cy + y3 * R * f;
      Z[id] = z3;
      YB[id] = y3;
      LON[id] = Math.atan2(x2, z3);
    }
  }
  const gl = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  gl.addColorStop(0, rgba(lc[0], 1));
  gl.addColorStop(0.55, rgba(lc[1], 1));
  gl.addColorStop(1, rgba(lc[2], 1));
  const back: number[] = [];
  const front: number[] = [];
  const rim: number[] = [];
  const seg = (a: number, b: number) => {
    const zm = (at(Z, a) + at(Z, b)) * 0.5;
    if (zm < -0.08) back.push(a, b);
    else front.push(a, b);
    if (zm > -0.3 && zm < 0.32) rim.push(a, b);
  };
  const step = P.sparse > 0.5 ? 2 : 1;
  const rowCut = P.jitter > 0.05 ? Math.floor(t * 8) : -1;
  for (let la = 1; la < nLat; la += step) {
    if (rowCut >= 0 && hash(la * 5.3 + rowCut) < 0.18 * P.jitter) continue;
    for (let lo = 0; lo < nLon; lo++) seg(la * nLon + lo, la * nLon + ((lo + 1) % nLon));
  }
  for (let lo = 0; lo < nLon; lo += step) {
    if (rowCut >= 0 && hash(lo * 9.1 + rowCut * 3) < 0.14 * P.jitter) continue;
    for (let la = 0; la < nLat; la++) seg(la * nLon + lo, (la + 1) * nLon + lo);
  }
  const stroke = (list: number[], a: number, w: number) => {
    if (!list.length || a <= 0.01) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.lineWidth = w;
    ctx.strokeStyle = gl;
    ctx.beginPath();
    for (let q = 0; q < list.length; q += 2) {
      const a0 = list[q] ?? 0;
      const b0 = list[q + 1] ?? 0;
      ctx.moveTo(at(X, a0), at(Y, a0));
      ctx.lineTo(at(X, b0), at(Y, b0));
    }
    ctx.stroke();
  };
  ctx.globalCompositeOperation = add;
  stroke(back, P.lineA * (light ? 0.22 : 0.2), lw * 0.8);
  stroke(rim, P.lineA * (light ? 0.15 : 0.22), lw * 3.2); // rim: double stroke (fresnel)
  stroke(front, P.lineA * (light ? 0.8 : 0.7), lw);
  // scan band (search) and meridian sweep (done)
  if (P.band > 0.03) {
    const bandY = Math.sin(t * 1.6) * 0.85;
    const hb: number[] = [];
    for (let la = 1; la < nLat; la++)
      for (let lo = 0; lo < nLon; lo++) {
        const a1 = la * nLon + lo;
        const b1 = la * nLon + ((lo + 1) % nLon);
        if (Math.abs(at(YB, a1) - bandY) < 0.09 && at(Z, a1) > -0.2) hb.push(a1, b1);
      }
    stroke(hb, P.band * 0.9, lw * 2.2);
    stroke(hb, P.band * 0.35, lw * 6);
  }
  if (P.sweep > 0.03 && age < 1.8) {
    const sa = age * 2.4 - 3.1416;
    const hm: number[] = [];
    for (let lo = 0; lo < nLon; lo++)
      for (let la = 0; la < nLat; la++) {
        const a2 = la * nLon + lo;
        const dl = Math.abs(((at(LON, a2) - sa + 9.42) % TAU) - 3.1416);
        if (dl > 2.9 && at(Z, a2) > -0.1) hm.push(a2, (la + 1) * nLon + lo);
      }
    const fa = P.sweep * Math.max(0, 1 - age / 1.8);
    stroke(hm, fa, lw * 2.4);
    stroke(hm, fa * 0.4, lw * 7);
  }
  // node dots
  ctx.globalAlpha = 1;
  ctx.fillStyle = gl;
  ctx.beginPath();
  const dotR = Math.max(0.6 * dpr, lw * 1.25);
  for (let i = 0; i < NV; i++) {
    const zi = at(Z, i);
    if (zi < -0.15 || (i * 7 + ((i / nLon) | 0) * 3) % 5) continue;
    const tw2 = 0.55 + 0.45 * Math.sin(t * 2.4 + i * 1.7);
    const rr = dotR * (0.6 + 0.6 * zi * zi) * tw2;
    ctx.moveTo(at(X, i) + rr, at(Y, i));
    ctx.arc(at(X, i), at(Y, i), rr, 0, TAU);
  }
  ctx.globalAlpha = P.lineA * (light ? 0.9 : 1);
  ctx.fill();
  // particle halo
  const M = Math.round(Math.max(20, Math.min(520, size * 1.8)));
  const H = haloPoints(M);
  const hr = s.rot * 0.35;
  const hc = Math.cos(hr);
  const hs = Math.sin(hr);
  ctx.beginPath();
  for (let i = 0; i < M; i++) {
    const h0 = H[i];
    if (!h0) continue;
    const br =
      h0[3] *
      (1 +
        P.burst * 0.25 * (0.5 + 0.5 * Math.sin(t * 4 + h0[4])) +
        wave * 0.5 * Math.sin(t * 6 + h0[4]) +
        P.pulse * env * 0.6);
    const hx = (h0[0] * hc - h0[2] * hs) * br;
    const hz = (h0[0] * hs + h0[2] * hc) * br;
    const hy = h0[1] * br;
    const py = hy * ct - hz * stl;
    const px = cx + hx * R;
    const pyy = cy + py * R;
    if (Math.abs(px - cx) > W / 2 - 3 || Math.abs(pyy - cy) > W / 2 - 3) continue;
    const pr =
      dpr *
      Math.max(0.5, size / 150) *
      (0.55 + 0.45 * Math.sin(t * 2 + h0[4])) *
      (1.25 - (h0[3] - 1.04) * 1.2);
    ctx.moveTo(px + pr, pyy);
    ctx.arc(px, pyy, pr, 0, TAU);
  }
  ctx.fillStyle = gl;
  ctx.globalAlpha = P.halo * (light ? 0.6 : 0.9);
  ctx.fill();
  ctx.globalAlpha = 1;
  // satellites = agents
  if (P.sats > 0.03) {
    for (let q = 0; q < 3; q++) {
      const an = t * (1.05 + q * 0.42) + q * 2.1;
      const inc = 0.5 + q * 0.65;
      const ro = 1.42 + q * 0.07;
      const sx = Math.cos(an) * ro;
      const sy0 = Math.sin(an) * Math.sin(inc) * ro;
      const sz0 = Math.sin(an) * Math.cos(inc) * ro;
      const syy = sy0 * ct - sz0 * stl;
      const szz = sy0 * stl + sz0 * ct;
      const spx = cx + sx * R;
      const spy = cy + syy * R;
      const sd = (szz / ro + 1) / 2;
      const tr = s.trail[q];
      if (!tr) continue;
      tr.push([spx, spy]);
      if (tr.length > 16) tr.shift();
      ctx.strokeStyle = gl;
      for (let m = 1; m < tr.length; m++) {
        const p0 = tr[m - 1];
        const p1 = tr[m];
        if (!p0 || !p1) continue;
        ctx.globalAlpha = P.sats * 0.5 * (m / tr.length);
        ctx.lineWidth = lw * 1.8 * (m / tr.length);
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
      let best = 0;
      let bd = 1e12;
      for (let i = 0; i < NV; i += 5) {
        const dx = at(X, i) - spx;
        const dy = at(Y, i) - spy;
        const dd = dx * dx + dy * dy;
        if (dd < bd && at(Z, i) > 0) {
          bd = dd;
          best = i;
        }
      }
      ctx.globalAlpha = P.sats * 0.6 * sd;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(spx, spy);
      ctx.lineTo(at(X, best), at(Y, best));
      ctx.stroke();
      ctx.globalAlpha = P.sats * (0.55 + 0.45 * sd);
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(spx, spy, lw * (3.4 + 2.2 * sd), 0, TAU);
      ctx.fill();
      glow(spx, spy, cc[1], P.sats * 0.5 * sd, lw * 16);
    }
  }
  // beacon rings (needs you)
  if (P.ring > 0.03) {
    ctx.fillStyle = rgba(light ? cc[0] : lc[0], 1);
    for (let w = 0; w < 2; w++) {
      const phs = ((t + w * 0.9) % 1.8) / 1.8;
      const rad = R * (1.08 + 0.7 * phs);
      ctx.globalAlpha = P.ring * (1 - phs) * 0.9;
      ctx.beginPath();
      for (let j2 = 0; j2 < 48; j2++) {
        const aa = (j2 / 48) * TAU + t * 0.25;
        const ex = cx + Math.cos(aa) * rad;
        const ey = cy + Math.sin(aa) * rad * 0.3 * ct + R * 0.04;
        const er = lw * 1.2;
        ctx.moveTo(ex + er, ey);
        ctx.arc(ex, ey, er, 0, TAU);
      }
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
