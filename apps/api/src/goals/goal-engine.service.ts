import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { type Goal, type GoalInstance, GoalPlanSchema, type GoalState } from "@zibby/contracts";
import type { Subscription } from "rxjs";
import { ActivityEventsService } from "../activity/activity-events.service";
import { ActivityLogService } from "../activity/activity-log.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { BudgetLedgerStore } from "../budget/ledger.store";
import { WatcherHealthRegistry } from "../health/watcher-health.registry";
import { ProjectsStorageService } from "../projects/projects.storage.service";
import { LoggerService, type ScopedLogger } from "../shared/logging/logger.service";
import { isPrimaryInstance } from "../shared/instance-role";
import { TickingWatcherBase } from "../shared/ticking-watcher-base";
import { SystemConfigStore } from "../system/system-config.store";
import {
  GoalActionContext,
  GoalActionExecutor,
  type GoalBudgetLeft,
  type GoalEffect,
  parkInstance,
} from "./goal-action-executor";
import { latestCycleStart } from "./goal-cadence";
import {
  type GoalFacts,
  GoalFactsService,
  goalFingerprint,
  isTaskInFlight,
  taskFactsOf,
} from "./goal-facts";
import { GOAL_PLANNER, type GoalPlanner } from "./goal-planner";
import { GoalStateStore } from "./goal-state.store";
import { GoalsStorageService } from "./goals.storage.service";

/** Consecutive planner failures before an instance parks (`failed`). */
export const MAX_PLAN_FAILURES = 3;

/** A planner run longer than this counts as a failure (a hung run would stall every goal). */
export const PLAN_TIMEOUT_MS = 10 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;
const NO_PROJECT = "_";

/**
 * The goal heartbeat (spec "Engine"): `systemConfig.goalEngineTickMs` (default 60 s,
 * `0` disables, primary instance only — tests drive {@link tick} directly). Per enabled
 * goal: resolve instances from the scope, cycle bookkeeping, then per instance the
 * deadline park, the wake check and — only when the deterministic facts fingerprint
 * changed, `wakeAt` passed or one of its refs went dirty — one planner call whose
 * actions the {@link GoalActionExecutor} applies under the goal's ceiling. **A waiting
 * instance costs no model call.**
 *
 * State is written only through {@link GoalStateStore.update} (the path lock). The
 * planner runs outside the lock and its result is applied to the freshly read instance,
 * so an operator wake/resume made meanwhile is not overwritten.
 *
 * Approvals settling and `task-outcome` activity only mark refs dirty; the tick always
 * re-reads the truth. One goal or instance failing never blocks the others.
 */
@Injectable()
export class GoalEngineService extends TickingWatcherBase implements OnModuleInit, OnModuleDestroy {
  protected readonly log: ScopedLogger;
  protected readonly watcherId = "goal-engine" as const;
  private unsubscribe: (() => void) | null = null;
  private readonly subscriptions: Subscription[] = [];
  /** Task / approval ids that changed since the last tick. */
  private readonly dirtyRefs = new Set<string>();

  constructor(
    private readonly goals: GoalsStorageService,
    private readonly store: GoalStateStore,
    private readonly projects: ProjectsStorageService,
    private readonly facts: GoalFactsService,
    @Inject(GOAL_PLANNER) private readonly planner: GoalPlanner,
    private readonly executor: GoalActionExecutor,
    private readonly ledger: BudgetLedgerStore,
    private readonly activity: ActivityLogService,
    private readonly activityEvents: ActivityEventsService,
    private readonly approvals: ApprovalsService,
    private readonly systemConfig: SystemConfigStore,
    private readonly watcherHealthRegistry: WatcherHealthRegistry,
    logger: LoggerService,
  ) {
    super();
    this.log = logger.child(GoalEngineService.name);
  }

  onModuleInit(): void {
    this.arm();
    this.unsubscribe = this.systemConfig.onChange(() => this.arm());
    this.watcherHealthRegistry.register(() => this.watcherHealth());
    this.subscriptions.push(
      this.approvals.settled().subscribe((e) => this.markDirty(e.approvalId)),
      this.activityEvents.stream().subscribe((e) => {
        if (e.kind === "task-outcome" && e.entry.refs.taskId) {
          this.markDirty(e.entry.refs.taskId);
        }
      }),
    );
  }

  onModuleDestroy(): void {
    this.stopTimer();
    this.unsubscribe?.();
    for (const s of this.subscriptions) s.unsubscribe();
  }

  protected tickMs(): number {
    return this.systemConfig.current().goalEngineTickMs;
  }

  protected async runTick(): Promise<void> {
    await this.tick();
  }

