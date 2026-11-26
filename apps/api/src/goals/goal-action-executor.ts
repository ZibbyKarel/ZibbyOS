import { Injectable } from "@nestjs/common";
import {
  type ActivityKind,
  type ActivityRefs,
  type Goal,
  type GoalAction,
  type GoalActionType,
  type GoalInstance,
  ceilingAllows,
} from "@zibby/contracts";
import type { GoalFacts } from "./goal-facts";

type ParkedReason = NonNullable<GoalInstance["parkedReason"]>;

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

  constructor(
    readonly goal: Goal,
    readonly instanceKey: string,
    readonly instance: GoalInstance,
    readonly facts: GoalFacts,
    readonly now: Date,
    /** What is left of the cycle's budget; a spending handler refuses at 0. Set before acting. */
    public remainingBudget: { runs?: number; costUsd?: number } = {},
  ) {}

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
 * Applies a plan's actions, filtered by the goal's ceiling. An action the ceiling
 * forbids, or one with no registered handler yet, becomes a `report` naming what was
 * not done. A later task adds an action with one {@link register} call.
 */
@Injectable()
export class GoalActionExecutor {
  private readonly handlers = new Map<GoalActionType, GoalActionHandler<GoalActionType>>();

  constructor() {
    this.register("note", (a, ctx) => ctx.timeline("note", a.text));
    this.register("report", (a, ctx) => reportFromGoal(ctx, a.text));
    this.register("wait", (a, ctx) => {
      if (a.waitingOn) ctx.instance.waitingOn = a.waitingOn;
      if (a.wakeAt) ctx.instance.wakeAt = a.wakeAt;
      ctx.timeline(
        "wait",
        [
          a.waitingOn?.map((w) => `${w.kind}:${w.ref}`).join(", "),
          a.wakeAt ? `until ${a.wakeAt}` : undefined,
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

  async execute(actions: GoalAction[], ctx: GoalActionContext): Promise<void> {
    for (const action of actions) {
      const handler = this.handlers.get(action.type);
      if (!ceilingAllows(ctx.goal.ceiling, action.type)) {
        reportFromGoal(
          ctx,
          `Not done: ${action.type} — the goal's ceiling ${ctx.goal.ceiling} does not allow it.`,
        );
      } else if (!handler) {
        reportFromGoal(ctx, `Not done: ${action.type} — not available yet.`);
      } else {
        await handler(action, ctx);
      }
      // A finished or parked instance takes no further actions this run.
      if (ctx.instance.status === "done" || ctx.instance.status === "parked") return;
    }
  }
}
