import { z } from "zod";
import { AgentIdSchema } from "../agents/agent.schema";
import { IsoDateTimeSchema } from "../common.schema";

/** Which projects a goal covers. `none` = not tied to a project (my PRs, mozek, personal). */
export const GoalScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("projects"), projectIds: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal("company"), companyId: z.string().min(1) }),
  z.object({ kind: z.literal("all") }),
]);
export type GoalScope = z.infer<typeof GoalScopeSchema>;

export const GoalCadenceSchema = z.object({
  every: z.enum(["day", "weekday", "week", "month"]),
  /** Hour of the day, Europe/Prague. */
  hour: z.number().int().min(0).max(23),
});
export type GoalCadence = z.infer<typeof GoalCadenceSchema>;

export const GoalBudgetSchema = z.object({
  maxRunsPerCycle: z.number().int().positive().optional(),
  maxCostUsdPerCycle: z.number().positive().optional(),
});
export type GoalBudget = z.infer<typeof GoalBudgetSchema>;

/** The autonomy ceiling: only filters what the engine itself starts. */
export const GoalCeilingSchema = z.enum(["tier1", "tier2", "tier3"]);
export type GoalCeiling = z.infer<typeof GoalCeilingSchema>;

export const GoalDirectionalSchema = z.object({
  /** Cap on things ZIBBY may start on its own per month. */
  maxDecisionsPerMonth: z.number().int().min(0),
  checklist: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      acceptance: z.string().optional(),
      done: z.boolean(),
    }),
  ),
  /** Mozek note holding a feature matrix, if any. */
  matrixNoteId: z.string().min(1).optional(),
});
export type GoalDirectional = z.infer<typeof GoalDirectionalSchema>;

/** A time-boxed permission to merge PRs. Set only through its own token-protected route. */
export const MergeGrantSchema = z.object({
  projectIds: z.array(z.string().min(1)),
  until: IsoDateTimeSchema,
  grantedAt: IsoDateTimeSchema,
});
export type MergeGrant = z.infer<typeof MergeGrantSchema>;

/** Everything the operator may set (no id, no timestamps, no merge grant). */
const GoalInputObject = z.object({
  name: z.string().min(1),
  /** Markdown body: what must be true. */
  outcome: z.string().min(1),
  /** One verifiable sentence. */
  predicate: z.string().min(1).optional(),
  scope: GoalScopeSchema,
  /** One-off goal. Mutually exclusive with `cadence`. */
  deadline: IsoDateTimeSchema.optional(),
  /** Standing goal. Mutually exclusive with `deadline`. */
  cadence: GoalCadenceSchema.optional(),
  /** Standing goal: each cycle's deadline = cycle start + cycleHours. Needs `cadence`. */
  cycleHours: z.number().positive().optional(),
  budget: GoalBudgetSchema.optional(),
  ceiling: GoalCeilingSchema.default("tier2"),
  /** The operator's switch; presets are created with false. */
  enabled: z.boolean(),
  directional: GoalDirectionalSchema.optional(),
  /** Optional: execute work through a stored loop (maker + verifier). */
  loop: z.object({ loopId: AgentIdSchema }).optional(),
});

type TimingFields = { deadline?: unknown; cadence?: unknown; cycleHours?: unknown };

/** `deadline` xor `cadence`; `cycleHours` only with `cadence`. */
export function goalTimingIssue(g: TimingFields): string | null {
  if (g.deadline !== undefined && g.cadence !== undefined) {
    return "deadline and cadence are mutually exclusive";
  }
  if (g.cycleHours !== undefined && g.cadence === undefined) {
    return "cycleHours requires cadence";
  }
  return null;
}

const timing = (g: TimingFields, ctx: z.RefinementCtx) => {
  const issue = goalTimingIssue(g);
  if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue });
};

/** The stored goal. */
export const GoalSchema = GoalInputObject.extend({
  id: AgentIdSchema,
  mergeGrant: MergeGrantSchema.optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
}).superRefine(timing);
export type Goal = z.infer<typeof GoalSchema>;

/** Create body: `id` + the operator fields. Strict, so `mergeGrant` is rejected (422). */
export const CreateGoalSchema = GoalInputObject.extend({ id: AgentIdSchema })
  .strict()
  .superRefine(timing);
export type CreateGoalInput = z.input<typeof CreateGoalSchema>;

/** Update body: every operator field optional. Strict, so `mergeGrant` is rejected (422). */
export const UpdateGoalSchema = GoalInputObject.partial().strict().superRefine(timing);
export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;

/**
 * Transport bodies for the routes: same fields but passthrough and without the timing
 * refinement, so an unknown key (`mergeGrant`) or a bad combination reaches the handler,
 * which parses with the strict schemas above and answers 422 (not ts-rest's 400).
 */
export const CreateGoalBodySchema = GoalInputObject.extend({ id: AgentIdSchema }).passthrough();
export const UpdateGoalBodySchema = GoalInputObject.partial().passthrough();
