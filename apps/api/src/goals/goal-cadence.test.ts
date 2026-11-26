import { describe, expect, it } from "vitest";
import { latestCycleStart, nextCycleStart } from "./goal-cadence";

const at = (iso: string) => new Date(iso);
const next = (every: "day" | "weekday" | "week" | "month", hour: number, from: string) =>
  nextCycleStart({ every, hour }, at(from)).toISOString();

describe("nextCycleStart (Europe/Prague)", () => {
  it("day: today's hour when still ahead, else tomorrow; strictly after `from`", () => {
    expect(next("day", 9, "2026-11-26T07:00:00.000Z")).toBe("2026-11-26T08:00:00.000Z");
    expect(next("day", 9, "2026-11-26T08:00:00.000Z")).toBe("2026-11-27T08:00:00.000Z");
  });

  it("weekday skips Saturday and Sunday", () => {
    // Friday 10:00 CET → Monday 09:00 CET.
    expect(next("weekday", 9, "2026-11-27T09:00:00.000Z")).toBe("2026-11-30T08:00:00.000Z");
  });

  it("week = Monday, month = the 1st", () => {
    expect(next("week", 9, "2026-11-25T12:00:00.000Z")).toBe("2026-11-30T08:00:00.000Z");
    expect(next("month", 9, "2026-11-26T12:00:00.000Z")).toBe("2026-12-01T08:00:00.000Z");
  });

  it("uses summer time in summer", () => {
    expect(next("day", 9, "2026-07-01T00:00:00.000Z")).toBe("2026-07-01T07:00:00.000Z");
  });

  it("spring DST: the skipped 02:00 resolves to one boundary that day", () => {
    const first = next("day", 2, "2026-03-28T12:00:00.000Z");
    expect(first).toBe("2026-03-29T01:00:00.000Z"); // 03:00 CEST
    expect(next("day", 2, first)).toBe("2026-03-30T00:00:00.000Z"); // 02:00 CEST
  });

  it("autumn DST: the doubled 02:00 is one boundary, not two", () => {
    const first = next("day", 2, "2026-10-24T12:00:00.000Z");
    expect(first.startsWith("2026-10-25T0")).toBe(true);
    expect(next("day", 2, first)).toBe("2026-10-26T01:00:00.000Z"); // 02:00 CET
  });
});

describe("latestCycleStart", () => {
  it("anchors one cycle at the latest boundary passed, or null", () => {
    const cadence = { every: "day" as const, hour: 9 };
    expect(
      latestCycleStart(
        cadence,
        at("2026-11-20T08:00:00.000Z"),
        at("2026-11-26T10:00:00.000Z"),
      )?.toISOString(),
    ).toBe("2026-11-26T08:00:00.000Z");
    expect(
      latestCycleStart(cadence, at("2026-11-26T08:00:00.000Z"), at("2026-11-26T10:00:00.000Z")),
    ).toBeNull();
  });
});
