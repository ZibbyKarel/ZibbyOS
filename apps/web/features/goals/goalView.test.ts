import { describe, expect, it } from "vitest";
import { GOAL_PRESETS, type GoalTimelineEvent } from "@zibby/contracts";
import {
  goalMatchesFilter,
  goalScheduleLabel,
  goalScopeLabel,
  goalStatusTone,
  groupPresets,
  groupTimelineByCycle,
  instanceStatusTone,
  presetToCreateBody,
} from "./goalView";

const names = {
  projectName: (id: string) => `P:${id}`,
  companyName: (id: string) => `C:${id}`,
};

describe("goalScopeLabel", () => {
  it("describes every scope kind", () => {
    expect(goalScopeLabel({ kind: "none" }, names)).toEqual({ key: "scope.none" });
    expect(goalScopeLabel({ kind: "all" }, names)).toEqual({ key: "scope.all" });
    expect(goalScopeLabel({ kind: "company", companyId: "acme" }, names)).toEqual({
      key: "scope.company",
      values: { name: "C:acme" },
    });
    expect(goalScopeLabel({ kind: "projects", projectIds: ["a", "b"] }, names)).toEqual({
      key: "scope.projects",
      values: { names: "P:a, P:b" },
    });
  });
});

describe("goalScheduleLabel", () => {
  it("reads a standing goal as its cadence, hour zero-padded", () => {
    expect(goalScheduleLabel({ cadence: { every: "weekday", hour: 9 } }, "cs")).toEqual({
      key: "schedule.weekday",
      values: { hour: "09" },
    });
  });

  it("reads a one-off goal as its deadline in Prague time", () => {
    const label = goalScheduleLabel({ deadline: "2026-12-01T11:30:00.000Z" }, "en");
    expect(label.key).toBe("schedule.deadline");
    expect(label.values?.date).toContain("12:30");
  });

  it("reads a goal with neither as open-ended", () => {
    expect(goalScheduleLabel({}, "cs")).toEqual({ key: "schedule.open" });
  });
});

describe("status tones", () => {
  it("makes needs-you and parked the amber ones, paused the grey one", () => {
    expect(goalStatusTone("needs-you")).toBe("wait");
    expect(goalStatusTone("paused")).toBe("off");
    expect(goalStatusTone("done")).toBe("ok");
    expect(instanceStatusTone("parked")).toBe("wait");
    expect(instanceStatusTone("planning")).toBe("info");
  });
});

describe("goalMatchesFilter", () => {
  it("groups planning, acting and waiting as active", () => {
    expect(goalMatchesFilter("acting", "active")).toBe(true);
    expect(goalMatchesFilter("waiting", "active")).toBe(true);
    expect(goalMatchesFilter("needs-you", "active")).toBe(false);
    expect(goalMatchesFilter("paused", "paused")).toBe(true);
    expect(goalMatchesFilter("done", "all")).toBe(true);
  });
});

describe("presets", () => {
  it("groups all presets in the display order", () => {
    const groups = groupPresets(GOAL_PRESETS);
    expect(groups.map((g) => g.group)).toEqual(["pr-ci", "maintenance", "brain", "directional"]);
    expect(groups.reduce((n, g) => n + g.presets.length, 0)).toBe(GOAL_PRESETS.length);
  });

  it("drops the UI-only group from the create body and keeps it paused", () => {
    const [first] = GOAL_PRESETS;
    if (!first) throw new Error("no presets");
    const body = presetToCreateBody(first);
    expect(body).not.toHaveProperty("group");
    expect(body.enabled).toBe(false);
    expect(body.id).toBe(first.id);
  });
});

describe("groupTimelineByCycle", () => {
  const ev = (cycle: number, text: string): GoalTimelineEvent => ({
    at: "2026-11-26T10:00:00.000Z",
    cycle,
    instance: "_",
    kind: "note",
    text,
  });

  it("puts the newest cycle first and keeps event order inside a cycle", () => {
    const groups = groupTimelineByCycle([ev(0, "a"), ev(1, "b"), ev(0, "c")]);
    expect(groups.map((g) => g.cycle)).toEqual([1, 0]);
    expect(groups[1]?.events.map((e) => e.text)).toEqual(["a", "c"]);
  });

  it("is empty for no events", () => {
    expect(groupTimelineByCycle([])).toEqual([]);
  });
});
