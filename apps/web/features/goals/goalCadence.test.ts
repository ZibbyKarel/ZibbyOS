import { describe, expect, it } from "vitest";
import { nextCycleStart } from "./goalCadence";

const next = (every: "day" | "weekday" | "week" | "month", hour: number, from: string) =>
  nextCycleStart({ every, hour }, new Date(from))?.toISOString();

describe("nextCycleStart (Europe/Prague)", () => {
  it("day: later today, else tomorrow", () => {
    expect(next("day", 9, "2026-11-26T07:00:00Z")).toBe("2026-11-26T08:00:00.000Z");
    expect(next("day", 9, "2026-11-26T09:00:00Z")).toBe("2026-11-27T08:00:00.000Z");
  });
  it("weekday skips the weekend; week = Monday; month = the 1st", () => {
    expect(next("weekday", 9, "2026-11-27T10:00:00Z")).toBe("2026-11-30T08:00:00.000Z");
    expect(next("week", 9, "2026-11-26T10:00:00Z")).toBe("2026-11-30T08:00:00.000Z");
    expect(next("month", 9, "2026-11-26T10:00:00Z")).toBe("2026-12-01T08:00:00.000Z");
  });
  it("week with weekday: Sunday 17:00 Prague", () => {
    const sunday = (from: string) =>
      nextCycleStart({ every: "week", hour: 17, weekday: 0 }, new Date(from))?.toISOString();
    expect(sunday("2026-11-25T12:00:00Z")).toBe("2026-11-29T16:00:00.000Z");
    expect(sunday("2026-03-25T12:00:00Z")).toBe("2026-03-29T15:00:00.000Z");
    expect(sunday("2026-10-21T12:00:00Z")).toBe("2026-10-25T16:00:00.000Z");
  });
  it("follows the summer offset", () => {
    expect(next("day", 9, "2026-07-01T00:00:00Z")).toBe("2026-07-01T07:00:00.000Z");
  });
});
