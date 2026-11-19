"use client";
import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWdT } from "./useWdT";
import type { Agent, Department, PhaseLoop } from "@zibby/contracts";
import {
  Button,
  Container,
  GraphInlineInput,
  Icon,
  Pressable,
  Stack,
  Typography,
} from "@zibby/design-system";
import { BAD } from "../WorkflowDialog/canvas-tokens";
import {
  type GraphNode,
  type GraphProblem,
  type WorkflowGraph,
  loopOf,
  orderNodes,
  setLoop,
} from "../WorkflowDialog/workflow-graph";
import {
  type Arc,
  CARD_H,
  CARD_W,
  type Pt,
  type Rect,
  type View,
  clampZoom,
  contentBounds,
  failArc,
  failTerminal,
  fitView,
  flowPath,
  insertIndexAt,
  leftPort,
  lodFor,
  loopArc,
  placeChain,
  rightPort,
  toScreen,
  toWorld,
  topPort,
  zoomAt,
} from "./canvasLayout";
import { PHASE_DND, type PhaseDrop, parsePhaseDrop } from "./dnd";
import { LoopFields } from "./LoopFields";
import { PhaseCard } from "./PhaseCard";
import type { SetGraph } from "./useGraphHistory";
import { usePhaseLabel } from "./usePhaseLabel";

export enum FlowCanvasTestId {
  Root = "workflow-canvas",
  World = "workflow-canvas-world",
  Zoom = "canvas-zoom-value",
  ZoomIn = "canvas-zoom-in",
  ZoomOut = "canvas-zoom-out",
  Fit = "canvas-fit",
  Undo = "canvas-undo",
  Redo = "canvas-redo",
  Minimap = "canvas-minimap",
  Ghost = "canvas-ghost",
  Edge = "canvas-edge",
  FilePill = "canvas-file-pill",
  Checkpoint = "canvas-checkpoint",
  InsertHere = "canvas-insert-here",
  LoopPill = "canvas-loop-pill",
  LoopPopover = "canvas-loop-popover",
  FailTerminal = "canvas-fail-terminal",
  EndNode = "canvas-end-node",
  DropCue = "canvas-drop-cue",
}