  /** Mark a task/approval id dirty (the event subscriptions; exposed for tests). */
  markDirty(ref: string): void {
    // A secondary never ticks, so it would only grow the set.
    if (isPrimaryInstance()) this.dirtyRefs.add(ref);
  }

  async tick(now: Date = new Date()): Promise<void> {
    const dirty = new Set(this.dirtyRefs);
    this.dirtyRefs.clear();
    const goals = (await this.goals.list()).filter((g) => g.enabled);
    let projects: Promise<{ id: string; companyId?: string }[]> | null = null;
    const listProjects = () => (projects ??= this.projects.list());
    /** Refs a successfully processed instance saw; never put back. */
    const consumed = new Set<string>();
    let goalFailed = false;
    for (const goal of goals) {
      try {
        await this.tickGoal(goal, now, dirty, consumed, listProjects);
      } catch (error) {
        goalFailed = true;
        this.log.warn("goal tick failed for one goal — others unaffected", {
          goalId: goal.id,
          error: errorText(error),
        });
      }
    }
    // A failed goal's instances were never reached, so its refs are unknown: put back what
    // no processed instance consumed. Other goals do not re-plan off them.
    if (goalFailed) for (const ref of dirty) if (!consumed.has(ref)) this.dirtyRefs.add(ref);
  }

  private async instanceKeys(
    goal: Goal,
    listProjects: () => Promise<{ id: string; companyId?: string }[]>,
  ): Promise<string[]> {
    const scope = goal.scope;
    switch (scope.kind) {
      case "none":
        return [NO_PROJECT];
      case "projects":
        return [...new Set(scope.projectIds)];
      case "company":
        return (await listProjects())
          .filter((p) => p.companyId === scope.companyId)
          .map((p) => p.id);
      case "all":
        return (await listProjects()).map((p) => p.id);
    }
  }

  private async tickGoal(
    goal: Goal,
    now: Date,
    dirty: Set<string>,
    consumed: Set<string>,
    listProjects: () => Promise<{ id: string; companyId?: string }[]>,
  ): Promise<void> {
    const keys = await this.instanceKeys(goal, listProjects);
    const effects: GoalEffect[] = [];
    const state = await this.store.update(goal.id, goal.createdAt, (s) =>
      bookkeep(goal, s, keys, now, effects),
    );
    await this.flush(goal, state.cycle.index, effects);
    for (const key of Object.keys(state.instances).sort()) {
      try {
        await this.tickInstance(goal, state, key, now, dirty);
        const instance = state.instances[key];
        for (const ref of instance ? instanceRefs(instance) : []) consumed.add(ref);
      } catch (error) {
        // The refs this instance consumed go back, so the next tick still sees them.
        const instance = state.instances[key];
        for (const ref of instance ? instanceRefs(instance) : []) {
          if (dirty.has(ref)) this.dirtyRefs.add(ref);
        }
        this.log.warn("goal instance tick failed — other instances unaffected", {
          goalId: goal.id,
          instance: key,
          error: errorText(error),
        });
      }
    }
  }

