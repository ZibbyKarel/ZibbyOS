"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, Container, Panel, Stack, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type BrainGraphData, type BrainNode, HUB_ID } from "../brainModel";
import { layoutBrain } from "../brainLayout";
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
}

export interface BrainGraphProps {
  graph: BrainGraphData;
  /** CSS colour (a token reference) per source id. */
  sourceColor: (sourceId: string) => string;
  /** Display name per source id (tooltip + legend). */
  sourceName: (sourceId: string) => string;
  selectedId: string | null;
  /** Search hits: matching notes get a ring, the rest fade. null = no search. */
  matchIds: ReadonlySet<string> | null;
  onSelect: (id: string) => void;
}

interface View {
  k: number;
  x: number;
  y: number;
}
const FIT: View = { k: 1, x: 0, y: 0 };
const MIN_K = 0.4;
const MAX_K = 6;
/** Always label nodes up to this many; above it only hovered / selected / matching ones. */
const LABEL_ALL_UNDER = 60;

/**
 * The 2D brain graph: the whole unified brain on one SVG canvas with pan (drag), zoom (wheel and
 * buttons), fit, a hover tooltip card and a legend. Shape and colour say which source a note
 * lives in (vault = circle, team KB = rounded square, the Index hub = double ring); an amber ring
 * marks a note with an open question. The tree beside it is the keyboard twin, so nodes are only
 * tab stops in small graphs.
 */