export interface FlowCanvasProps {
  graph: WorkflowGraph;
  setGraph: SetGraph;
  agents: Agent[];
  departments?: readonly Department[];
  /** Child workflow id → display name (sub-workflow cards). */
  workflowNames?: ReadonlyMap<string, string>;
  /** The workflow opens a PR: draw the delivery end node after the last phase. */
  hasPrOutput: boolean;
  editing: boolean;
  problems: readonly GraphProblem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Phase whose loop popover is open. */
  loopOpenId: string | null;
  onLoopOpen: (id: string | null) => void;
  /** Live-run attempt tally per phase id. */
  attempts?: Record<string, number>;
  onDrop: (drop: PhaseDrop, index: number) => void;
  /** "+" on a connector: open the palette to insert after this phase. */
  onInsertAfter: (nodeId: string) => void;
  onToggleCheckpoint: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const EMPTY: Rect = { x: 0, y: 0, w: 0, h: 0 };

interface LoopView {
  node: GraphNode;
  loop: PhaseLoop;
  fail: boolean;
  term: Rect | undefined;
  arc: Arc;
}

export function FlowCanvas({
  graph,
  setGraph,
  agents,
  departments,
  workflowNames,
  hasPrOutput,
  editing,
  problems,
  selectedId,
  onSelect,
  loopOpenId,
  onLoopOpen,
  attempts,
  onDrop,
  onInsertAfter,
  onToggleCheckpoint,
  undo,
  redo,
  canUndo,
  canRedo,
}: FlowCanvasProps) {
  const t = useWdT("workflowDetail.canvas");
  const label = usePhaseLabel(agents);
  const rootRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const touched = useRef(false);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [loopDrag, setLoopDrag] = useState<{ from: string; cursor: Pt } | null>(null);
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  const order = useMemo(() => orderNodes(graph), [graph]);
  const placement = useMemo(() => placeChain(order, hasPrOutput), [order, hasPrOutput]);
  const bounds = useMemo(
    () => contentBounds(placement, graph.rework, order, order),
    [placement, graph.rework, order],
  );
  const problemIds = useMemo(
    () => new Set(problems.flatMap((p) => (p.nodeId ? [p.nodeId] : []))),
    [problems],
  );
  const lod = lodFor(view.zoom);
  const idx = useMemo(() => new Map(order.map((n, i) => [n.id, i])), [order]);

  // ---- viewport size + initial fit ---------------------------------------
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = () => {
    if (size.w > 0) setView(fitView(bounds, size.w, size.h));
  };
  const nodeCount = order.length;
  useEffect(() => {
    if (touched.current || size.w === 0) return;
    setView(fitView(bounds, size.w, size.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, nodeCount, hasPrOutput]);

  // ---- wheel: pinch/ctrl = zoom, plain = pan -----------------------------
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touched.current = true;
      const r = el.getBoundingClientRect();
      const anchor = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (e.ctrlKey || e.metaKey) {
        setView((v) => zoomAt(v, v.zoom * Math.exp(-e.deltaY * 0.01), anchor));
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const localPoint = (clientX: number, clientY: number): Pt => {
    const r = rootRef.current?.getBoundingClientRect();
    return r ? { x: clientX - r.left, y: clientY - r.top } : { x: clientX, y: clientY };
  };
  const zoomBy = (factor: number) => {
    touched.current = true;
    setView((v) => zoomAt(v, v.zoom * factor, { x: size.w / 2, y: size.h / 2 }));
  };

  // ---- background pan ----------------------------------------------------
  const onBgDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-node-id],[data-nopan]")) return;
    pan.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onBgMove = (e: ReactPointerEvent) => {
    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 4) return;
    p.moved = true;
    setPanning(true);
    touched.current = true;
    setView((v) => ({ ...v, x: p.vx + dx, y: p.vy + dy }));
  };
  const onBgUp = () => {
    const p = pan.current;
    pan.current = null;
    setPanning(false);
    if (p && !p.moved) {
      onSelect(null);
      onLoopOpen(null);
    }
  };

  // ---- loop drag from a card's top handle --------------------------------
  const startLoopDrag = (from: string, e: ReactPointerEvent) => {
    const w = toWorld(view, localPoint(e.clientX, e.clientY));
    setLoopDrag({ from, cursor: w });
  };
  useEffect(() => {
    if (!loopDrag) return;
    const move = (e: PointerEvent) => {
      const w = toWorld(view, localPoint(e.clientX, e.clientY));
      setLoopDrag((d) => (d ? { ...d, cursor: w } : d));
    };
    const up = (e: PointerEvent) => {
      const w = toWorld(view, localPoint(e.clientX, e.clientY));
      const fromIdx = idx.get(loopDrag.from) ?? 0;
      const target = order.find((n) => {
        const r = placement.cards.get(n.id);
        return (
          r &&
          (idx.get(n.id) ?? 0) < fromIdx &&
          w.x >= r.x &&
          w.x <= r.x + r.w &&
          w.y >= r.y - 24 &&
          w.y <= r.y + r.h
        );
      });
      setLoopDrag(null);
      if (!target) return;
      setGraph((g) =>
        setLoop(g, loopDrag.from, {
          to: target.id,
          maxRetries: 3,
          escalate: true,
          then: "park",
        }),
      );
      onSelect(loopDrag.from);
      onLoopOpen(loopDrag.from);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopDrag?.from, view, order, placement]);

  // ---- palette drop ------------------------------------------------------
  const onDragOver = (e: DragEvent) => {
    if (!editing || !e.dataTransfer.types.includes(PHASE_DND)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const w = toWorld(view, localPoint(e.clientX, e.clientY));
    setDropIdx(insertIndexAt(placement, order, w.x));
  };
  const onDropHere = (e: DragEvent) => {
    if (!editing) return;
    const drop = parsePhaseDrop(e.dataTransfer.getData(PHASE_DND));
    setDropIdx(null);
    if (!drop) return;
    e.preventDefault();
    const w = toWorld(view, localPoint(e.clientX, e.clientY));
    onDrop(drop, insertIndexAt(placement, order, w.x));
  };

  // ---- derived drawing data ----------------------------------------------
  const connectors = order.map((n, i) => {
    const a = placement.cards.get(n.id) ?? EMPTY;
    const nextCard = order[i + 1] ? placement.cards.get(order[i + 1]!.id) : undefined;
    const bEnd = nextCard
      ? leftPort(nextCard)
      : placement.end
        ? leftPort(placement.end)
        : (placement.stub ?? rightPort(a));
    const aPt = rightPort(a);
    return {
      node: n,
      a: aPt,
      b: bEnd,
      mid: { x: (aPt.x + bEnd.x) / 2, y: (aPt.y + bEnd.y) / 2 },
      toStub: !nextCard && !placement.end,
    };
  });

  const loops = order.flatMap((n): LoopView[] => {
    const l = loopOf(graph, n.id);
    const src = placement.cards.get(n.id);
    if (!l || !src) return [];
    if (l.to === "fail") {
      const term = failTerminal(src);
      return [{ node: n, loop: l, fail: true, term, arc: failArc(src, term) }];
    }
    const dst = placement.cards.get(l.to);
    if (!dst) return [];
    const span = Math.abs((idx.get(n.id) ?? 0) - (idx.get(l.to) ?? 0));
    return [
      {
        node: n,
        loop: l,
        fail: false,
        term: undefined,
        arc: loopArc(topPort(src), topPort(dst), span),
      },
    ];
  });

  const openLoop = loopOpenId ? loops.find((l) => l.node.id === loopOpenId) : undefined;
  const popPos = openLoop ? toScreen(view, openLoop.arc.mid) : undefined;
  const nodeName = (id: string) => {
    const n = order.find((x) => x.id === id);
    return n ? label(n) : id;
  };

  const earlier = (id: string) =>
    order.slice(0, idx.get(id) ?? 0).map((n) => ({ id: n.id, label: `${label(n)} · ${n.id}` }));
  const others = (id: string) =>
    order.filter((n) => n.id !== id).map((n) => ({ id: n.id, label: `${label(n)} · ${n.id}` }));

  const dragPreview =
    loopDrag && placement.cards.get(loopDrag.from)
      ? loopArc(topPort(placement.cards.get(loopDrag.from)!), loopDrag.cursor, 2).path
      : null;

  return (
    <Container
      grow
      aria-label={editing ? t("ariaEditing") : t("ariaReadOnly")}
      data-testid={FlowCanvasTestId.Root}
      height="100%"
      minHeight="0"
      onDragLeave={() => setDropIdx(null)}
      onDragOver={onDragOver}
      onDrop={onDropHere}
      onPointerDown={onBgDown}
      onPointerMove={onBgMove}
      onPointerUp={onBgUp}
      overflow="hidden"
      position="relative"
      ref={rootRef}
      role="application"
      style={{
        background: "var(--color-background)",
        backgroundImage: `radial-gradient(color-mix(in srgb, var(--color-ink) ${editing ? 11 : 6}%, transparent) 1px, transparent 1.4px)`,
        backgroundSize: `${20 * view.zoom}px ${20 * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        touchAction: "none",
        cursor: panning ? "grabbing" : "default",
      }}
    >
      <Container
        data-testid={FlowCanvasTestId.World}
        left="0"
        position="absolute"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: "0 0",
        }}
        top="0"
        width="1px"
      >
        <svg
          aria-hidden="true"
          height="1"
          // eslint-disable-next-line react/forbid-dom-props
          style={{ position: "absolute", left: 0, top: 0, overflow: "visible", zIndex: 1 }}
          width="1"
        >
          <defs>
            <marker
              id="wf-ah"
              markerHeight="7"
              markerWidth="7"
              orient="auto-start-reverse"
              refX="9"
              refY="5"
              viewBox="0 0 10 10"
            >
              <path d="M0,1 L9,5 L0,9 z" fill="var(--color-ink-3)" />
            </marker>
            <marker
              id="wf-ahk"
              markerHeight="7"
              markerWidth="7"
              orient="auto-start-reverse"
              refX="9"
              refY="5"
              viewBox="0 0 10 10"
            >
              <path d="M0,1 L9,5 L0,9 z" fill="var(--color-ink)" />
            </marker>
            <marker
              id="wf-ahr"
              markerHeight="7"
              markerWidth="7"
              orient="auto-start-reverse"
              refX="9"
              refY="5"
              viewBox="0 0 10 10"
            >
              <path d="M0,1 L9,5 L0,9 z" fill={BAD} />
            </marker>
          </defs>
          {connectors.map((c) => {
            const hot = selectedId === c.node.id;
            return (
              <path
                d={flowPath(c.a, c.b)}
                data-testid={FlowCanvasTestId.Edge}
                fill="none"
                key={c.node.id}
                markerEnd={c.toStub ? undefined : `url(#${hot ? "wf-ahk" : "wf-ah"})`}
                stroke={hot ? "var(--color-ink)" : "var(--color-ink-3)"}
                strokeWidth={hot ? 2 : 1.5}
              />
            );
          })}
          {loops.map((l) => {
            const bad = l.fail;
            const sel = loopOpenId === l.node.id;
            return (
              <path
                d={l.arc.path}
                fill="none"
                key={l.node.id}
                markerEnd={`url(#${bad ? "wf-ahr" : "wf-ahk"})`}
                stroke={bad ? BAD : "color-mix(in srgb, var(--color-ink) 45%, transparent)"}
                strokeDasharray={bad ? "5 4" : undefined}
                strokeWidth={sel ? 2.2 : 1.6}
              />
            );
          })}
          {dragPreview && (
            <path
              d={dragPreview}
              fill="none"
              opacity="0.8"
              stroke="var(--color-ink)"
              strokeDasharray="5 4"
              strokeWidth="1.6"
            />
          )}
        </svg>

        {order.map((n) => {
          const rect = placement.cards.get(n.id) ?? EMPTY;
          const l = loopOf(graph, n.id);
          const done = attempts?.[n.id];
          return (
            <PhaseCard
              agent={agents.find((a) => a.id === n.agent)}
              attempt={l && done !== undefined ? { n: done, max: l.maxRetries + 1 } : undefined}
              departments={departments}
              editing={editing}
              key={n.id}
              lod={lod}
              node={n}
              onLoopHandleDown={startLoopDrag}
              onSelect={(id) => {
                onSelect(id);
                onLoopOpen(null);
              }}
              problem={problemIds.has(n.id)}
              rect={rect}
              selected={selectedId === n.id}
              workflowName={n.workflow ? workflowNames?.get(n.workflow) : undefined}
            />
          );
        })}

        {placement.end && (
          <Container
            data-testid={FlowCanvasTestId.EndNode}
            left={`${placement.end.x}px`}
            position="absolute"
            style={{
              height: placement.end.h,
              width: placement.end.w,
              borderRadius: 999,
              border: "1px solid var(--color-border-strong)",
              background: "var(--color-surface)",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "0 14px 0 10px",
              zIndex: 3,
            }}
            top={`${placement.end.y}px`}
          >
            <Icon name="branch" size="sm" tone="dim" />
            <Container grow minW0>
              <Typography truncate size="sm" type="note" weight="semibold">
                {t("endPr")}
              </Typography>
              <Typography truncate size="2xs" type="note" variant="tertiary">
                {t("endParks")}
              </Typography>
            </Container>
            <Icon name="lock" size="xs" tone="warn" />
          </Container>
        )}

        {connectors.map((c) => {
          if (lod === "far" && !c.node.approval) return null;
          const hovered = hoverEdge === c.node.id || selectedId === c.node.id;
          const on = c.node.approval === "ask";
          return (
            <Container
              data-nopan=""
              data-testid={`${FlowCanvasTestId.Edge}-zone`}
              key={c.node.id}
              left={`${c.mid.x - 64}px`}
              onMouseEnter={() => setHoverEdge(c.node.id)}
              onMouseLeave={() => setHoverEdge((h) => (h === c.node.id ? null : h))}
              position="absolute"
              style={{
                width: 128,
                height: 76,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                zIndex: 5,
              }}
              top={`${c.mid.y - 38}px`}
            >
              {lod !== "far" && (
                <Container
                  data-testid={FlowCanvasTestId.FilePill}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    height: 20,
                    padding: "0 6px",
                    borderRadius: 6,
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    marginTop: -22,
                  }}
                >
                  {editing ? (
                    <GraphInlineInput
                      aria-label={t("handoffAria", { phase: label(c.node) })}
                      onChange={(e) =>
                        setGraph(
                          (g) => ({
                            ...g,
                            nodes: g.nodes.map((x) =>
                              x.id === c.node.id ? { ...x, produces: e.target.value } : x,
                            ),
                          }),
                          `produces-${c.node.id}`,
                        )
                      }
                      size={Math.max(c.node.produces.length, 6)}
                      value={c.node.produces}
                    />
                  ) : (
                    <Typography mono size="2xs" type="note" variant="tertiary">
                      {c.node.produces}
                    </Typography>
                  )}
                </Container>
              )}
              {(on || (editing && hovered) || selectedId === c.node.id) && (
                <Pressable
                  aria-label={t(on ? "checkpointOnAria" : "checkpointOffAria", {
                    phase: label(c.node),
                  })}
                  aria-pressed={on}
                  data-testid={FlowCanvasTestId.Checkpoint}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editing) onToggleCheckpoint(c.node.id);
                    else onSelect(c.node.id);
                  }}
                  title={t(on ? "checkpointOnTitle" : "checkpointOffTitle")}
                >
                  <Container
                    style={{
                      width: 22,
                      height: 22,
                      display: "grid",
                      placeItems: "center",
                      position: "relative",
                    }}
                  >
                    <Container
                      style={{
                        position: "absolute",
                        inset: 4,
                        transform: "rotate(45deg)",
                        borderRadius: 3,
                        background: on ? "var(--color-warn)" : "var(--color-background)",
                        border: on ? "none" : "1.5px dashed var(--color-ink-3)",
                        boxShadow: on ? "0 0 0 3px var(--color-background)" : "none",
                      }}
                    />
                    <span
                      // eslint-disable-next-line react/forbid-dom-props
                      style={{
                        position: "relative",
                        color: on ? "var(--color-accent-contrast)" : "var(--color-ink-3)",
                        display: "grid",
                      }}
                    >
                      <Icon name="checkpoint" size="xs" />
                    </span>
                  </Container>
                </Pressable>
              )}
              {editing && hovered && (
                <Pressable
                  aria-label={t("insertAria", { phase: label(c.node) })}
                  data-testid={FlowCanvasTestId.InsertHere}
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertAfter(c.node.id);
                  }}
                  title={t("insertTitle")}
                >
                  <Container
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "var(--color-sheet)",
                      border: "1px solid var(--color-ink-2)",
                    }}
                  >
                    <Icon name="plus" size="xs" />
                  </Container>
                </Pressable>
              )}
            </Container>
          );
        })}

        {loops.map((l) => {
          if (lod === "far") return null;
          const sel = loopOpenId === l.node.id;
          const ladder = l.loop.escalate || (l.loop.escalation?.length ?? 0) > 0;
          return (
            <Container
              data-nopan=""
              key={l.node.id}
              left={`${l.arc.mid.x}px`}
              position="absolute"
              style={{ transform: "translate(-50%,-50%)", zIndex: 6 }}
              top={`${l.arc.mid.y}px`}
            >
              <Pressable
                aria-label={t("loopPillAria", {
                  from: nodeName(l.node.id),
                  to: l.fail ? t("failRun") : nodeName(l.loop.to),
                  n: l.loop.maxRetries,
                })}
                aria-pressed={sel}
                data-testid={FlowCanvasTestId.LoopPill}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(l.node.id);
                  onLoopOpen(sel ? null : l.node.id);
                }}
              >
                <Container
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    height: 22,
                    padding: "0 8px",
                    borderRadius: 999,
                    background: "var(--color-background)",
                    border: `1px solid ${l.fail ? "color-mix(in srgb, var(--color-bad) 45%, transparent)" : sel ? "var(--color-ink)" : "var(--color-border-strong)"}`,
                    color: l.fail ? "var(--color-bad)" : "var(--color-ink-2)",
                    whiteSpace: "nowrap",
                    boxShadow: sel
                      ? "0 0 0 3px color-mix(in srgb, var(--color-ink) 12%, transparent)"
                      : "none",
                  }}
                >
                  <Icon name={l.fail ? "x" : "retry"} size="xs" />
                  <Typography mono size="2xs" type="note" weight="semibold">
                    {`${l.loop.maxRetries}×`}
                  </Typography>
                  {ladder && (
                    <span
                      aria-hidden="true"
                      // eslint-disable-next-line react/forbid-dom-props
                      style={{
                        display: "inline-flex",
                        alignItems: "flex-end",
                        gap: 1.5,
                        height: 10,
                      }}
                    >
                      {[4, 7, 10].map((h) => (
                        <i
                          key={h}
                          // eslint-disable-next-line react/forbid-dom-props
                          style={{
                            width: 2.5,
                            height: h,
                            borderRadius: 1,
                            background: "currentColor",
                          }}
                        />
                      ))}
                    </span>
                  )}
                </Container>
              </Pressable>
            </Container>
          );
        })}

        {loops
          .filter((l) => l.fail && l.term)
          .map((l) => (
            <Container
              data-testid={FlowCanvasTestId.FailTerminal}
              key={l.node.id}
              left={`${l.term!.x}px`}
              position="absolute"
              style={{
                width: l.term!.w,
                height: l.term!.h,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                color: "var(--color-bad)",
                border: "1px dashed color-mix(in srgb, var(--color-bad) 55%, transparent)",
                background: "color-mix(in srgb, var(--color-bad) 6%, var(--color-surface))",
                zIndex: 3,
              }}
              top={`${l.term!.y}px`}
            >
              <Icon name="x" size="xs" />
              <Typography size="xs" tone="bad" type="note" weight="semibold">
                {t("failRun")}
              </Typography>
            </Container>
          ))}

        {dropIdx !== null && (
          <Container
            data-testid={FlowCanvasTestId.DropCue}
            left={`${
              dropIdx === 0
                ? (placement.cards.get(order[0]?.id ?? "")?.x ?? 60) - 64
                : (placement.cards.get(order[dropIdx - 1]!.id)?.x ?? 0) + CARD_W + 64
            }px`}
            position="absolute"
            style={{
              width: 0,
              height: CARD_H + 40,
              borderLeft: "2px dashed var(--color-ink)",
              zIndex: 7,
            }}
            top={`${(placement.cards.get(order[0]?.id ?? "")?.y ?? 234) - 20}px`}
          />
        )}

        {order.length === 0 && (
          <Container
            data-testid={FlowCanvasTestId.Ghost}
            left="120px"
            position="absolute"
            style={{
              width: CARD_W + 24,
              height: CARD_H + 16,
              border: `1.5px dashed ${dropIdx !== null ? "var(--color-ink-2)" : "var(--color-border-strong)"}`,
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              color: "var(--color-ink-3)",
              textAlign: "center",
            }}
            top="232px"
          >
            <Icon name="plus" size="md" />
            <Typography size="sm" type="note" weight="semibold">
              {t("ghostTitle")}
            </Typography>
            <Typography size="xs" type="note" variant="tertiary">
              {editing ? t("ghostHint") : t("ghostReadOnly")}
            </Typography>
          </Container>
        )}
      </Container>

      {openLoop && popPos && (
        <Container
          aria-label={t("loopPopoverAria")}
          data-nopan=""
          data-testid={FlowCanvasTestId.LoopPopover}
          left={`${Math.max(8, Math.min(popPos.x - 170, size.w - 348))}px`}
          onClick={(e) => e.stopPropagation()}
          position="absolute"
          role="dialog"
          style={{
            width: 340,
            maxHeight: Math.max(240, size.h - popPos.y - 24),
            overflowY: "auto",
            background: "var(--color-sheet)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 12,
            boxShadow: "var(--shadow-elevated)",
            zIndex: 30,
          }}
          top={`${Math.min(popPos.y + 18, Math.max(8, size.h - 260))}px`}
        >
          <Stack gap="150" style={{ padding: 14 }}>
            <Stack align="center" direction="row" gap="75" justify="between">
              <Typography size="sm" type="note" weight="semibold">
                {t("loopTitle", {
                  from: nodeName(openLoop.node.id),
                  to: openLoop.fail ? t("failRun") : nodeName(openLoop.loop.to),
                })}
              </Typography>
              <Button
                aria-label={t("close")}
                icon="x"
                intent="ghost"
                onClick={() => onLoopOpen(null)}
                size="sm"
              />
            </Stack>
            <Container inert={!editing || undefined}>
              <LoopFields
                loop={openLoop.loop}
                onChange={(loop) => setGraph((g) => setLoop(g, openLoop.node.id, loop))}
                onRemove={() => {
                  setGraph((g) => setLoop(g, openLoop.node.id, null));
                  onLoopOpen(null);
                }}
                retryTargets={earlier(openLoop.node.id)}
                thenTargets={others(openLoop.node.id)}
              />
            </Container>
          </Stack>
        </Container>
      )}

      <Container
        aria-label={t("tools")}
        data-nopan=""
        left="12px"
        position="absolute"
        role="toolbar"
        style={{
          bottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: 3,
          borderRadius: 10,
          background: "var(--color-sheet)",
          border: "1px solid var(--color-border-strong)",
          zIndex: 8,
        }}
      >
        <Button
          aria-label={t("zoomOut")}
          data-testid={FlowCanvasTestId.ZoomOut}
          intent="ghost"
          onClick={() => zoomBy(1 / 1.2)}
          size="sm"
        >
          −
        </Button>
        <Typography
          mono
          aria-live="polite"
          data-testid={FlowCanvasTestId.Zoom}
          size="xs"
          type="note"
          variant="secondary"
        >
          {`${Math.round(clampZoom(view.zoom) * 100)}%`}
        </Typography>
        <Button
          aria-label={t("zoomIn")}
          data-testid={FlowCanvasTestId.ZoomIn}
          intent="ghost"
          onClick={() => zoomBy(1.2)}
          size="sm"
        >
          +
        </Button>
        <Button
          aria-label={t("fit")}
          data-testid={FlowCanvasTestId.Fit}
          icon="expand"
          intent="ghost"
          onClick={() => {
            touched.current = false;
            fit();
          }}
          size="sm"
          title={t("fit")}
        />
        {editing && (
          <>
            <Button
              aria-label={t("undo")}
              data-testid={FlowCanvasTestId.Undo}
              disabled={!canUndo}
              intent="ghost"
              onClick={undo}
              size="sm"
              title={t("undo")}
            >
              ↶
            </Button>
            <Button
              aria-label={t("redo")}
              data-testid={FlowCanvasTestId.Redo}
              disabled={!canRedo}
              intent="ghost"
              onClick={redo}
              size="sm"
              title={t("redo")}
            >
              ↷
            </Button>
          </>
        )}
      </Container>

      {order.length > 0 && size.w > 0 && (
        <Minimap
          bounds={bounds}
          onCenter={(w) => {
            touched.current = true;
            setView((v) => ({
              ...v,
              x: size.w / 2 - w.x * v.zoom,
              y: size.h / 2 - w.y * v.zoom,
            }));
          }}
          order={order.map((n) => placement.cards.get(n.id) ?? EMPTY)}
          orderIds={order.map((n) => n.id)}
          selectedId={selectedId}
          size={size}
          view={view}
        />
      )}
    </Container>
  );
}

