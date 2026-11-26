import { z } from "zod";
import { IsoDateTimeSchema } from "../common.schema";
import type { GoalCeiling } from "./goal.schema";
import { GoalInstanceSchema, GoalParkedReasonSchema } from "./goal-state.schema";

const WaitingOnSchema = GoalInstanceSchema.shape.waitingOn.unwrap();

/**
 * The planner's stable id for one piece of work (`start-task`, `run-loop`, `pr-action`). The
 * engine skips an id it already applied this cycle, so a re-plan or a retried tick never
 * starts the same work twice.
 */
export const GoalActionIdSchema = z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/);

/** A goal message's text cap (also the operator's edited text on approve). */
export const GOAL_MESSAGE_TEXT_MAX = 4000;

/**
 * The closed action set a goal planner may return (spec "Closed action set"). The
 * engine applies each one filtered by the goal's ceiling; an action the ceiling
 * forbids, or one the engine has no handler for yet, becomes a `report` naming what
 * was not done.
 */
export const GoalActionSchema = z.discriminatedUnion("type", [
  /** Timeline entry only. */
  z.object({ type: z.literal("note"), text: z.string().min(1) }),
  /** Timeline + operator notification ("ready to merge", feasibility, gap report). */
  z.object({ type: z.literal("report"), text: z.string().min(1) }),
  /** Set `waitingOn` / `wakeAt`. */
  z
    .object({
      type: z.literal("wait"),
      waitingOn: WaitingOnSchema.optional(),
      wakeAt: IsoDateTimeSchema.optional(),
    })
    .refine((a) => a.waitingOn !== undefined || a.wakeAt !== undefined, {
      message: "wait needs waitingOn or wakeAt",
    }),
  /** The predicate is met: finish the instance. */
  z.object({ type: z.literal("done"), summary: z.string().optional() }),
  /** Park the instance with a reason. */
  z.object({
    type: z.literal("park"),
    reason: GoalParkedReasonSchema,
    text: z.string().optional(),
  }),
  /** Start a task in the instance's project (explicit target id or routed text). */
  z.object({
    type: z.literal("start-task"),
    actionId: GoalActionIdSchema,
    text: z.string().min(1).max(8000),
    title: z.string().max(200).optional(),
    /** An agent or workflow id; absent = the classifier routes `text`. */
    targetId: z.string().optional(),
  }),
  /** Start the goal's stored loop through the task path. */
  z.object({
    type: z.literal("run-loop"),
    actionId: GoalActionIdSchema,
    text: z.string().min(1).max(8000),
  }),
  /** A PR-inbox action with `auto: true`, only where the place's Autopilot level runs it. */
  z.object({
    type: z.literal("pr-action"),
    actionId: GoalActionIdSchema,
    op: z.enum(["review", "address-comments", "fix-ci"]),
    /** The PR's project; must be the instance's own (a `_` instance: one of my PRs). */
    projectId: z.string().min(1),
    /** `owner/repo` (GitHub) or the GitLab project path. */
    repo: z.string().min(1),
    number: z.number().int().positive(),
  }),
  /**
   * A message to a colleague, sent as the operator: behind approval `goal-message` unless the
   * place's `autoCommunicate` is `auto`. The engine resolves the recipient itself (closed set):
   * `slack-user` = a Slack user id (`U…`) of a workspace the operator's account is in, sent as
   * a DM; `pr` = a GitHub login / GitLab username that is the PR's author or reviewer, posted
   * as a PR comment mentioning them (`about` names the PR, required). The planner never picks
   * a channel.
   */
  z
    .object({
      type: z.literal("message"),
      actionId: GoalActionIdSchema,
      to: z.object({
        kind: z.enum(["slack-user", "pr"]),
        /** The person: Slack user id, or the login to mention on the PR. */
        ref: z.string().min(1).max(100),
      }),
      text: z.string().min(1).max(GOAL_MESSAGE_TEXT_MAX),
      about: z.object({ repo: z.string().min(1), number: z.number().int().positive() }).optional(),
    })
    .refine((a) => a.to.kind !== "pr" || a.about !== undefined, {
      message: "a pr message needs about (the PR)",
    }),
  /** Directional goal: ranked candidates, handled per `autoDecideGoals`. */
  z.object({
    type: z.literal("propose"),
    candidates: z
      .array(
        z.object({
          title: z.string().min(1),
          why: z.string().optional(),
          checklistId: z.string().optional(),
        }),
      )
      .min(1),
  }),
  /** Merge a PR — only with a valid merge grant, otherwise a "ready to merge" report. */
  z.object({
    type: z.literal("merge"),
    repo: z.string().min(1),
    number: z.number().int().positive(),
    /** The head SHA the planner saw approved; re-checked at merge time. */
    headSha: z.string().min(1),
  }),
]);
export type GoalAction = z.infer<typeof GoalActionSchema>;
export type GoalActionType = GoalAction["type"];

/** The `<goal-plan>` block a planner run returns. */
export const GoalPlanSchema = z.object({
  /** The revised plan (markdown). */
  plan: z.string(),
  /** Early feasibility line; the engine requires it on the first plan of a cycle. */
  feasibility: z.string().optional(),
  /** The planner judges the deadline/outcome unlikely: the operator is notified (first plan). */
  atRisk: z.boolean().optional(),
  actions: z.array(GoalActionSchema),
});
export type GoalPlan = z.infer<typeof GoalPlanSchema>;

/** The lowest ceiling each action needs. Total, so a new action cannot be left out. */
export const GOAL_ACTION_MIN_CEILING: Record<GoalActionType, GoalCeiling> = {
  note: "tier1",
  report: "tier1",
  wait: "tier1",
  done: "tier1",
  park: "tier1",
  "start-task": "tier2",
  "run-loop": "tier2",
  "pr-action": "tier2",
  message: "tier2",
  propose: "tier2",
  merge: "tier3",
};

const RANK: Record<GoalCeiling, number> = { tier1: 1, tier2: 2, tier3: 3 };

/** Whether a goal with `ceiling` may run `type` itself. The ceiling only filters. */
export function ceilingAllows(ceiling: GoalCeiling, type: GoalActionType): boolean {
  return RANK[ceiling] >= RANK[GOAL_ACTION_MIN_CEILING[type]];
}