export function BrainGraph({
  graph,
  sourceColor,
  sourceName,
  selectedId,
  matchIds,
  onSelect,
}: BrainGraphProps) {
  const t = useTranslations("knowledge.brain.graph");
  const svg = useRef<SVGSVGElement>(null);
  const pan = useRef<{ x: number; y: number; view: View; scale: number } | null>(null);
  const [view, setView] = useState<View>(FIT);
  const [hover, setHover] = useState<{
    node: BrainNode;
    px: number;
    py: number;
    maxLeft: number;
  } | null>(null);

  const layout = useMemo(() => layoutBrain(graph), [graph]);
  const { width, height } = layout;

  const degrees = useMemo(() => {
    const d = new Map<string, { out: number; in: number }>();
    for (const e of graph.edges) {
      if (e.from === HUB_ID || e.to === HUB_ID) continue;
      d.set(e.from, { out: (d.get(e.from)?.out ?? 0) + 1, in: d.get(e.from)?.in ?? 0 });
      d.set(e.to, { out: d.get(e.to)?.out ?? 0, in: (d.get(e.to)?.in ?? 0) + 1 });
    }
    return d;
  }, [graph.edges]);

  const zoomAt = (factor: number, cx: number, cy: number) =>
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const r = k / v.k;
      return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
    });

  // React's onWheel is passive and cannot stop the page from scrolling, so attach natively.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = el.getScreenCTM?.();
      const p = m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null;
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p?.x ?? width / 2, p?.y ?? height / 2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [width, height]);

  const live = hover?.node.id ?? selectedId;
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
  const legendSources = [...new Set(graph.nodes.filter((n) => !n.hub).map((n) => n.sourceId))];
  const hasOpen = graph.nodes.some((n) => n.open);

  return (
    <Container data-testid={BrainGraphTestId.Root} height="100%" position="relative" width="100%">
      <svg
        aria-label={t("label")}
        data-testid={BrainGraphTestId.Svg}
        height="100%"
        onPointerCancel={() => (pan.current = null)}
        onPointerDown={(e) => {
          const m = svg.current?.getScreenCTM?.();
          pan.current = { x: e.clientX, y: e.clientY, view, scale: m?.a ?? 1 };
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = pan.current;
          if (!p) return;
          setView({
            k: p.view.k,
            x: p.view.x + (e.clientX - p.x) / p.scale,
            y: p.view.y + (e.clientY - p.y) / p.scale,
          });
        }}
        onPointerUp={() => (pan.current = null)}
        ref={svg}
        role="group"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {graph.edges.map((e, i) => {
            const a = layout.pos.get(e.from);
            const b = layout.pos.get(e.to);
            if (!a || !b) return null;
            const lit = live !== null && (e.from === live || e.to === live);
            return (
              <line
                key={`${e.from}>${e.to}>${i}`}
                opacity={lit ? 1 : matchIds ? 0.25 : 0.7}
                stroke={lit ? "var(--color-ink-2)" : "var(--color-line-2)"}
                strokeWidth={lit ? 1.6 : 1}
                x1={a.x}
                x2={b.x}
                y1={a.y}
                y2={b.y}
              />
            );
          })}
          {graph.nodes.map((n) => {
            const p = layout.pos.get(n.id);
            if (!p) return null;
            const selected = n.id === selectedId;
            const hit = matchIds?.has(n.id) ?? false;
            const dim = matchIds !== null && !hit && !n.hub;
            const fill = n.hub ? "var(--color-ink)" : sourceColor(n.sourceId);
            const showLabel =
              graph.nodes.length <= LABEL_ALL_UNDER ||
              selected ||
              hit ||
              n.id === live ||
              near.has(n.id);
            return (
              <g
                aria-label={n.label}
                cursor="pointer"
                data-testid={`${BrainGraphTestId.Node}-${n.id}`}
                key={n.id}
                onClick={() => !n.hub && onSelect(n.id)}
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
                opacity={dim ? 0.22 : 1}
                role="button"
                tabIndex={tabbable && !n.hub ? 0 : -1}
              >
                {n.hub ? (
                  <>
                    <circle cx={p.x} cy={p.y} fill="none" r={11} stroke={fill} strokeWidth={1.5} />
                    <circle cx={p.x} cy={p.y} fill={fill} r={4.5} />
                  </>
                ) : n.sourceId === "vault" ? (
                  <circle cx={p.x} cy={p.y} fill={fill} r={n.id === live ? 7.5 : 6} />
                ) : (
                  <rect
                    fill={fill}
                    height={n.id === live ? 15 : 12}
                    rx={3}
                    width={n.id === live ? 15 : 12}
                    x={p.x - (n.id === live ? 7.5 : 6)}
                    y={p.y - (n.id === live ? 7.5 : 6)}
                  />
                )}
                {n.open && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    fill="none"
                    r={11}
                    stroke="var(--color-warn)"
                    strokeWidth={1.8}
                  />
                )}
                {(selected || hit) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    fill="none"
                    r={n.open ? 14.5 : 11.5}
                    stroke="var(--color-ink)"
                    strokeWidth={selected ? 2 : 1.4}
                  />
                )}
                {showLabel && (
                  <text
                    fill="var(--color-ink-2)"
                    fontSize={11}
                    pointerEvents="none"
                    textAnchor="middle"
                    x={p.x}
                    y={p.y - 14}
                  >
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {hover && !hover.node.hub && (
        <Container
          data-testid={BrainGraphTestId.Tooltip}
          left={`${Math.min(hover.px + 14, hover.maxLeft)}px`}
          pointerEvents="none"
          position="absolute"
          top={`${hover.py + 14}px`}
          width="280px"
          zIndex={8}
        >
          <Panel elevated padding="150">
            <Stack gap="50">
              <Typography type="label" weight="semibold">
                {hover.node.label}
              </Typography>
              <Typography mono size="2xs" type="note" variant="tertiary">
                {sourceName(hover.node.sourceId)} · {hover.node.localId}
              </Typography>
              <Typography mono size="2xs" type="note" variant="secondary">
                {t("links", {
                  out: degrees.get(hover.node.id)?.out ?? 0,
                  in: degrees.get(hover.node.id)?.in ?? 0,
                })}
              </Typography>
              {hover.node.open && (
                <Chip dot tone="wait">
                  {t("openQuestion")}
                </Chip>
              )}
            </Stack>
          </Panel>
        </Container>
      )}

      <Container position="absolute" right="12px" top="10px" zIndex={3}>
        <Stack align="center" direction="row" gap="50">
          <Button
            aria-label={t("zoomOut")}
            data-testid={BrainGraphTestId.ZoomOut}
            intent="ghost"
            onClick={() => zoomAt(1 / 1.3, width / 2, height / 2)}
            size="sm"
          >
            −
          </Button>
          <Button
            aria-label={t("zoomIn")}
            data-testid={BrainGraphTestId.ZoomIn}
            intent="ghost"
            onClick={() => zoomAt(1.3, width / 2, height / 2)}
            size="sm"
          >
            +
          </Button>
          <Button
            aria-label={t("fit")}
            data-testid={BrainGraphTestId.Fit}
            icon="expand"
            intent="ghost"
            onClick={() => setView(FIT)}
            size="sm"
          />
        </Stack>
      </Container>

      <Container
        bottom="12px"
        data-testid={BrainGraphTestId.Legend}
        left="12px"
        position="absolute"
        zIndex={3}
      >
        <Panel padding="100">
          <Stack gap="50">
            {legendSources.map((sid) => (
              <Stack align="center" direction="row" gap="75" key={sid}>
                <SourceShape color={sourceColor(sid)} shape={sid === "vault" ? "vault" : "kb"} />
                <Typography size="2xs" type="note" variant="secondary">
                  {sourceName(sid)}
                </Typography>
              </Stack>
            ))}
            <Stack align="center" direction="row" gap="75">
              <SourceShape color="var(--color-ink)" shape="hub" />
              <Typography size="2xs" type="note" variant="secondary">
                {t("legendHub")}
              </Typography>
            </Stack>
            {hasOpen && (
              <Stack align="center" direction="row" gap="75">
                <SourceShape color="var(--color-warn)" shape="ring" />
                <Typography size="2xs" type="note" variant="secondary">
                  {t("openQuestion")}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Panel>
      </Container>
    </Container>
  );
}
