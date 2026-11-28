import { Injectable, Optional } from "@nestjs/common";
import {
  type ActivityKind,
  type ActivityRefs,
  type AutomationLevel,
  type Goal,
  type GoalAction,
  type GoalActionType,
  type GoalInstance,
  ceilingAllows,
} from "@zibby/contracts";
import { AutopilotService } from "../autopilot/autopilot.service";
import { type GoalFacts, isTaskInFlight, taskFactsOf } from "./goal-facts";

type ParkedReason = NonNullable<GoalInstance["parkedReason"]>;

/** A `wakeAt` earlier than now + this is raised to it, so a plan cannot re-wake every tick. */
export const WAKE_FLOOR_MS = 5 * 60 * 1000;

/** Actions that spend the cycle's budget (each starts a paid run); refused once it is used up. */
export const SPENDING_ACTIONS: ReadonlySet<GoalActionType> = new Set([
  "start-task",
  "run-loop",
  "pr-action",
]);

/**
 * Actions that start work or merge: executed on the engine's own only when the pass runs at
 * `auto` ("starting and deciding goals"); below it they become a report for the operator.
 */
export const STARTING_ACTIONS: ReadonlySet<GoalActionType> = new Set([
  ...SPENDING_ACTIONS,
  "merge",
]);

/**
 * Actions that start a unit of work for a step. Independent steps start in parallel (a started
 * task takes a run slot and queues in the task scheduler, which does the throttling); the engine
 * only keeps at most one live task per step and holds a step back until its `dependsOn` are done.
 */
export const STEP_ACTIONS: ReadonlySet<GoalActionType> = new Set(["start-task", "run-loop"]);

const LEVEL_LABEL: Readonly<Record<AutomationLevel, string>> = {
  manual: "Manual",
  semi: "Semi-auto",
  auto: "Auto",
};

/** What a starting action would do, for the operator's report (` (title)`). */
function startingWhat(action: GoalAction): string {
  const what =
    action.type === "start-task"
      ? (action.title ?? action.text)
      : action.type === "run-loop"
        ? action.text
        : action.type === "pr-action"
          ? `${action.op} ${action.repo}#${action.number}`
          : action.type === "merge"
            ? `${action.repo}#${action.number}`
            : "";
  return what ? ` (${what.slice(0, 120)})` : "";
}

/** ` [step Title]` for a deferred action that names a known step. */
function stepLabel(action: GoalAction, ctx: GoalActionContext): string {
  const stepId = "stepId" in action ? action.stepId : undefined;
  const step = stepId ? ctx.instance.steps?.find((s) => s.id === stepId) : undefined;
  return step ? ` [step ${step.title}]` : "";
}

export interface GoalBudgetLeft {
  runs?: number;
  costUsd?: number;
}

/** A side effect the engine writes after the instance state (timeline line or activity entry). */
export type GoalEffect =
  | {
      type: "timeline";
      instance: string;
      kind: string;
      text: string;
      refs?: Record<string, string>;
    }
  | { type: "activity"; kind: ActivityKind; summary: string; refs: ActivityRefs };

/**
 * What an action handler works on. `instance` is the engine's working copy: a handler
 * mutates it, and the engine persists it once every action ran. Timeline and activity
 * go through {@link timeline} / {@link activity}, written after the state.
 */
export class GoalActionContext {
  readonly effects: GoalEffect[] = [];
  /**
   * How far this pass may act on its own: the effective `autoDecideGoals` at the instance's
   * place (an operator wake on a held instance: `semi`). Below `auto`, starting actions become
   * a report and messages always wait for approval. Fails closed: whoever builds a context sets
   * it; an operator-approved start (a decided `goal-decision`) sets `auto` for that one action.
   */
  autonomy: AutomationLevel = "manual";

