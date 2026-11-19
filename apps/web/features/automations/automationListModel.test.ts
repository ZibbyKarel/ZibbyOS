import { describe, expect, it } from "vitest";
import type { Automation } from "@zibby/contracts";
import { automationMatches, fireDots, nextRunMs, timelinePosition } from "./automationListModel";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const base = {
  id: "daily",
  name: "Ranní briefing",
  trigger: { type: "cron", expr: "0 8 * * *" },
  target: { type: "briefing" },
  enabled: true,
  system: false,
} as Automation;

describe("timelinePosition", () => {
  it("places now between last and next", () => {
    expect(timelinePosition(0, 100, 25)).toBe(25);
    expect(timelinePosition(0, 100, 250)).toBe(100);
  });
  it("is undefined without both ends", () => {
    expect(timelinePosition(null, 100, 25)).toBeUndefined();
    expect(timelinePosition(0, null, 25)).toBeUndefined();
    expect(timelinePosition(50, 50, 50)).toBeUndefined();
  });
});

describe("fireDots", () => {
  it("keeps the last 7 days, oldest first", () => {
    const day = 86_400_000;
    const dots = fireDots(
      [
        { startedAt: new Date(NOW - 1 * day).toISOString() },
        { startedAt: new Date(NOW - 6 * day).toISOString() },
        { startedAt: new Date(NOW - 9 * day).toISOString() },
      ],
      NOW,
    );
    expect(dots).toHaveLength(2);
    expect(dots[0]).toBeLessThan(dots[1] ?? 0);
  });
});

describe("nextRunMs / automationMatches", () => {
  it("has no next run when disabled or not cron", () => {
    expect(nextRunMs({ ...base, enabled: false }, new Date(NOW))).toBeNull();
    expect(
      nextRunMs({ ...base, trigger: { type: "event", events: ["pr.opened"] } }, new Date(NOW)),
    ).toBeNull();
    expect(nextRunMs(base, new Date(NOW))).toBeGreaterThan(NOW);
  });
  it("filters by state and text", () => {
    expect(automationMatches(base, "off", "")).toBe(false);
    expect(automationMatches(base, "on", "ranní")).toBe(true);
    expect(automationMatches(base, "all", "zzz")).toBe(false);
  });
});
