import type { AutomationLevel, Goal, GoalCeiling, GoalInstance, GoalState } from "@zibby/contracts";
import type { GoalFacts } from "./goal-facts";

/** Everything one planner run receives for one instance (spec "Engine" step 4). */
export interface GoalPlannerContext {
  goal: Goal;
  /** projectId, or "_" for a goal without a project. */
  instanceKey: string;
  /** Set for a project instance. */
  projectId?: string;
  instance: GoalInstance;
  cycle: GoalState["cycle"];
  facts: GoalFacts;
  ceiling: GoalCeiling;
  /** What is left of the cycle's budget; a field is absent when that budget is unset. */
  remainingBudget: { runs?: number; costUsd?: number };
  nudges: GoalState["nudges"];
  /**
   * The effective `autoCommunicate` at the instance's place: `auto` sends messages at once,
   * `semi`/`manual` drafts them for approval, `paused` = Autopilot paused (approval).
   */
  autoCommunicate?: "manual" | "semi" | "auto" | "paused";
  /**
   * How far this pass may act on its own ("starting and deciding goals", `autoDecideGoals`):
   * `auto` executes work-starting actions, `semi` turns them into a report for the operator and
   * every message waits for approval. A `manual` instance is held and never planned.
   */
  autonomy?: AutomationLevel;
  /**
   * The effective `autoDecideGoals` (directional goals): `auto` starts a small top candidate
   * itself, `semi` raises an approval, `manual` only reports; `reason` says why it is not the
   * stored level (Autopilot paused, a tier1 ceiling). Enforced by the engine, not the prompt.
   */
  autoDecide?: { level: "manual" | "semi" | "auto"; reason: "level" | "paused" | "ceiling" };
  decisionsThisMonth: GoalState["decisionsThisMonth"];
  now: string;
  /** No feasibility recorded this cycle yet: the plan must carry `feasibility`. */
  firstPlan: boolean;
  /** Aborted when the engine's planner timeout expires; the planner stops its run. */
  signal: AbortSignal;
  /**
   * Record the planner's own model run on the instance (it counts against
   * `maxRunsPerCycle` and the cost budget, like a started task). Lowers `remainingBudget.runs`.
   */
  recordRun(runId: string): Promise<void>;
}

/**
 * One model run per call. Returns the raw `<goal-plan>` value; the engine validates it
 * with `GoalPlanSchema` and counts a throw or an invalid value as a failure.
 */
export interface GoalPlanner {
  plan(ctx: GoalPlannerContext): Promise<unknown>;
}

/** DI token for the {@link GoalPlanner}. */
export const GOAL_PLANNER = "GOAL_PLANNER";

/** The flat vault note holding an instance's current plan (written by the planner). */
export function goalPlanNoteId(goalId: string, instanceKey: string): string {
  return `goal-${goalId}-${instanceKey}-plan`;
}

/** Whether a vault note id is a {@link goalPlanNoteId} (never grounded: see GroundingService). */
export function isGoalPlanNoteId(id: string): boolean {
  return /^goal-.+-plan$/.test(id);
}
