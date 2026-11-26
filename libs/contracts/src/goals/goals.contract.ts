import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorSchema } from "../common.schema";
import {
  CreateGoalBodySchema,
  GoalSchema,
  SetMergeGrantBodySchema,
  UpdateGoalBodySchema,
} from "./goal.schema";
import { GoalRollupSchema, GoalStateSchema, GoalTimelineEventSchema } from "./goal-state.schema";

const c = initContract();

const GoalIdParam = z.object({ id: z.string().min(1) });
const GoalInstanceParam = z.object({ id: z.string().min(1), instance: z.string().min(1) });

/** A goal with its derived roll-up (the list row). */
export const GoalWithRollupSchema = GoalSchema.and(z.object({ rollup: GoalRollupSchema }));
export type GoalWithRollup = z.infer<typeof GoalWithRollupSchema>;

/** State + derived roll-up. */
export const GoalStateViewSchema = z.object({ state: GoalStateSchema, rollup: GoalRollupSchema });
export type GoalStateView = z.infer<typeof GoalStateViewSchema>;

/** CRUD over goals (`.goal.md` files) plus state, timeline, wake and resume. */
export const goalsContract = c.router(
  {
    createGoal: {
      method: "POST",
      path: "/goals",
      body: CreateGoalBodySchema,
      responses: { 201: GoalSchema, 409: ErrorSchema, 422: ErrorSchema },
      summary: "Create a goal",
    },
    listGoals: {
      method: "GET",
      path: "/goals",
      responses: { 200: z.array(GoalWithRollupSchema) },
      summary: "List goals with their roll-up",
    },
    getGoal: {
      method: "GET",
      path: "/goals/:id",
      pathParams: GoalIdParam,
      responses: { 200: GoalSchema, 404: ErrorSchema },
      summary: "Get a goal",
    },
    updateGoal: {
      method: "PATCH",
      path: "/goals/:id",
      pathParams: GoalIdParam,
      body: UpdateGoalBodySchema,
      responses: { 200: GoalSchema, 404: ErrorSchema, 422: ErrorSchema },
      summary: "Partially update a goal (never the merge grant)",
    },
    deleteGoal: {
      method: "DELETE",
      path: "/goals/:id",
      pathParams: GoalIdParam,
      responses: { 200: z.object({ id: z.string() }), 404: ErrorSchema },
      summary: "Delete a goal and its state",
    },
    getGoalState: {
      method: "GET",
      path: "/goals/:id/state",
      pathParams: GoalIdParam,
      responses: { 200: GoalStateViewSchema, 404: ErrorSchema },
      summary: "A goal's state and roll-up",
    },
    getGoalTimeline: {
      method: "GET",
      path: "/goals/:id/timeline",
      pathParams: GoalIdParam,
      query: z.object({
        instance: z.string().min(1).optional(),
        cycle: z.coerce.number().int().min(0).optional(),
      }),
      responses: { 200: z.array(GoalTimelineEventSchema), 404: ErrorSchema },
      summary: "Timeline events, newest last, capped at 500",
    },
    wakeGoal: {
      method: "POST",
      path: "/goals/:id/wake",
      pathParams: GoalIdParam,
      body: z.object({}).optional(),
      responses: { 200: GoalStateViewSchema, 404: ErrorSchema },
      summary: "Clear every instance's fingerprint so the engine re-plans",
    },
    resumeGoalInstance: {
      method: "POST",
      path: "/goals/:id/instances/:instance/resume",
      pathParams: GoalInstanceParam,
      body: z.object({}).optional(),
      responses: { 200: GoalStateViewSchema, 404: ErrorSchema, 409: ErrorSchema },
      summary: "Put a parked instance back to planning",
    },
    setGoalMergeGrant: {
      method: "PUT",
      path: "/goals/:id/merge-grant",
      pathParams: GoalIdParam,
      body: SetMergeGrantBodySchema,
      responses: { 200: GoalSchema, 401: ErrorSchema, 404: ErrorSchema, 422: ErrorSchema },
      summary:
        "Set the goal's merge grant (operator token; ceiling tier3; until ≤ 24 h; projects in scope)",
    },
    clearGoalMergeGrant: {
      method: "DELETE",
      path: "/goals/:id/merge-grant",
      pathParams: GoalIdParam,
      body: z.object({}).optional(),
      responses: { 200: GoalSchema, 401: ErrorSchema, 404: ErrorSchema },
      summary: "Revoke the goal's merge grant (operator token)",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type GoalsContract = typeof goalsContract;