  constructor(
    readonly goal: Goal,
    readonly instanceKey: string,
    readonly instance: GoalInstance,
    readonly facts: GoalFacts,
    readonly now: Date,
    /** What is left of the cycle's budget (a field absent = unset). */
    readonly remainingBudget: GoalBudgetLeft = {},
    private readonly persistTask: (taskId: string, actionId?: string) => Promise<void> = async () =>
      undefined,
  ) {}

  /**
   * Record a task this instance started, with the `actionId` that started it: both are added
   * to the working copy AND written to the stored instance in one update, so a crash or a
   * dropped result never forgets spent work nor lets the same action start it again.
   * **A spending handler (`start-task`, `run-loop`, `pr-action`) must await this before returning.**
   */
  async recordTask(taskId: string, actionId?: string): Promise<void> {
    if (!this.instance.taskIds.includes(taskId)) {
      this.instance.taskIds.push(taskId);
      // Live budget: the next spending action in the same plan sees this run spent.
      if (this.remainingBudget.runs !== undefined) this.remainingBudget.runs -= 1;
    }
    if (actionId && !this.applied(actionId)) {
      (this.instance.appliedActionIds ??= []).push(actionId);
    }
    await this.persistTask(taskId, actionId);
  }

  /** Steps a `start-task` / `run-loop` of this pass already started a task for. */
  readonly startedSteps = new Set<string>();

  /**
   * Why a step may not get a new task now, or `undefined` when it may: it is already done, a
   * task for it is still live (queued, running or waiting on the operator; this cycle's or one
   * carried over from the last), or a step it `dependsOn` is not done yet. A step whose task
   * failed or was cancelled may be started again.
   */
  stepBlocker(stepId: string): string | undefined {
    if (this.startedSteps.has(stepId)) return "a task for it was just started";
    const facts = taskFactsOf(this.facts);
    const carried = facts.find((t) => t.carried && t.stepId === stepId && isTaskInFlight(t));
    if (carried) return `a task carried over from the last cycle is still ${carried.state}`;
    const steps = this.instance.steps ?? [];
    const step = steps.find((s) => s.id === stepId);
    if (!step) return undefined;
    if (step.status === "done") return "it is already done";
    if (step.taskId) {
      const fact = facts.find((t) => t.id === step.taskId);
      if (fact ? isTaskInFlight(fact) : step.status === "running") {
        return `its task ${step.taskId} is still ${fact?.state ?? "running"}`;
      }
    }
    const open = (step.dependsOn ?? []).filter((id) => {
      const dep = steps.find((s) => s.id === id);
      return dep !== undefined && dep.status !== "done";
    });
    if (open.length) return `it waits for step ${open.join(", ")} to be done`;
    return undefined;
  }

  /** The step the engine marks `running` for a task it started (an unknown id changes nothing). */
  markStepRunning(stepId: string, taskId: string): void {
    const step = this.instance.steps?.find((s) => s.id === stepId);
    if (!step) return;
    step.status = "running";
    step.taskId = taskId;
    delete step.note;
  }

  /** Whether this cycle already applied the action with this id. */
  applied(actionId: string): boolean {
    return this.instance.appliedActionIds?.includes(actionId) ?? false;
  }

  get budgetExhausted(): boolean {
    const { runs, costUsd } = this.remainingBudget;
    return (runs !== undefined && runs <= 0) || (costUsd !== undefined && costUsd <= 0);
  }

  get projectId(): string | undefined {
    return this.instanceKey === "_" ? undefined : this.instanceKey;
  }

  timeline(kind: string, text: string, refs?: Record<string, string>): void {
    this.effects.push({ type: "timeline", instance: this.instanceKey, kind, text, refs });
  }

  /** An activity entry riding `goalId`, `itemId` = the instance key and the project. */
  activity(kind: ActivityKind, summary: string, refs: ActivityRefs = {}): void {
    this.effects.push({
      type: "activity",
      kind,
      summary,
      refs: {
        goalId: this.goal.id,
        itemId: this.instanceKey,
        ...(this.projectId ? { projectId: this.projectId } : {}),
        ...refs,
      },
    });
  }

