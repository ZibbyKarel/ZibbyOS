import {
  type CreateGoalInput,
  CreateGoalSchema,
  type Goal,
  type GoalBudget,
  type GoalCadence,
  type GoalCeiling,
  type GoalDirectional,
  type GoalScope,
  type UpdateGoalInput,
} from "@zibby/contracts";
import { slug } from "../../utils/slug";

/** Everything the goal form edits, as the strings the inputs hold. */
export interface GoalFormValues {
  name: string;
  outcome: string;
  predicate: string;
  scopeKind: GoalScope["kind"];
  projectIds: string[];
  companyId: string;
  /** One-off (optional deadline) or standing (cadence): the two sides exclude each other. */
  timing: "oneoff" | "standing";
  /** `datetime-local` value, local time. */
  deadline: string;
  cadenceEvery: GoalCadence["every"];
  cadenceHour: string;
  cycleHours: string;
  maxRuns: string;
  maxCost: string;
  ceiling: GoalCeiling;
  /** Directional goal: ZIBBY proposes what to build (decided per `autoDecideGoals`). */
  directional: boolean;
  maxDecisions: string;
  matrixNoteId: string;
  /** One checklist item per line. */
  checklist: string;
}

export const EMPTY_GOAL_FORM: GoalFormValues = {
  name: "",
  outcome: "",
  predicate: "",
  scopeKind: "none",
  projectIds: [],
  companyId: "",
  timing: "oneoff",
  deadline: "",
  cadenceEvery: "weekday",
  cadenceHour: "9",
  cycleHours: "",
  maxRuns: "",
  maxCost: "",
  ceiling: "tier2",
  directional: false,
  maxDecisions: "2",
  matrixNoteId: "",
  checklist: "",
};

/** A blank input is "not set" (undefined); anything else is its number, so junk stays NaN and fails validation. */
function optionalNumber(raw: string): number | undefined {
  return raw.trim() === "" ? undefined : Number(raw);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO instant -> `datetime-local` value in the browser's zone. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value -> ISO instant (the browser's zone), or undefined when empty/invalid. */
export function localInputToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function goalToFormValues(goal: Goal): GoalFormValues {
  return {
    name: goal.name,
    outcome: goal.outcome,
    predicate: goal.predicate ?? "",
    scopeKind: goal.scope.kind,
    projectIds: goal.scope.kind === "projects" ? goal.scope.projectIds : [],
    companyId: goal.scope.kind === "company" ? goal.scope.companyId : "",
    timing: goal.cadence ? "standing" : "oneoff",
    deadline: goal.deadline ? isoToLocalInput(goal.deadline) : "",
    cadenceEvery: goal.cadence?.every ?? "weekday",
    cadenceHour: String(goal.cadence?.hour ?? 9),
    cycleHours: goal.cycleHours !== undefined ? String(goal.cycleHours) : "",
    maxRuns: goal.budget?.maxRunsPerCycle !== undefined ? String(goal.budget.maxRunsPerCycle) : "",
    maxCost:
      goal.budget?.maxCostUsdPerCycle !== undefined ? String(goal.budget.maxCostUsdPerCycle) : "",
    ceiling: goal.ceiling,
    directional: goal.directional !== undefined,
    maxDecisions: String(goal.directional?.maxDecisionsPerMonth ?? 2),
    matrixNoteId: goal.directional?.matrixNoteId ?? "",
    checklist: (goal.directional?.checklist ?? []).map((c) => c.title).join("\n"),
  };
}

function scopeOf(v: GoalFormValues): GoalScope {
  switch (v.scopeKind) {
    case "projects":
      return { kind: "projects", projectIds: v.projectIds };
    case "company":
      return { kind: "company", companyId: v.companyId };
    default:
      return { kind: v.scopeKind };
  }
}

function budgetOf(v: GoalFormValues): GoalBudget | undefined {
  const budget: GoalBudget = {};
  const maxRuns = optionalNumber(v.maxRuns);
  const maxCost = optionalNumber(v.maxCost);
  if (maxRuns !== undefined) budget.maxRunsPerCycle = maxRuns;
  if (maxCost !== undefined) budget.maxCostUsdPerCycle = maxCost;
  return Object.keys(budget).length > 0 ? budget : undefined;
}

/**
 * The directional block from the form. An item whose title already exists keeps its id, its
 * acceptance and its `done` (the planner ticks them); a new line gets the next free `c<n>` id.
 */
function directionalOf(v: GoalFormValues, previous?: GoalDirectional): GoalDirectional | undefined {
  if (!v.directional) return undefined;
  const used = new Set(previous?.checklist.map((c) => c.id));
  let n = 0;
  const nextId = () => {
    while (used.has(`c${++n}`));
    used.add(`c${n}`);
    return `c${n}`;
  };
  const titles = v.checklist
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const matrix = v.matrixNoteId.trim();
  return {
    maxDecisionsPerMonth: optionalNumber(v.maxDecisions) ?? Number.NaN,
    checklist: titles.map(
      (title) =>
        previous?.checklist.find((c) => c.title === title) ?? { id: nextId(), title, done: false },
    ),
    ...(matrix ? { matrixNoteId: matrix } : {}),
  };
}

/** Only the side of the timing choice that is active; the other side is never emitted. */
function timingOf(v: GoalFormValues): {
  deadline?: string;
  cadence?: GoalCadence;
  cycleHours?: number;
} {
  if (v.timing === "oneoff") {
    const deadline = localInputToIso(v.deadline);
    return deadline ? { deadline } : {};
  }
  const cycleHours = optionalNumber(v.cycleHours);
  return {
    // A blank hour is required-but-missing: NaN fails the schema instead of becoming midnight.
    cadence: { every: v.cadenceEvery, hour: optionalNumber(v.cadenceHour) ?? Number.NaN },
    ...(cycleHours !== undefined ? { cycleHours } : {}),
  };
}

/** The create body (strict contract type). New goals start paused; the operator switches them on from the detail page. */
export function buildCreateGoalInput(v: GoalFormValues): CreateGoalInput {
  const budget = budgetOf(v);
  const directional = directionalOf(v);
  return {
    id: slug(v.name, { fallback: "goal", maxLength: 64 }),
    name: v.name.trim(),
    outcome: v.outcome.trim(),
    ...(v.predicate.trim() ? { predicate: v.predicate.trim() } : {}),
    scope: scopeOf(v),
    ...timingOf(v),
    ...(budget ? { budget } : {}),
    ceiling: v.ceiling,
    ...(directional ? { directional } : {}),
    enabled: false,
  };
}

/**
 * The patch body. An emptied clearable field is sent as `null`, and switching between
 * one-off and standing nulls the other side (`{ deadline: null, cadence: {...} }`).
 */
export function buildUpdateGoalInput(
  v: GoalFormValues,
  previous?: GoalDirectional,
): UpdateGoalInput {
  const timing = timingOf(v);
  return {
    name: v.name.trim(),
    outcome: v.outcome.trim(),
    predicate: v.predicate.trim() || null,
    scope: scopeOf(v),
    deadline: timing.deadline ?? null,
    cadence: timing.cadence ?? null,
    cycleHours: timing.cycleHours ?? null,
    budget: budgetOf(v) ?? null,
    ceiling: v.ceiling,
    directional: directionalOf(v, previous) ?? null,
  };
}

/** The form is submittable when the strict create schema accepts what it would send. */
export function isGoalFormValid(v: GoalFormValues): boolean {
  return CreateGoalSchema.safeParse(buildCreateGoalInput(v)).success;
}
