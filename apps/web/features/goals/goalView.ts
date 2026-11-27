import type {
  Goal,
  GoalCadence,
  GoalCeiling,
  GoalInstanceStatus,
  GoalPreset,
  GoalRollupStatus,
  GoalScope,
  GoalState,
  GoalTimelineEvent,
  GoalWithRollup,
} from "@zibby/contracts";
import { nextCycleStart } from "./goalCadence";

/** A catalog key plus ICU values — the component translates it, so this file stays free of next-intl. */
export interface GoalLabel {
  key:
    | "scope.none"
    | "scope.all"
    | "scope.company"
    | "scope.projects"
    | `schedule.${GoalCadence["every"]}`
    | "schedule.deadline"
    | "schedule.open"
    | `ceiling.${GoalCeiling}`
    | "card.ringOf"
    | "card.ringOfCount"
    | "card.ringAria"
    | "card.ringAriaCount"
    | "card.notRun"
    | "card.role.scope"
    | "card.role.ceiling"
    | "card.role.loop"
    | "card.lastStep"
    | "card.needsYou"
    | "card.heldReason"
    | "card.noEvents"
    | "card.noEventsText";
  values?: Record<string, string | number>;
}

export type GoalStatusTone = "ok" | "wait" | "off" | "err" | "info";

/** Instance status pill tone: parked is the one that asks for the operator. */
export function instanceStatusTone(status: GoalInstanceStatus): GoalStatusTone {
  switch (status) {
    case "parked":
      return "wait";
    case "done":
    case "acting":
      return "ok";
    case "planning":
    case "waiting":
      return "info";
  }
}

/**
 * A ts-rest query error is the thrown non-2xx response (`{ status, body }`); a 404 means the goal
 * is gone — a state to render, not a failure to retry.
 */
export const isGoalNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "status" in error && error.status === 404;

/** Date and time in Prague, the zone every goal schedule is expressed in. */
export function formatGoalDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(new Date(iso));
}

export interface GoalNames {
  projectName: (id: string) => string;
  companyName: (id: string) => string;
}

/** Where the goal applies, as a label descriptor (`scope.*` keys). */
export function goalScopeLabel(scope: GoalScope, names: GoalNames): GoalLabel {
  switch (scope.kind) {
    case "none":
      return { key: "scope.none" };
    case "all":
      return { key: "scope.all" };
    case "company":
      return { key: "scope.company", values: { name: names.companyName(scope.companyId) } };
    case "projects":
      return {
        key: "scope.projects",
        values: { names: scope.projectIds.map(names.projectName).join(", ") },
      };
  }
}

/** One-off goals read as their deadline, standing ones as their cadence (`schedule.*` keys). */
export function goalScheduleLabel(
  goal: Pick<Goal, "deadline" | "cadence">,
  locale: string,
): GoalLabel {
  if (goal.cadence) {
    return {
      key: `schedule.${goal.cadence.every}`,
      values: { hour: String(goal.cadence.hour).padStart(2, "0") },
    };
  }
  if (goal.deadline) {
    return {
      key: "schedule.deadline",
      values: { date: formatGoalDateTime(goal.deadline, locale) },
    };
  }
  return { key: "schedule.open" };
}

export type GoalFilter = "all" | "needs-you" | "active" | "paused" | "done";

export const GOAL_FILTERS: readonly GoalFilter[] = ["all", "needs-you", "active", "paused", "done"];

export function goalMatchesFilter(status: GoalRollupStatus, filter: GoalFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return status === "planning" || status === "acting" || status === "waiting";
    // Held is calm like paused: nothing starts on its own.
    case "paused":
      return status === "paused" || status === "held";
    default:
      return status === filter;
  }
}

export const GOAL_PRESET_GROUP_ORDER: readonly GoalPreset["group"][] = [
  "pr-ci",
  "maintenance",
  "brain",
  "directional",
];

/** Presets bucketed by group, in display order, empty groups dropped. */
export function groupPresets(
  presets: readonly GoalPreset[],
): Array<{ group: GoalPreset["group"]; presets: GoalPreset[] }> {
  return GOAL_PRESET_GROUP_ORDER.map((group) => ({
    group,
    presets: presets.filter((p) => p.group === group),
  })).filter((g) => g.presets.length > 0);
}

/** The create body for a preset: everything but the UI-only `group`. */
export function presetToCreateBody(preset: GoalPreset): Omit<GoalPreset, "group"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose
  const { group: _group, ...body } = preset;
  return body;
}