  /** `name — project` for summaries. */
  get label(): string {
    return this.projectId ? `${this.goal.name} — ${this.projectId}` : this.goal.name;
  }
}

export type GoalActionHandler<T extends GoalActionType> = (
  action: Extract<GoalAction, { type: T }>,
  ctx: GoalActionContext,
) => void | Promise<void>;

type GoalWait = NonNullable<GoalInstance["waitingOn"]>[number];

/** Add waits to the instance (deduplicated by kind + ref). */
export function addWaits(instance: GoalInstance, waits: readonly GoalWait[]): void {
  const all = [...(instance.waitingOn ?? []), ...waits];
  instance.waitingOn = all.filter(
    (w, i) => all.findIndex((x) => x.kind === w.kind && x.ref === w.ref) === i,
  );
}

/** Set `wakeAt` unless an earlier one is already set (the earliest wake wins). */
export function keepEarlierWake(instance: GoalInstance, iso: string): void {
  if (!instance.wakeAt || Date.parse(iso) < Date.parse(instance.wakeAt)) instance.wakeAt = iso;
}

/** Park the instance: status, reason, timeline, activity (the operator is notified off it). */
export function parkInstance(ctx: GoalActionContext, reason: ParkedReason, text: string): void {
  ctx.instance.status = "parked";
  ctx.instance.parkedReason = reason;
  ctx.instance.summary = text;
  // A resumed instance must re-plan: the store's resume keeps the fingerprint.
  delete ctx.instance.fingerprint;
  ctx.timeline("parked", text, { reason });
  ctx.activity("goal-parked", `${ctx.label}: ${text}`, { status: reason });
}

/** Timeline + an operator notification (`goal-acted` with `action: report`). */
export function reportFromGoal(ctx: GoalActionContext, text: string): void {
  ctx.timeline("report", text);
  ctx.activity("goal-acted", `${ctx.label}: ${text.slice(0, 200)}`, { action: "report" });
}

/**
 * Applies a plan's actions, filtered by the goal's ceiling and the pass's autonomy. An action
 * the ceiling forbids, a starting action below `auto` ({@link STARTING_ACTIONS}), or one with
 * no registered handler yet, becomes a `report` naming what was not done (never recorded as
 * applied). A later task adds an action with one {@link register} call.
 */
@Injectable()
export class GoalActionExecutor {
  private readonly handlers = new Map<GoalActionType, GoalActionHandler<GoalActionType>>();

  /** Optional so unit tests can `new` it; the module always provides it. */
  constructor(@Optional() private readonly autopilot?: AutopilotService) {
    this.register("note", (a, ctx) => ctx.timeline("note", a.text));
    this.register("report", (a, ctx) => reportFromGoal(ctx, a.text));
    this.register("wait", (a, ctx) => {
      // The engine cleared both before this plan's actions: what is there now was set by an
      // earlier action of the same plan (a message's reply wait) and is kept.
      if (a.waitingOn) addWaits(ctx.instance, a.waitingOn);
      if (a.wakeAt) {
        const floor = ctx.now.getTime() + WAKE_FLOOR_MS;
        if (Date.parse(a.wakeAt) < floor) {
          const raised = new Date(floor).toISOString();
          keepEarlierWake(ctx.instance, raised);
          ctx.timeline("note", `wakeAt ${a.wakeAt} raised to ${raised} (5 min floor).`);
        } else keepEarlierWake(ctx.instance, a.wakeAt);
      }
      ctx.timeline(
        "wait",
        [
          a.waitingOn?.map((w) => `${w.kind}:${w.ref}`).join(", "),
          ctx.instance.wakeAt ? `until ${ctx.instance.wakeAt}` : undefined,
        ]
          .filter(Boolean)
          .join(" "),
      );
    });
    this.register("done", (a, ctx) => {
      const text = a.summary ?? "Done.";
      ctx.instance.status = "done";
      ctx.instance.summary = text;
      delete ctx.instance.waitingOn;
      delete ctx.instance.wakeAt;
      ctx.timeline("done", text);
      ctx.activity("goal-done", `${ctx.label}: ${text}`);
    });
    this.register("park", (a, ctx) =>
      parkInstance(ctx, a.reason, a.text ?? `Parked (${a.reason}).`),
    );
  }

