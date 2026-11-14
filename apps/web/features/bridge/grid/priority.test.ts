import { describe, expect, it } from "vitest";
import type { BridgeWidget } from "./layout";
import { PRIORITY_WEIGHT, widgetScore, widgetTiers } from "./priority";

const w = (type: BridgeWidget["type"], x: number, y: number): BridgeWidget => ({
  id: type,
  type,
  x,
  y,
  w: 4,
  h: 6,
});

const layout = [
  w("briefing", 0, 0),
  w("prs", 0, 3),
  w("runs", 4, 3),
  w("proposals", 8, 3),
  w("issues", 0, 9),
  w("mentions", 4, 9),
  w("todo", 8, 9),
];

describe("widgetScore", () => {
  it("weighs you ×3 and adds the reported urgency", () => {
    expect(widgetScore({ you: 2, urgency: PRIORITY_WEIGHT.error })).toBe(8);
    expect(widgetScore(undefined)).toBe(0);
  });
});

describe("widgetTiers", () => {
  it("briefing is hero; top two scores are primary, other positive scores standard", () => {
    const tiers = widgetTiers(
      layout,
      { prs: { you: 2 }, runs: { urgency: 9 }, proposals: { urgency: 3 }, briefing: { you: 9 } },
      {},
    );
    expect(tiers).toMatchObject({
      briefing: "hero",
      runs: "primary",
      prs: "primary",
      proposals: "standard",
      issues: "ambient",
    });
  });

  it("breaks score ties by reading order", () => {
    const tiers = widgetTiers(
      layout,
      { issues: { you: 1 }, runs: { you: 1 }, prs: { you: 1 } },
      {},
    );
    expect(tiers).toMatchObject({ prs: "primary", runs: "primary", issues: "standard" });
  });

  it("collapses an empty widget with score 0, but not add-row widgets", () => {
    const tiers = widgetTiers(layout, {}, { mentions: true, todo: true, prs: true });
    expect(tiers).toMatchObject({ mentions: "collapsed", prs: "collapsed", todo: "ambient" });
  });

  it("the operator's toggle wins both ways", () => {
    const tiers = widgetTiers(
      layout,
      { prs: { you: 5 }, runs: { you: 1 }, issues: { you: 1 } },
      { mentions: true },
      { prs: true, mentions: false },
    );
    expect(tiers).toMatchObject({
      prs: "collapsed",
      mentions: "ambient",
      runs: "primary",
      issues: "primary",
    });
  });
});
