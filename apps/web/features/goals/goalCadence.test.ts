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
  it("follows the summer offset", () => {
    expect(next("day", 9, "2026-07-01T00:00:00Z")).toBe("2026-07-01T07:00:00.000Z");
  });
});