  private async tickInstance(
    goal: Goal,
    state: GoalState,
    key: string,
    now: Date,
    dirty: Set<string>,
  ): Promise<void> {
    const before = state.instances[key];
    // Parked stays parked until the operator resumes it or a new cycle starts.
    if (!before || before.status === "parked" || before.status === "done") return;
    const work = structuredClone(before);
    const facts = await this.facts.collect({ goal, instanceKey: key, instance: before });
    const remainingBudget = await this.remainingBudget(goal, state, before, now);
    const ctx = new GoalActionContext(goal, key, work, facts, now, remainingBudget, (taskId) =>
      this.persistTask(goal, state.cycle.index, key, taskId),
    );
    // An operator resume in this cycle overrides the deadline and budget parks.
    const resumed = before.resumedCycle === state.cycle.index;

    const deadline = state.cycle.deadlineAt;
    if (!resumed && deadline && now.getTime() >= Date.parse(deadline)) {
      parkInstance(ctx, "deadline", `Deadline ${deadline} passed.`);
      return this.apply(goal, state, key, before, ctx);
    }
    if (!resumed && ctx.budgetExhausted && !this.inFlight(facts, before)) {
      parkInstance(ctx, "budget", "The cycle's budget is used up.");
      return this.apply(goal, state, key, before, ctx);
    }

    const fingerprint = goalFingerprint(facts);
    const wakeDue = before.wakeAt !== undefined && now.getTime() >= Date.parse(before.wakeAt);
    const isDirty = instanceRefs(before).some((ref) => dirty.has(ref));
    if (fingerprint === before.fingerprint && !wakeDue && !isDirty) return;

    ctx.activity("goal-woke", `${ctx.label}: planning`);
    let plan;
    try {
      const raw = await withTimeout(
        this.planner.plan({
          goal,
          instanceKey: key,
          ...(ctx.projectId ? { projectId: ctx.projectId } : {}),
          instance: before,
          cycle: state.cycle,
          facts,
          ceiling: goal.ceiling,
          remainingBudget,
          nudges: state.nudges,
          decisionsThisMonth: state.decisionsThisMonth,
          now: now.toISOString(),
        }),
        PLAN_TIMEOUT_MS,
      );
      const parsed = GoalPlanSchema.safeParse(raw);
      if (!parsed.success) throw new Error(`unparseable plan: ${parsed.error.issues[0]?.message}`);
      plan = parsed.data;
    } catch (error) {
      // Fingerprint cleared, so the next tick retries even when it was only a dirty ref.
      const failures = (before.planFailures ?? 0) + 1;
      work.planFailures = failures;
      delete work.fingerprint;
      ctx.timeline(
        "plan-failed",
        `Planner failed (${failures}/${MAX_PLAN_FAILURES}): ${errorText(error)}`,
      );
      if (failures >= MAX_PLAN_FAILURES) {
        parkInstance(ctx, "failed", `Planner failed ${failures} times in a row.`);
      }
      return this.apply(goal, state, key, before, ctx);
    }

    delete work.planFailures;
    // The planner re-states what it waits on; a consumed wakeAt never re-fires.
    delete work.waitingOn;
    delete work.wakeAt;
    if (plan.feasibility) ctx.timeline("feasibility", plan.feasibility);
    await this.executor.execute(plan.actions, ctx);

    if (work.status !== "done" && work.status !== "parked") {
      // Read through ctx: the handlers mutated it after the deletes above (TS narrows `work`).
      if (ctx.instance.waitingOn?.length || ctx.instance.wakeAt) work.status = "waiting";
      else if (this.inFlight(facts, work)) work.status = "acting";
      else work.status = "planning";
    }
    // Fingerprint what the next tick will see: the actions' own changes (a new wakeAt, a
    // started task) must not wake the planner again. A parked instance keeps none.
    if (work.status !== "parked") {
      work.fingerprint = goalFingerprint(
        await this.facts.collect({ goal, instanceKey: key, instance: work }),
      );
    }
    return this.apply(goal, state, key, before, ctx);
  }

  /** A task of the instance is still running (or was started and has no facts yet). */
  private inFlight(facts: GoalFacts, instance: GoalInstance): boolean {
    const tasks = taskFactsOf(facts);
    const known = new Set(tasks.map((t) => t.id));
    return tasks.some(isTaskInFlight) || instance.taskIds.some((id) => !known.has(id));
  }

  private async remainingBudget(
    goal: Goal,
    state: GoalState,
    instance: GoalInstance,
    now: Date,
  ): Promise<GoalBudgetLeft> {
    const { maxRunsPerCycle, maxCostUsdPerCycle } = goal.budget ?? {};
    const out: GoalBudgetLeft = {};
    if (maxRunsPerCycle !== undefined) out.runs = maxRunsPerCycle - instance.taskIds.length;
    if (maxCostUsdPerCycle !== undefined) {
      const spent = await this.ledger.sumCostForTasks(
        instance.taskIds,
        new Date(state.cycle.startedAt),
        now,
      );
      out.costUsd = maxCostUsdPerCycle - spent;
    }
    return out;
  }

  /** `GoalActionContext.recordTask`: the task id lands in the stored instance at once. */
  private async persistTask(goal: Goal, cycle: number, key: string, taskId: string): Promise<void> {
    await this.store.update(goal.id, goal.createdAt, (fresh) => {
      const current = fresh.instances[key];
      if (!current || fresh.cycle.index !== cycle) return;
      if (!current.taskIds.includes(taskId)) current.taskIds.push(taskId);
    });
  }