  /** Register (or replace) the handler for one action type. */
  register<T extends GoalActionType>(type: T, handler: GoalActionHandler<T>): void {
    this.handlers.set(type, handler as unknown as GoalActionHandler<GoalActionType>);
  }

  /** Whether `type` has a handler (the planner offers only executable actions). */
  handles(type: GoalActionType): boolean {
    return this.handlers.has(type);
  }

  async execute(actions: GoalAction[], ctx: GoalActionContext): Promise<void> {
    for (const action of actions) {
      const handler = this.handlers.get(action.type);
      const stepId =
        STEP_ACTIONS.has(action.type) && "stepId" in action ? action.stepId : undefined;
      const blocker = stepId ? ctx.stepBlocker(stepId) : undefined;
      const actionId = "actionId" in action ? action.actionId : undefined;
      if (actionId && ctx.applied(actionId)) {
        // Idempotency: a re-plan or a retried tick restating started work starts nothing.
        ctx.timeline("note", `Skipped ${action.type} ${actionId}: already applied this cycle.`);
      } else if (!ceilingAllows(ctx.goal.ceiling, action.type)) {
        reportFromGoal(
          ctx,
          `Not done: ${action.type} — the goal's ceiling ${ctx.goal.ceiling} does not allow it.`,
        );
      } else if (STARTING_ACTIONS.has(action.type) && ctx.autonomy !== "auto") {
        // Never executed silently below `auto`: the operator gets what it would have done.
        reportFromGoal(
          ctx,
          `Not started (${LEVEL_LABEL[ctx.autonomy]}): ${action.type}${startingWhat(action)} — start it yourself or raise Starting and deciding goals to Auto.`,
        );
      } else if (SPENDING_ACTIONS.has(action.type) && this.autopilot?.isPaused()) {
        // A plan that was running when Autopilot was paused starts no paid work.
        reportFromGoal(ctx, `Not done: ${action.type} — Autopilot is paused.`);
      } else if (SPENDING_ACTIONS.has(action.type) && ctx.budgetExhausted) {
        reportFromGoal(ctx, `Not done: ${action.type} — the cycle's budget is used up.`);
      } else if (!handler) {
        reportFromGoal(ctx, `Not done: ${action.type} — not available yet.`);
      } else if (blocker) {
        // One live task per step, dependencies first. Not recorded as applied: the planner
        // restates it later.
        ctx.timeline(
          "note",
          `Not started: ${action.type}${startingWhat(action)}${stepLabel(action, ctx)} — step ${stepId}: ${blocker}.`,
        );
      } else {
        try {
          const before = ctx.instance.taskIds.length;
          await handler(action, ctx);
          if (STEP_ACTIONS.has(action.type)) {
            const started = ctx.instance.taskIds[before];
            if (started !== undefined && stepId) {
              ctx.startedSteps.add(stepId);
              ctx.markStepRunning(stepId, started);
            }
          }
        } catch (error) {
          // A failing service (refused, out of scope, host down) is reported, never re-planned
          // off a thrown tick.
          const message = error instanceof Error ? error.message : String(error);
          reportFromGoal(ctx, `Not done: ${action.type} — ${message.slice(0, 300)}`);
        }
      }
      // A finished or parked instance takes no further actions this run.
      if (ctx.instance.status === "done" || ctx.instance.status === "parked") return;
    }
  }
}
