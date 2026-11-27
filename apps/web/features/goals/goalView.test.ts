import { describe, expect, it } from "vitest";
import { GOAL_PRESETS, type GoalTimelineEvent, type GoalWithRollup } from "@zibby/contracts";
import {
  decisionsThisMonth,
  goalCardModel,
  goalCycles,
  goalEventMark,
  goalMatchesFilter,
  goalScheduleLabel,
  goalScopeLabel,
  goalStatusTone,
  goalUpcoming,
  groupPresets,
  groupTimelineByCycle,
  instanceStatusTone,
  percentOf,
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

  it("puts the newest cycle first and the newest event first inside a cycle", () => {
    const groups = groupTimelineByCycle([ev(0, "a"), ev(1, "b"), ev(0, "c")]);
    expect(groups.map((g) => g.cycle)).toEqual([1, 0]);
    expect(groups[1]?.events.map((e) => e.text)).toEqual(["c", "a"]);
  });

  it("is empty for no events", () => {
    expect(groupTimelineByCycle([])).toEqual([]);
  });
});

describe("goalCardModel", () => {
  const goal: GoalWithRollup = {
    id: "my-prs",
    name: "Moje PR",
    outcome: "Zelené.",
    scope: { kind: "projects", projectIds: ["a", "b"] },
    cadence: { every: "weekday", hour: 9 },
    ceiling: "tier2",
    enabled: true,
    createdAt: "2026-11-26T10:00:00.000Z",
    updatedAt: "2026-11-26T10:00:00.000Z",
    rollup: { status: "acting", counts: { total: 3, done: 1, parked: 0, active: 2 }, needsYou: 0 },
  };
  const event: GoalTimelineEvent = {
    at: "2026-11-26T11:30:00.000Z",
    cycle: 0,
    instance: "a",
    kind: "note",
    text: "Opened PR #4",
  };
  const withStatus = (
    status: GoalWithRollup["rollup"]["status"],
    patch: Partial<GoalWithRollup> = {},
  ): GoalWithRollup => ({ ...goal, ...patch, rollup: { ...goal.rollup, status } });

  it("fills the ring with done of total projects", () => {
    const m = goalCardModel(goal, undefined, names, "cs");
    expect(m).toMatchObject({ used: 1, max: 3, ringValue: undefined });
    expect(m.ringCaption).toEqual({ key: "card.ringOf", values: { count: 3 } });
    expect(m.ringAria).toEqual({ key: "card.ringAria", values: { done: 1, total: 3 } });
  });

  it("reads a scope-none goal as a plain 'of N' (no 'projects'), and no instances as not run yet", () => {
    const none = { ...goal, scope: { kind: "none" as const } };
    expect(goalCardModel(none, undefined, names, "cs").ringCaption).toEqual({
      key: "card.ringOfCount",
      values: { count: 3 },
    });
    expect(goalCardModel(none, undefined, names, "cs").ringAria).toEqual({
      key: "card.ringAriaCount",
      values: { done: 1, total: 3 },
    });
    const fresh = {
      ...goal,
      rollup: { ...goal.rollup, counts: { total: 0, done: 0, parked: 0, active: 0 } },
    };
    const m = goalCardModel(fresh, undefined, names, "cs");
    expect(m).toMatchObject({ used: 0, max: 1, ringValue: "–" });
    expect(m.ringCaption).toEqual({ key: "card.notRun" });
    expect(m.ringAria).toEqual({ key: "card.notRun" });
  });

  it("maps roll-up status to ring tone, verdict tone and actions", () => {
    const pick = (s: GoalWithRollup["rollup"]["status"], enabled = true) => {
      const m = goalCardModel(withStatus(s, { enabled }), [event], names, "cs");
      return [m.state, m.verdictTone, m.actions, m.verdict?.status?.key];
    };
    expect(pick("needs-you")).toEqual(["blocked", "blocked", "decide", "card.needsYou"]);
    expect(pick("acting")).toEqual(["working", "idle", "wake-pause", undefined]);
    expect(pick("planning")).toEqual(["working", "idle", "wake-pause", undefined]);
    expect(pick("waiting")).toEqual(["thinking", "idle", "wake-pause", undefined]);
    expect(pick("done")).toEqual(["done", "done", "wake-pause", undefined]);
    expect(pick("paused", false)).toEqual(["idle", "idle", "enable", undefined]);
  });

  it("uses the schedule as top meta and scope, ceiling and loop as parties", () => {
    const m = goalCardModel({ ...goal, loop: { loopId: "fixer" } }, undefined, names, "cs");
    expect(m.topMeta).toEqual({ key: "schedule.weekday", values: { hour: "09" } });
    expect(m.parties).toEqual([
      {
        role: { key: "card.role.scope" },
        name: { key: "scope.projects", values: { names: "P:a, P:b" } },
      },
      { role: { key: "card.role.ceiling" }, name: { key: "ceiling.tier2" } },
      { role: { key: "card.role.loop" }, name: "fixer" },
    ]);
    expect(goalCardModel(goal, undefined, names, "cs").parties).toHaveLength(2);
  });

  it("shows the newest timeline event, a no-events box, or nothing while not loaded", () => {
    const older = { ...event, at: "2026-11-26T09:00:00.000Z", text: "old" };
    const m = goalCardModel(goal, [older, event], names, "en");
    expect(m.verdict?.head.key).toBe("card.lastStep");
    expect(String(m.verdict?.head.values?.date)).toContain("12:30");
    expect(m.verdict?.text).toBe("Opened PR #4");
    expect(goalCardModel(goal, [], names, "cs").verdict).toEqual({
      head: { key: "card.noEvents" },
      text: { key: "card.noEventsText" },
    });
    expect(goalCardModel(goal, undefined, names, "cs").verdict).toBeUndefined();
  });

  it("fills the whole ring when every project is done", () => {
    const all = {
      ...withStatus("done"),
      rollup: {
        status: "done" as const,
        counts: { total: 3, done: 3, parked: 0, active: 0 },
        needsYou: 0,
      },
    };
    const m = goalCardModel(all, [event], names, "cs");
    expect(m).toMatchObject({ state: "done", used: 3, max: 3, verdictTone: "done" });
    expect(m.ringAria).toEqual({ key: "card.ringAria", values: { done: 3, total: 3 } });
  });

  it("keeps a paused goal paused even when an instance is parked", () => {
    const paused: GoalWithRollup = {
      ...goal,
      enabled: false,
      rollup: {
        status: "paused",
        counts: { total: 2, done: 0, parked: 1, active: 1 },
        needsYou: 1,
      },
    };
    const m = goalCardModel(paused, [event], names, "cs");
    expect(m).toMatchObject({ state: "idle", verdictTone: "idle", actions: "enable" });
    expect(m.verdict?.status).toBeUndefined();
  });
});