  /** Write the working copy onto the fresh instance under the lock, then the effects. */
  private async apply(
    goal: Goal,
    state: GoalState,
    key: string,
    before: GoalInstance,
    ctx: GoalActionContext,
  ): Promise<void> {
    let dropped: string | null = null;
    const fresh = await this.store.update(goal.id, goal.createdAt, (s) => {
      const current = s.instances[key];
      // A new cycle, a removed instance or a park meanwhile: this result is stale.
      if (!current) dropped = "the instance was removed";
      else if (s.cycle.index !== state.cycle.index) dropped = "a new cycle started";
      else if (current.status === "parked" && before.status !== "parked") {
        dropped = "the instance was parked meanwhile";
      }
      if (dropped || !current) return;
      const next = { ...ctx.instance };
      // Tasks recorded via recordTask are already stored; never lose one.
      next.taskIds = [...new Set([...current.taskIds, ...next.taskIds])];
      // ponytail: a wake landed while the planner ran — keep its cleared fingerprint so it
      // re-plans; finer-grained merges wait for a real need.
      if (current.fingerprint !== before.fingerprint) delete next.fingerprint;
      s.instances[key] = next;
    });
    if (!dropped) return this.flush(goal, state.cycle.index, ctx.effects);
    await this.store.appendTimeline(goal.id, {
      at: new Date().toISOString(),
      cycle: fresh.cycle.index,
      instance: key,
      kind: "note",
      text: `Tick result dropped: ${dropped}.`,
    });
  }

  private async flush(goal: Goal, cycle: number, effects: GoalEffect[]): Promise<void> {
    for (const e of effects) {
      if (e.type === "timeline") {
        await this.store.appendTimeline(goal.id, {
          at: new Date().toISOString(),
          cycle,
          instance: e.instance,
          kind: e.kind,
          text: e.text,
          ...(e.refs ? { refs: e.refs } : {}),
        });
      } else {
        await this.activity.record({ kind: e.kind, summary: e.summary, refs: e.refs });
      }
    }
  }
}

/**
 * Cycle + instance bookkeeping (runs under the state lock, no I/O): a standing goal past
 * a cadence boundary starts ONE new cycle anchored at the latest boundary (missed
 * boundaries are not replayed); a one-off goal keeps cycle 0 with the goal's deadline.
 * New in-scope projects get an instance; an instance whose project left the scope is
 * marked `done` with a note (nothing is dropped).
 */
export function bookkeep(
  goal: Goal,
  s: GoalState,
  keys: string[],
  now: Date,
  effects: GoalEffect[],
): void {
  const timeline = (instance: string, kind: string, text: string) =>
    effects.push({ type: "timeline", instance, kind, text });
  const activity = (summary: string, instance?: string) =>
    effects.push({
      type: "activity",
      kind: "goal-started",
      summary,
      refs: {
        goalId: goal.id,
        ...(instance ? { itemId: instance } : {}),
        ...(instance && instance !== NO_PROJECT ? { projectId: instance } : {}),
      },
    });
  const deadlineFrom = (start: string) =>
    goal.cycleHours === undefined
      ? undefined
      : new Date(Date.parse(start) + goal.cycleHours * HOUR_MS).toISOString();

  if (goal.cadence) {
    if (s.cycle.index === 0 && s.cycle.deadlineAt === undefined) {
      const d = deadlineFrom(s.cycle.startedAt);
      if (d) s.cycle.deadlineAt = d;
    }
    const latest = latestCycleStart(goal.cadence, new Date(s.cycle.startedAt), now);
    if (latest) {
      const startedAt = latest.toISOString();
      const deadlineAt = deadlineFrom(startedAt);
      s.cycle = { index: s.cycle.index + 1, startedAt, ...(deadlineAt ? { deadlineAt } : {}) };
      s.nudges = {};
      for (const [key, inst] of Object.entries(s.instances)) {
        if (!keys.includes(key)) continue;
        s.instances[key] = {
          status: "planning",
          taskIds: [],
          ...(inst.planNoteId ? { planNoteId: inst.planNoteId } : {}),
        };
      }
      timeline("*", "cycle-started", `Cycle ${s.cycle.index} started.`);
      activity(`${goal.name}: cycle ${s.cycle.index} started`);
    }
  } else if (goal.deadline) {
    s.cycle.deadlineAt = goal.deadline;
  } else {
    delete s.cycle.deadlineAt;
  }

  for (const key of keys) {
    if (Object.hasOwn(s.instances, key)) continue;
    s.instances[key] = { status: "planning", taskIds: [] };
    timeline(key, "instance-started", "Instance started.");
    activity(key === NO_PROJECT ? `${goal.name}: started` : `${goal.name} — ${key}: started`, key);
  }
  for (const [key, inst] of Object.entries(s.instances)) {
    if (keys.includes(key) || inst.status === "done") continue;
    inst.status = "done";
    inst.summary = "Left the goal's scope.";
    delete inst.waitingOn;
    delete inst.wakeAt;
    timeline(key, "note", "The project left the goal's scope; instance closed.");
  }
}

/** The refs whose settling wakes the instance: its tasks and what it waits on. */
function instanceRefs(instance: GoalInstance): string[] {
  return [...instance.taskIds, ...(instance.waitingOn ?? []).map((w) => w.ref)];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`planner timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
