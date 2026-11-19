"use client";

import { Container, Typography } from "@zibby/design-system";

export enum NoteNeighbourhoodTestId {
  Root = "note-neighbourhood",
  /** Suffixed with the unified note id. */
  Node = "note-neighbourhood-node",
}

export interface NeighbourNode {
  id: string;
  label: string;
  /** CSS colour of the neighbour's source. */
  color: string;
}

export interface NoteNeighbourhoodProps {
  title: string;
  center: NeighbourNode;
  neighbours: readonly NeighbourNode[];
  onSelect: (id: string) => void;
}

const W = 520;
const H = 170;
const MAX = 8;
const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** "Okolí v mozku": the open note in the middle, its linked notes spread on an ellipse around it. */
export function NoteNeighbourhood({ title, center, neighbours, onSelect }: NoteNeighbourhoodProps) {
  const shown = neighbours.slice(0, MAX);
  if (shown.length === 0) return null;
  return (
    <Container data-testid={NoteNeighbourhoodTestId.Root}>
      <Typography uppercase size="2xs" type="note" variant="tertiary">
        {title}
      </Typography>
      <Container height={`${H}px`} overflow="hidden" width="100%">
        <svg aria-label={title} height="100%" role="group" viewBox={`0 0 ${W} ${H}`} width="100%">
          <rect
            fill="var(--color-bg)"
            height={H - 1}
            rx={10}
            stroke="var(--color-line)"
            width={W - 1}
            x={0.5}
            y={0.5}
          />
          {shown.map((n, i) => {
            const a = -Math.PI / 2 + (i / shown.length) * Math.PI * 2;
            const x = W / 2 + Math.cos(a) * (W * 0.36);
            const y = H / 2 + Math.sin(a) * (H * 0.36);
            const w = trim(n.label, 20).length * 5.6 + 22;
            return (
              <g key={n.id}>
                <line stroke={n.color} strokeOpacity={0.45} x1={W / 2} x2={x} y1={H / 2} y2={y} />
                <g
                  cursor="pointer"
                  data-testid={`${NoteNeighbourhoodTestId.Node}-${n.id}`}
                  onClick={() => onSelect(n.id)}
                  role="button"
                >
                  <rect
                    fill="var(--color-bg)"
                    fillOpacity={0.85}
                    height={18}
                    rx={5}
                    width={w}
                    x={x - w / 2}
                    y={y - 9}
                  />
                  <circle cx={x - w / 2 + 8} cy={y} fill={n.color} r={3} />
                  <text fill="var(--color-ink-2)" fontSize={10.5} x={x - w / 2 + 15} y={y + 3.6}>
                    {trim(n.label, 20)}
                  </text>
                </g>
              </g>
            );
          })}
          <g>
            <rect
              fill="var(--color-panel-2)"
              height={20}
              rx={6}
              stroke="var(--color-line-2)"
              width={trim(center.label, 24).length * 6.2 + 20}
              x={W / 2 - (trim(center.label, 24).length * 6.2 + 20) / 2}
              y={H / 2 - 10}
            />
            <text
              fill="var(--color-ink)"
              fontSize={11}
              fontWeight={600}
              textAnchor="middle"
              x={W / 2}
              y={H / 2 + 4}
            >
              {trim(center.label, 24)}
            </text>
          </g>
        </svg>
      </Container>
    </Container>
  );
}