/** Timeline events (fed oldest-first) grouped by cycle, newest cycle first and newest event first inside a cycle. */
export function groupTimelineByCycle(
  events: readonly GoalTimelineEvent[],
): Array<{ cycle: number; events: GoalTimelineEvent[] }> {
  const byCycle = new Map<number, GoalTimelineEvent[]>();
  for (const e of events) byCycle.set(e.cycle, [...(byCycle.get(e.cycle) ?? []), e]);
  return [...byCycle.entries()]
    .sort(([a], [b]) => b - a)
    .map(([cycle, list]) => ({ cycle, events: list.reverse() }));
}

/** The DS `StateTone` subset the goal card uses (kept local: this file stays free of the DS). */
export type GoalCardState = "working" | "thinking" | "blocked" | "done" | "idle";

export interface GoalCardModel {
  state: GoalCardState;
  used: number;
  max: number;
  /** `"–"` before the goal has any instance; absent = the ring shows `used`. */
  ringValue?: string;
  ringCaption: GoalLabel;
  ringAria: GoalLabel;
  topMeta: GoalLabel;
  /** A party name is a label, or a raw id (the loop). */
  parties: Array<{ role: GoalLabel; name: GoalLabel | string }>;
  /** Absent while the timeline is not loaded (or failed): no box rather than a faked one. */
  verdict?: { head: GoalLabel; status?: GoalLabel; text: GoalLabel | string };
  verdictTone: "idle" | "blocked" | "done";
  /** `decide` opens the detail page, `wake-pause` wakes or pauses, `enable` switches it on. */
  actions: "decide" | "wake-pause" | "enable";
}

/** Roll-up → DS state tone; the goal card, the detail hero pill and the widget read this. */
export const GOAL_CARD_STATE: Record<GoalRollupStatus, GoalCardState> = {
  // Calm: nothing runs, so no pulse.
  held: "idle",
  "needs-you": "blocked",
  acting: "working",
  planning: "working",
  // Waiting on something (it wakes itself): the info tone, apart from a switched-off goal.
  waiting: "thinking",
  done: "done",
  paused: "idle",
};

/**
 * The list/widget goal card from a mandate: ring = done of total projects, pill tone by roll-up,
 * schedule top-right, scope/ceiling/loop as parties, the newest timeline event as the verdict.
 * `timeline` is the events newest-last, or `undefined` while loading or failed.
 */
export function goalCardModel(
  goal: GoalWithRollup,
  timeline: readonly GoalTimelineEvent[] | undefined,
  names: GoalNames,
  locale: string,
): GoalCardModel {
  const { counts } = goal.rollup;
  const status = goal.rollup.status;
  const ran = counts.total > 0;
  const parties: GoalCardModel["parties"] = [
    { role: { key: "card.role.scope" }, name: goalScopeLabel(goal.scope, names) },
    { role: { key: "card.role.ceiling" }, name: { key: `ceiling.${goal.ceiling}` } },
  ];
  if (goal.loop) parties.push({ role: { key: "card.role.loop" }, name: goal.loop.loopId });

  const latest = timeline?.at(-1);
  const verdict: GoalCardModel["verdict"] = !timeline
    ? undefined
    : latest
      ? {
          head: { key: "card.lastStep", values: { date: formatGoalDateTime(latest.at, locale) } },
          ...(status === "needs-you" ? { status: { key: "card.needsYou" as const } } : {}),
          // The present-tense held reason only while the goal is held (a released hold's `held`
          // event is history: its stored text stands).
          text: status === "held" ? { key: "card.heldReason" } : latest.text,
        }
      : { head: { key: "card.noEvents" }, text: { key: "card.noEventsText" } };

  return {
    state: GOAL_CARD_STATE[status],
    used: counts.done,
    max: Math.max(counts.total, 1),
    ringValue: ran ? undefined : "–",
    ringCaption: !ran
      ? { key: "card.notRun" }
      : goal.scope.kind === "none"
        ? { key: "card.ringOfCount", values: { count: counts.total } }
        : { key: "card.ringOf", values: { count: counts.total } },
    ringAria: !ran
      ? { key: "card.notRun" }
      : goal.scope.kind === "none"
        ? { key: "card.ringAriaCount", values: { done: counts.done, total: counts.total } }
        : { key: "card.ringAria", values: { done: counts.done, total: counts.total } },
    topMeta: goalScheduleLabel(goal, locale),
    parties,
    verdict,
    verdictTone: status === "needs-you" ? "blocked" : status === "done" ? "done" : "idle",
    actions: status === "needs-you" ? "decide" : goal.enabled ? "wake-pause" : "enable",
  };
}