describe("goalUpcoming", () => {
  const state = {
    goalId: "g",
    cycle: { index: 0, startedAt: "2026-11-26T08:00:00.000Z" },
    instances: {},
    decisionsThisMonth: { month: "2026-11", count: 0 },
    nudges: {},
  };
  const now = Date.parse("2026-11-26T10:00:00.000Z");

  it("claims the next cycle only for an enabled standing goal with a loaded state", () => {
    const cadence = { every: "day" as const, hour: 9 };
    expect(goalUpcoming({ cadence, enabled: true }, state, now).nextCycleAt).not.toBeNull();
    expect(goalUpcoming({ cadence, enabled: false }, state, now).nextCycleAt).toBeNull();
    expect(goalUpcoming({ cadence, enabled: true }, undefined, now).nextCycleAt).toBeNull();
  });

  it("prefers the cycle's deadline over the goal's", () => {
    const deadline = "2026-12-01T10:00:00.000Z";
    expect(goalUpcoming({ deadline, enabled: true }, state, now).deadlineAt).toBe(deadline);
    const withCycle = {
      ...state,
      cycle: { ...state.cycle, deadlineAt: "2026-11-30T10:00:00.000Z" },
    };
    expect(goalUpcoming({ deadline, enabled: true }, withCycle, now).deadlineAt).toBe(
      "2026-11-30T10:00:00.000Z",
    );
  });
});

describe("decisionsThisMonth", () => {
  const now = Date.parse("2026-11-26T10:00:00.000Z");
  it("counts only the current Prague month", () => {
    expect(decisionsThisMonth({ month: "2026-11", count: 3 }, now)).toBe(3);
    expect(decisionsThisMonth({ month: "2026-10", count: 3 }, now)).toBe(0);
    expect(decisionsThisMonth(undefined, now)).toBe(0);
  });
});

describe("goalCycles", () => {
  const ev = (cycle: number, kind: string, at: string): GoalTimelineEvent => ({
    at,
    cycle,
    instance: "a",
    kind,
    text: kind,
  });
  const events = [
    ev(0, "note", "2026-11-24T08:00:00.000Z"),
    ev(0, "parked", "2026-11-24T09:00:00.000Z"),
    ev(1, "done", "2026-11-25T09:00:00.000Z"),
    ev(2, "note", "2026-11-26T09:00:00.000Z"),
  ];

  it("orders cycles newest first and tones past ones by their outcome", () => {
    const cycles = goalCycles(events, 2, "acting");
    expect(cycles.map((c) => [c.index, c.tone])).toEqual([
      [2, "run"],
      [1, "ok"],
      [0, "bad"],
    ]);
    expect(cycles[2]!.from).toBe("2026-11-24T08:00:00.000Z");
    expect(cycles[2]!.to).toBe("2026-11-24T09:00:00.000Z");
  });

  it("the live cycle takes the roll-up", () => {
    expect(goalCycles(events, 2, "needs-you")[0]!.tone).toBe("paused");
    expect(goalCycles(events, 2, "paused")[0]!.tone).toBe("idle");
    expect(goalCycles(events, undefined, undefined)[0]!.tone).toBe("idle");
  });
});

describe("goalEventMark / percentOf", () => {
  it("marks known kinds and keeps unknown ones neutral", () => {
    expect(goalEventMark("done")).toEqual({ icon: "check", tone: "ok" });
    expect(goalEventMark("parked")).toEqual({ icon: "warn", tone: "bad" });
    expect(goalEventMark("whatever")).toEqual({ icon: "doc", tone: "neutral" });
  });

  it("clamps the percentage and reads 0 without a cap", () => {
    expect(percentOf(3, 4)).toBe(75);
    expect(percentOf(9, 4)).toBe(100);
    expect(percentOf(3, 0)).toBe(0);
  });
});
