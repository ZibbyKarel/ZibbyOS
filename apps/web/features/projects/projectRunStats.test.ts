import { describe, expect, it } from "vitest";
import type { RunView } from "../runs/run";
import { projectRunStats } from "./projectRunStats";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const run = (projectId: string, status: string, hoursAgo: number) =>
  ({ projectId, status, startedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString() }) as RunView;

describe("projectRunStats", () => {
  it("counts 30d runs, success rate over finished runs, and the 24h pulse", () => {
    const s = projectRunStats(
      [
        run("a", "done", 1),
        run("a", "error", 2),
        run("a", "done", 3),
        run("a", "running", 0.5),
        run("b", "done", 1),
        run("a", "done", 24 * 40),
      ],
      "a",
      NOW,
    );
    expect(s.runs30d).toBe(4);
    expect(s.successPct).toBe(67);
    expect(s.runs24h).toBe(4);
    expect(s.running).toBe(1);
    expect(s.pulse24h[23]).toBe(1);
    expect(s.pulse24h[22]).toBe(1);
    expect(s.pulse24h).toHaveLength(24);
  });

  it("success is null with nothing finished", () => {
    expect(projectRunStats([run("a", "running", 1)], "a", NOW).successPct).toBeNull();
  });
});
