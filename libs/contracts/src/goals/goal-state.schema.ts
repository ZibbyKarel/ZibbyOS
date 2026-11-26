import { z } from "zod";
import { IsoDateTimeSchema } from "../common.schema";
import type { Goal } from "./goal.schema";

export const GoalInstanceStatusSchema = z.enum(["planning", "acting", "waiting", "done", "parked"]);
export type GoalInstanceStatus = z.infer<typeof GoalInstanceStatusSchema>;

export const GoalParkedReasonSchema = z.enum([
  "deadline",
  "budget",
  "failed",
  "needs-operator",
  "infeasible",
]);

export const GoalInstanceSchema = z.object({
  status: GoalInstanceStatusSchema,
  parkedReason: GoalParkedReasonSchema.optional(),
  planNoteId: z.string().optional(),
  taskIds: z.array(z.string()),
  waitingOn: z
    .array(
      z.object({
        kind: z.enum(["task", "approval", "pr", "reply", "time"]),
        ref: z.string(),
      }),
    )
    .optional(),
  wakeAt: IsoDateTimeSchema.optional(),
  /** Hash of the last facts snapshot the planner saw. */
  fingerprint: z.string().optional(),
  /** One line for the roll-up. */
  summary: z.string().optional(),
  /** Consecutive planner failures; the engine parks (`failed`) at 3. */
  planFailures: z.number().int().min(0).optional(),
  /** Cycle index the operator resumed this instance in; the deadline/budget parks skip it. */
  resumedCycle: z.number().int().min(0).optional(),
  /** This cycle's feasibility line (from its first plan); absent = the next plan is the first. */
  feasibility: z.string().optional(),
  /** `actionId`s of the work this cycle already started (start-task, run-loop, pr-action). */
  appliedActionIds: z.array(z.string()).optional(),
});
export type GoalInstance = z.infer<typeof GoalInstanceSchema>;

export const GoalStateSchema = z.object({
  goalId: z.string(),
  cycle: z.object({
    index: z.number().int().min(0),
    startedAt: IsoDateTimeSchema,
    deadlineAt: IsoDateTimeSchema.optional(),
  }),
  /** Keyed by projectId, or "_" for a goal without a project. */
  instances: z.record(z.string(), GoalInstanceSchema),
  decisionsThisMonth: z.object({ month: z.string(), count: z.number().int().min(0) }),
  nudges: z.record(
    z.string(),
    z.object({ count: z.number().int().min(0), lastAt: IsoDateTimeSchema }),
  ),
});
export type GoalState = z.infer<typeof GoalStateSchema>;

export const GoalTimelineEventSchema = z.object({
  at: IsoDateTimeSchema,
  cycle: z.number().int().min(0),
  instance: z.string(),
  kind: z.string(),
  text: z.string(),
  refs: z.record(z.string(), z.string()).optional(),
});
export type GoalTimelineEvent = z.infer<typeof GoalTimelineEventSchema>;

export const GoalRollupStatusSchema = z.enum([
  "paused",
  "planning",
  "acting",
  "waiting",
  "needs-you",
  "done",
]);
export type GoalRollupStatus = z.infer<typeof GoalRollupStatusSchema>;

export const GoalRollupSchema = z.object({
  status: GoalRollupStatusSchema,
  counts: z.object({
    total: z.number().int(),
    done: z.number().int(),
    parked: z.number().int(),
    active: z.number().int(),
  }),
  needsYou: z.number().int(),
});
export type GoalRollup = z.infer<typeof GoalRollupSchema>;

/** A state with no instances yet. */
export function emptyGoalState(goalId: string, startedAt: string): GoalState {
  return {
    goalId,
    cycle: { index: 0, startedAt },
    instances: {},
    decisionsThisMonth: { month: startedAt.slice(0, 7), count: 0 },
    nudges: {},
  };
}

/**
 * Derive a goal's roll-up. `paused` when disabled; `planning` with no instances;
 * `needs-you` when any instance is parked (every parkedReason); `done` when all are
 * done; otherwise the busiest: acting > planning > waiting.
 */
export function rollupGoal(goal: Pick<Goal, "enabled">, state: GoalState): GoalRollup {
  const instances = Object.values(state.instances);
  const count = (s: GoalInstanceStatus) => instances.filter((i) => i.status === s).length;
  const done = count("done");
  const parked = count("parked");
  const counts = {
    total: instances.length,
    done,
    parked,
    active: instances.length - done - parked,
  };
  let status: GoalRollupStatus;
  if (!goal.enabled) status = "paused";
  else if (instances.length === 0) status = "planning";
  else if (parked > 0) status = "needs-you";
  else if (done === instances.length) status = "done";
  else if (count("acting") > 0) status = "acting";
  else if (count("planning") > 0) status = "planning";
  else status = "waiting";
  return { status, counts, needsYou: parked };
}
