import type {
  Goal,
  GoalCadence,
  GoalInstanceStatus,
  GoalPreset,
  GoalRollupStatus,
  GoalScope,
  GoalTimelineEvent,
} from "@zibby/contracts";

/** A catalog key plus ICU values — the component translates it, so this file stays free of next-intl. */
export interface GoalLabel {
  key:
    | "scope.none"
    | "scope.all"
    | "scope.company"
    | "scope.projects"
    | `schedule.${GoalCadence["every"]}`
    | "schedule.deadline"
    | "schedule.open";
  values?: Record<string, string | number>;
}

export type GoalStatusTone = "ok" | "wait" | "off" | "err" | "info";

/** Pill tone per roll-up status: needs-you is the one that asks for the operator. */
export function goalStatusTone(status: GoalRollupStatus): GoalStatusTone {
  switch (status) {
    case "paused":
      return "off";
    case "needs-you":
      return "wait";
    case "done":
    case "acting":
      return "ok";
    case "planning":
    case "waiting":
      return "info";
  }
}

/** Instance status uses the same pill tones as the roll-up. */
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