/**
 * What comes next at the goal level ("Co bude"): the next cadence boundary and the deadline.
 * `state` is `undefined` while it is loading or failed — then no next cycle is claimed. The
 * next cycle counts from now or the cycle start, whichever is later, so a boundary the engine
 * has not ticked yet never reads as a "next cycle" in the past.
 */
export function goalUpcoming(
  goal: Pick<Goal, "cadence" | "deadline" | "enabled">,
  state: GoalState | undefined,
  now: number,
): { nextCycleAt: string | null; deadlineAt: string | undefined } {
  const next =
    goal.cadence && goal.enabled && state
      ? nextCycleStart(goal.cadence, new Date(Math.max(now, Date.parse(state.cycle.startedAt))))
      : null;
  return {
    nextCycleAt: next ? next.toISOString() : null,
    deadlineAt: state?.cycle.deadlineAt ?? goal.deadline,
  };
}

const PRAGUE_MONTH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
});

/** Decisions counted this (Prague) month; a counter left from an earlier month reads 0. */
export function decisionsThisMonth(
  decisions: GoalState["decisionsThisMonth"] | undefined,
  now: number,
): number {
  return decisions?.month === PRAGUE_MONTH.format(new Date(now)) ? decisions.count : 0;
}

/** The DS `IterationTimelineTone` subset (kept local: this file stays free of the DS). */
export type GoalCycleTone = "ok" | "bad" | "run" | "paused" | "idle";

export interface GoalCycle {
  /** Engine cycle index (0-based); the UI shows `index + 1`. */
  index: number;
  tone: GoalCycleTone;
  /** Newest first. */
  events: GoalTimelineEvent[];
  from: string;
  to: string;
}

/**
 * The timeline (fed oldest-first) as cycles, newest first. The live cycle (`liveIndex`) takes
 * the roll-up: needs-you is `paused`, done is `ok`, a paused or held goal `idle`, otherwise `run`. A past
 * cycle's tone is its last outcome event (`done` → ok, `parked` → bad), or `idle` when it has none.
 */
export function goalCycles(
  events: readonly GoalTimelineEvent[],
  liveIndex: number | undefined,
  status: GoalRollupStatus | undefined,
): GoalCycle[] {
  return groupTimelineByCycle(events).map(({ cycle, events: list }) => {
    let tone: GoalCycleTone;
    if (cycle === liveIndex && status) {
      tone =
        status === "needs-you"
          ? "paused"
          : status === "done"
            ? "ok"
            : status === "paused" || status === "held"
              ? "idle"
              : "run";
    } else {
      const outcome = list.find((e) => e.kind === "done" || e.kind === "parked");
      tone = !outcome ? "idle" : outcome.kind === "done" ? "ok" : "bad";
    }
    return { index: cycle, tone, events: list, from: list.at(-1)!.at, to: list[0]!.at };
  });
}

/** Row icon + tone of one timeline event by its (open-ended) kind; unknown kinds stay neutral. */
export function goalEventMark(kind: string): {
  icon: "check" | "warn" | "chat" | "run" | "branch" | "doc" | "pause";
  tone: "ok" | "bad" | "neutral";
} {
  switch (kind) {
    case "done":
      return { icon: "check", tone: "ok" };
    case "parked":
      return { icon: "warn", tone: "bad" };
    case "message-drafted":
    case "message-sent":
      return { icon: "chat", tone: "neutral" };
    case "task-started":
      return { icon: "run", tone: "neutral" };
    case "merged":
      return { icon: "branch", tone: "ok" };
    case "held":
      return { icon: "pause", tone: "neutral" };
    default:
      return { icon: "doc", tone: "neutral" };
  }
}

/** Time of day in Prague ("09:30"): the timeline row label (dates go in the cycle meta). */
export function formatGoalTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "Europe/Prague" }).format(
    new Date(iso),
  );
}

/** Short date in Prague ("27. 11."), for a cycle's date range. */
export function formatGoalDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Prague",
  }).format(new Date(iso));
}

export type GoalMeterTone = "ok" | "hot" | "bad";

export const goalMeterTone = (pct: number): GoalMeterTone =>
  pct >= 100 ? "bad" : pct >= 80 ? "hot" : "ok";

/** Percent (0–100, clamped) of `used` against `max`; 0 when there is no cap. */
export const percentOf = (used: number, max: number): number =>
  max > 0 ? Math.min(100, Math.max(0, Math.round((used / max) * 100))) : 0;
