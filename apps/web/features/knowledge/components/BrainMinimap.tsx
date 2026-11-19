"use client";

import type { Cam } from "./BrainGraph";
import { Container, Typography } from "@zibby/design-system";
import type { BrainNode } from "../brainModel";

export interface BrainMinimapProps {
  cam: Cam;
  /** The canvas size in px — the viewport rectangle is derived from it. */
  size: { w: number; h: number };
  nodes: readonly BrainNode[];
  /** World position of a node (null = not placed). */
  pos: (id: string) => { x: number; y: number } | null;
  hue: (n: BrainNode) => string;
  radius: (n: BrainNode) => number;
  label: string;
  /** Recentre the canvas on a world point. */
  onCenter: (x: number, y: number) => void;
  "data-testid"?: string;
}

const W = 176;
const H = 116;

/** The "minimapa" card: every node as a dot over the world's bounding box + the visible window. */
export function BrainMinimap({
  cam,
  size,
  nodes,
  pos,
  hue,
  radius,
  label,
  onCenter,
  "data-testid": testId,
}: BrainMinimapProps) {
  const pts = nodes.flatMap((n) => {
    const p = pos(n.id);
    return p ? [{ n, p }] : [];
  });
  if (pts.length === 0) return null;
  const xs = pts.map((q) => q.p.x);
  const ys = pts.map((q) => q.p.y);
  const bw = Math.max(...xs) - Math.min(...xs) + 80;
  const bh = Math.max(...ys) - Math.min(...ys) + 80;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const s = Math.min(W / bw, H / bh);
  const X = (x: number) => (x - cx) * s + W / 2;
  const Y = (y: number) => (y - cy) * s + H / 2;
  return (
    <Container
      cursor="pointer"
      data-testid={testId}
      height={`${H}px`}
      overflow="hidden"
      position="relative"
      width={`${W}px`}
    >
      <svg
        aria-label={label}
        height={H}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onCenter((e.clientX - r.left - W / 2) / s + cx, (e.clientY - r.top - H / 2) / s + cy);
        }}
        role="img"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
      >
        <rect
          fill="var(--color-bg)"
          fillOpacity={0.86}
          height={H - 1}
          rx={10}
          stroke="var(--color-line-2)"
          width={W - 1}
          x={0.5}
          y={0.5}
        />
        {pts.map(({ n, p }) => {
          const d = radius(n);
          return (
            <rect
              fill={hue(n)}
              fillOpacity={n.hub ? 1 : 0.7}
              height={d}
              key={n.id}
              width={d}
              x={X(p.x) - d / 2}
              y={Y(p.y) - d / 2}
            />
          );
        })}
        <rect
          fill="none"
          height={(size.h / cam.k) * s}
          stroke="var(--color-ink)"
          strokeOpacity={0.75}
          width={(size.w / cam.k) * s}
          x={X(cam.x - size.w / 2 / cam.k)}
          y={Y(cam.y - size.h / 2 / cam.k)}
        />
      </svg>
      <Container left="8px" pointerEvents="none" position="absolute" top="5px">
        <Typography mono size="2xs" type="note" variant="tertiary">
          {label}
        </Typography>
      </Container>
    </Container>
  );
}
