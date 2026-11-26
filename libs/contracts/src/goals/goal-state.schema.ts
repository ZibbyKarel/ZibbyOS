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
  /**
   * `taskIds.length` at that resume: the budget park is skipped only until one more run is
   * recorded past it (absent = no budget grace, the budget park applies).
   */
  resumedRuns: z.number().int().min(0).optional(),
  /** This cycle's feasibility line (from its first plan); absent = the next plan is the first. */
  feasibility: z.string().optional(),
  /** `actionId`s of the work this cycle already started (start-task, run-loop, pr-action). */
  appliedActionIds: z.array(z.string()).optional(),
  /** `message` actions deferred by a transient Slack lookup error this cycle, per `actionId`. */
  lookupRetries: z.record(z.string(), z.number().int().min(0)).optional(),
  /** Directional goal: the effective `autoDecideGoals` the last plan ran with (and why). */
  autoDecide: z
    .object({
      level: z.enum(["manual", "semi", "auto"]),
      reason: z.enum(["level", "paused", "ceiling"]),
    })
    .optional(),
});
export type GoalInstance = z.infer<typeof GoalInstanceSchema>;

/**
 * One message to a colleague this cycle (the `message` action). `pending` = a draft behind its
 * `goal-message` approval; `sending` = the send started (never retried: a crash leaves it here,
 * counted toward the cap, so a colleague is never messaged twice); `sent` carries where it went.
 */
export const GoalMessageSchema = z.object({
  /** `<instance>/<cycle>/<actionId>`; the approval's runId is `<goalId>/<id>`. */
  id: z.string().min(1),
  instance: z.string(),
  actionId: z.string(),
  /** The resolved person key (`slack:<userId>` / `pr:<login>`): the anti-nagging counter key. */
  person: z.string(),
  /** Who and where, for the preview and the facts (`Jan Novák · Slack DM`, `@jan · acme/web#4`). */
  to: z.string(),
  status: z.enum(["pending", "sending", "sent", "rejected", "failed"]),
  text: z.string(),
  /** Resolved target: a Slack DM (integration + user id) or a PR (project + repo + number + login). */
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("slack"), integrationId: z.string(), userId: z.string() }),
    z.object({
      kind: z.literal("pr"),
      projectId: z.string(),
      repo: z.string(),
      number: z.number().int().positive(),
      login: z.string(),
    }),
  ]),
  approvalId: z.string().optional(),
  createdAt: IsoDateTimeSchema,
  sentAt: IsoDateTimeSchema.optional(),
  /** A sent Slack message's reply ref `<integrationId>:<channel>:<ts>` (the `replies` wait). */
  replyRef: z.string().optional(),
  /** The failed send's error (capped). */
  error: z.string().optional(),
});
export type GoalMessage = z.infer<typeof GoalMessageSchema>;

/**
 * One ranked proposal of a directional goal (the `propose` action) waiting behind its
 * `goal-decision` approval. `id` = `<instance>/<cycle>`: one open per instance. Candidates are
 * matched by id only, never from free text.
 */
export const GoalDecisionSchema = z.object({
  id: z.string().min(1),
  instance: z.string(),
  status: z.enum(["pending", "started", "rejected", "failed"]),
  candidates: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      why: z.string().optional(),
      size: z.enum(["small", "large"]),
      task: z.string(),
    }),
  ),
  approvalId: z.string().optional(),
  /** The candidate id that was started. */
  chosen: z.string().optional(),
  createdAt: IsoDateTimeSchema,
});
export type GoalDecision = z.infer<typeof GoalDecisionSchema>;

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
  /** This cycle's messages to colleagues (drafts, sent, rejected); cleared with `nudges`. */
  messages: z.array(GoalMessageSchema).optional(),
  /** This cycle's directional proposals; cleared with `messages`. */
  decisions: z.array(GoalDecisionSchema).optional(),
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