const MM_W = 176;
const MM_H = 100;

function Minimap({
  bounds,
  order,
  orderIds,
  selectedId,
  size,
  view,
  onCenter,
}: {
  bounds: Rect;
  order: Rect[];
  orderIds: string[];
  selectedId: string | null;
  size: { w: number; h: number };
  view: View;
  onCenter: (world: Pt) => void;
}) {
  const t = useWdT("workflowDetail.canvas");
  const pad = 12;
  const s = Math.min(
    (MM_W - pad * 2) / Math.max(bounds.w, 1),
    (MM_H - pad * 2) / Math.max(bounds.h, 1),
  );
  const ox = (MM_W - bounds.w * s) / 2 - bounds.x * s;
  const oy = (MM_H - bounds.h * s) / 2 - bounds.y * s;
  const vp = {
    x: ox + (-view.x / view.zoom) * s,
    y: oy + (-view.y / view.zoom) * s,
    w: (size.w / view.zoom) * s,
    h: (size.h / view.zoom) * s,
  };
  return (
    <Container
      aria-label={t("minimap")}
      data-nopan=""
      data-testid={FlowCanvasTestId.Minimap}
      onClick={(e) => {
        e.stopPropagation();
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onCenter({ x: (e.clientX - r.left - ox) / s, y: (e.clientY - r.top - oy) / s });
      }}
      position="absolute"
      right="12px"
      role="img"
      style={{
        bottom: 12,
        width: MM_W,
        height: MM_H,
        borderRadius: 10,
        background: "var(--color-sheet)",
        border: "1px solid var(--color-border-strong)",
        overflow: "hidden",
        zIndex: 8,
        cursor: "pointer",
      }}
    >
      {order.map((r, i) => (
        <Container
          key={orderIds[i]}
          position="absolute"
          style={{
            left: ox + r.x * s,
            top: oy + r.y * s,
            width: r.w * s,
            height: r.h * s,
            borderRadius: 2,
            background: orderIds[i] === selectedId ? "var(--color-ink)" : "var(--color-ink-3)",
            opacity: orderIds[i] === selectedId ? 1 : 0.55,
          }}
        />
      ))}
      <Container
        position="absolute"
        style={{
          left: vp.x,
          top: vp.y,
          width: vp.w,
          height: vp.h,
          border: "1.5px solid var(--color-ink-2)",
          borderRadius: 3,
          background: "color-mix(in srgb, var(--color-ink) 5%, transparent)",
        }}
      />
    </Container>
  );
}
