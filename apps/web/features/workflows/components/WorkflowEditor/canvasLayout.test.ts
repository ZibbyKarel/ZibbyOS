import { describe, expect, it } from "vitest";
import type { GraphNode } from "../WorkflowDialog/workflow-graph";
import {
  BRANCH_GAP,
  CARD_H,
  CARD_W,
  GAP_X,
  PAD_X,
  ROW_CY,
  arcClearance,
  clampZoom,
  contentBounds,
  fitView,
  insertIndexAt,
  leftPort,
  lodFor,
  loopArc,
  placeChain,
  rightPort,
  toScreen,
  toWorld,
  zoomAt,
} from "./canvasLayout";

const node = (id: string): GraphNode => ({
  id,
  type: "agent",
  agent: "a",
  produces: `${id}.md`,
  commands: "",
  model: "sonnet",
  thinking: "medium",
  x: 0,
  y: 0,
});
const order = ["a", "b", "c"].map(node);

describe("canvasLayout", () => {
  it("lays cards out left to right and adds a delivery end node or a stub", () => {
    const withEnd = placeChain(order, true);
    expect(withEnd.cards.get("b")?.x).toBe(PAD_X + CARD_W + GAP_X);
    expect(withEnd.end).toBeDefined();
    expect(withEnd.stub).toBeUndefined();
    const bare = placeChain(order, false);
    expect(bare.end).toBeUndefined();
    expect(bare.stub).toBeDefined();
  });

  it("maps a world x to the chain slot it would insert at", () => {
    const p = placeChain(order, false);
    expect(insertIndexAt(p, order, 0)).toBe(0);
    expect(insertIndexAt(p, order, PAD_X + CARD_W + 4)).toBe(1);
    expect(insertIndexAt(p, order, 99999)).toBe(3);
  });

  it("fits content into the viewport without zooming past 1x", () => {
    const v = fitView({ x: 0, y: 0, w: 4000, h: 400 }, 1000, 600);
    expect(v.zoom).toBeLessThan(1);
    expect(fitView({ x: 0, y: 0, w: 100, h: 100 }, 1000, 600).zoom).toBe(1);
  });

  it("keeps a readable minimum zoom and left-aligns an overflowing flow", () => {
    const v = fitView({ x: 0, y: 0, w: 4000, h: 400 }, 1000, 600, 72, 0.8);
    expect(v.zoom).toBe(0.8);
    expect(v.x).toBe(72);
  });

  it("zooms around an anchor and round-trips world/screen points", () => {
    const v = zoomAt({ x: 10, y: 20, zoom: 1 }, 2, { x: 200, y: 100 });
    expect(toWorld(v, toScreen(v, { x: 33, y: 44 }))).toEqual({ x: 33, y: 44 });
    // the world point under the anchor stays put
    expect(toScreen(v, toWorld({ x: 10, y: 20, zoom: 1 }, { x: 200, y: 100 }))).toEqual({
      x: 200,
      y: 100,
    });
    expect(clampZoom(99)).toBeLessThan(99);
  });

  it("raises wider loop arcs higher and collapses detail with zoom", () => {
    const near = loopArc({ x: 300, y: 200 }, { x: 100, y: 200 }, 1);
    const far = loopArc({ x: 600, y: 200 }, { x: 100, y: 200 }, 3);
    expect(far.mid.y).toBeLessThan(near.mid.y);
    expect([lodFor(1), lodFor(0.5), lodFor(0.3)]).toEqual(["full", "mid", "far"]);
  });
});

const fork = (id: string, n: number): GraphNode => ({
  ...node(id),
  type: "parallel",
  agent: "",
  branches: Array.from({ length: n }, (_, i) => ({ id: `b${i}`, workflow: `wf-${i}` })),
});

describe.each([2, 4])("parallel fork with %i branches", (n) => {
  const chain = [node("a"), fork("f", n), node("z")];
  const p = placeChain(chain, false);
  const col = p.cards.get("f")!;
  const bs = p.branches.get("f")!;

  it("stacks the branches vertically, centred on the row, in the fork's own column", () => {
    expect(bs).toHaveLength(n);
    expect(col.h).toBe(n * CARD_H + (n - 1) * BRANCH_GAP);
    expect(col.y + col.h / 2).toBe(ROW_CY);
    bs.forEach((b, i) => {
      expect(b.x).toBe(col.x);
      expect(b.y).toBe(col.y + i * (CARD_H + BRANCH_GAP));
    });
    expect(bs[0]!.y).toBe(col.y);
    expect(bs[n - 1]!.y + CARD_H).toBe(col.y + col.h);
  });

  it("keeps neighbours on the single row and joins edges at their centre ports", () => {
    expect(p.cards.get("z")!.x).toBe(col.x + CARD_W + GAP_X);
    expect(p.cards.get("a")!.y + CARD_H / 2).toBe(ROW_CY);
    expect(p.branches.has("a")).toBe(false);
    // fan-out / join ports sit at every branch's mid-height
    expect(bs.map((b) => leftPort(b).y)).toEqual(bs.map((b) => b.y + CARD_H / 2));
    expect(rightPort(bs[0]!).x).toBe(col.x + CARD_W);
  });

  it("grows the content bounds to the whole stack", () => {
    const b = contentBounds(p, [], chain, chain);
    expect(b.y).toBe(col.y);
    expect(b.h).toBe(col.h);
  });

  it("lifts a loop arc over the tall fork column it spans", () => {
    const chain2 = [node("a"), fork("f", n), node("z")];
    const p2 = placeChain(chain2, false);
    const lift = arcClearance(p2, chain2, 2, 0);
    expect(lift).toBe(p2.cards.get("z")!.y - p2.cards.get("f")!.y);
    expect(arcClearance(placeChain(order, false), order, 2, 0)).toBe(0);
    const arc = loopArc({ x: 0, y: 232 }, { x: 0, y: 232 }, 2, lift);
    expect(arc.mid.y).toBeLessThan(col.y);
  });
});
