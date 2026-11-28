import { createHash } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import type { Goal, GoalInstance, ScheduledTaskStatus, TaskRun } from "@zibby/contracts";
import { ScheduledTasksStorageService } from "../tasks/scheduled-tasks.storage.service";
import { TaskRunsService } from "../tasks/task-runs.service";

/**
 * What a facts source sees. `now` is only for coarse buckets (a PR's age in days): a fact
 * that changes every tick defeats the wake check.
 */
export interface GoalFactsContext {
  goal: Goal;
  /** projectId, or "_" for a goal without a project. */
  instanceKey: string;
  instance: GoalInstance;
  now: Date;
}

/**
 * One cheap, deterministic source of facts for the wake check (no model call). Its
 * value lands under `facts[name]`. Add a source by providing it in the
 * {@link GOAL_FACTS_SOURCES} factory in `goal-engine.module.ts`.
 */
export interface GoalFactsSource {
  readonly name: string;
  /** `undefined` = nothing to say for this instance (left out of the facts and the fingerprint). */
  collect(ctx: GoalFactsContext): Promise<unknown>;
  /** Called at the start of every tick: drop a per-tick memo (fetch once per tick, not per instance). */
  beginTick?(): void;
}

/** DI token: the `GoalFactsSource[]` the engine fingerprints. */
export const GOAL_FACTS_SOURCES = "GOAL_FACTS_SOURCES";

/** The snapshot the planner receives: `{ [source.name]: value }`. */
export type GoalFacts = Record<string, unknown>;

/**
 * Where a task stands, for the planner and the engine: `queued` (waiting for a run slot or a
 * fire time), `running`, `waiting-operator` (parked, awaiting approval/output or held: only the
 * operator moves it), `failed` (error outcome, cancelled, dead-lettered or gone), `done`.
 */
export type GoalTaskState = "queued" | "running" | "waiting-operator" | "failed" | "done";

/** One task the instance started this cycle. `outcome` null = no outcome yet. */
export interface GoalTaskFact {
  id: string;
  status: ScheduledTaskStatus | "missing";
  state: GoalTaskState;
  outcome: "done" | "error" | null;
  /** Why it failed (the outcome summary, cut short); only for an errored task. */
  error?: string;
  /** Why it waits on the operator (the run's park note / reason), when known. */
  reason?: string;
  /** What a done task reported (publication links, status), cut short. */
  summary?: string;
  /** A task of the previous cycle still live: it counts toward this cycle's plan. */
  carried?: true;
  /** The step a carried task worked on (its id in the previous cycle). */
  stepId?: string;
}

/** Enough to tell the causes apart without flooding the planner prompt. */
const ERROR_MAX = 300;
/** A done task's reported outcome (links, status) is a little longer than an error. */
const SUMMARY_MAX = 500;

/** Task statuses that end a task without an outcome. */
const ENDED = new Set<GoalTaskFact["status"]>(["cancelled", "failed", "dead-letter", "missing"]);

/** A task still queued, running or waiting on the operator — the instance is `acting` while one exists. */
export function isTaskInFlight(t: GoalTaskFact): boolean {
  return t.outcome === null && !ENDED.has(t.status);
}

/** Task statuses that wait for the operator, not for a slot or a run. */
const WAITING_TASK_STATUSES = new Set<GoalTaskFact["status"]>(["awaiting-output", "held"]);
/** Task statuses that wait for a slot or a fire time. */
const QUEUED_TASK_STATUSES = new Set<GoalTaskFact["status"]>(["queued", "scheduled"]);
/** Run statuses that wait for the operator (a `paused-limit` run resumes by itself). */
const WAITING_RUN_STATUSES = new Set<string>(["parked", "awaiting-approval", "held", "paused"]);

function runReason(run: TaskRun): string {
  const parts: string[] = [`run ${run.status}`];
  if (run.parked) {
    parts.push(`phase ${run.parked.phaseId} after ${run.parked.attempts} attempts`);
    if (run.parked.note) parts.push(run.parked.note);
  }
  if (run.loopParkedReason) parts.push(`loop parked (${run.loopParkedReason})`);
  if (run.heldReason) parts.push(run.heldReason);
  return parts.join(": ").slice(0, ERROR_MAX);
}

/** JSON with object keys sorted, so equal facts always hash equal. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * The facts as the wake check sees them: a task moving between `queued` and `running` is not a
 * change worth a planner run (with many parallel tasks, every slot hand-over would be one).
 */
function wakeFacts(facts: GoalFacts): GoalFacts {
  const block = facts.tasks as { tasks?: unknown } | undefined;
  if (!block || !Array.isArray(block.tasks)) return facts;
  const tasks = (block.tasks as GoalTaskFact[]).map((t) =>
    t.state === "queued" || t.state === "running"
      ? { ...t, status: undefined, state: "active" }
      : t,
  );
  return { ...facts, tasks: { ...block, tasks } };
}

export function goalFingerprint(facts: GoalFacts): string {
  return createHash("sha256")
    .update(stableStringify(wakeFacts(facts)))
    .digest("hex")
    .slice(0, 32);
}

/**
 * Task outcomes of the instance's `taskIds` (sorted by id), the still-live tasks carried over
 * from the previous cycle, plus its `wakeAt`. Whether a dispatched task's run waits for the
 * operator is read from the run feed (once per tick, only when a dispatched task needs it).
 */
@Injectable()
export class TaskFactsSource implements GoalFactsSource {
  readonly name = "tasks";
  private runs: Promise<Map<string, TaskRun>> | null = null;

  constructor(
    private readonly tasks: ScheduledTasksStorageService,
    /** Optional: without it a dispatched task is simply `running`. */
    @Optional() private readonly taskRuns?: TaskRunsService,
  ) {}

  beginTick(): void {
    this.runs = null;
  }

  /** The newest run of each task, by task id. A failed read means no run info. */
  private runsByTask(): Promise<Map<string, TaskRun>> {
    this.runs ??= (this.taskRuns?.listTaskRuns() ?? Promise.resolve([] as TaskRun[]))
      .then((runs) => {
        const byTask = new Map<string, TaskRun>();
        for (const r of runs) {
          if (!r.taskId) continue;
          const have = byTask.get(r.taskId);
          if (!have || r.startedAt > have.startedAt) byTask.set(r.taskId, r);
        }
        return byTask;
      })
      .catch(() => new Map<string, TaskRun>());
    return this.runs;
  }

  private async factOf(id: string): Promise<GoalTaskFact> {
    const task = await this.tasks.get(id).catch(() => null);
    if (!task) return { id, status: "missing", state: "failed", outcome: null };
    const outcome = task.outcome?.status ?? null;
    if (outcome === "error") {
      const error = task.outcome?.summary.slice(0, ERROR_MAX);
      return { id, status: task.status, state: "failed", outcome, ...(error ? { error } : {}) };
    }
    if (outcome === "done") {
      const summary = task.outcome?.summary.slice(0, SUMMARY_MAX);
      return { id, status: task.status, state: "done", outcome, ...(summary ? { summary } : {}) };
    }
    if (ENDED.has(task.status)) return { id, status: task.status, state: "failed", outcome };
    if (WAITING_TASK_STATUSES.has(task.status)) {
      return { id, status: task.status, state: "waiting-operator", outcome, reason: task.status };
    }
    if (QUEUED_TASK_STATUSES.has(task.status)) {
      return { id, status: task.status, state: "queued", outcome };
    }
    // Dispatched (or being dispatched): its run says whether it is parked or queued.
    const run = (await this.runsByTask()).get(id);
    if (run && WAITING_RUN_STATUSES.has(run.status)) {
      return {
        id,
        status: task.status,
        state: "waiting-operator",
        outcome,
        reason: runReason(run),
      };
    }
    if (run?.status === "queued") return { id, status: task.status, state: "queued", outcome };
    return { id, status: task.status, state: "running", outcome };
  }

  async collect({ instance }: GoalFactsContext): Promise<{
    tasks: GoalTaskFact[];
    wakeAt: string | null;
  }> {
    const ids = [...new Set(instance.taskIds)].sort();
    const own = await Promise.all(ids.map((id) => this.factOf(id)));
    const carried: GoalTaskFact[] = [];
    for (const c of instance.carriedTasks ?? []) {
      if (ids.includes(c.taskId)) continue;
      const fact = await this.factOf(c.taskId);
      // Only a task still alive is carried: an ended one belongs to the closed cycle.
      if (fact.outcome === null && fact.state !== "failed") {
        carried.push({ ...fact, carried: true, ...(c.stepId ? { stepId: c.stepId } : {}) });
      }
    }
    return { tasks: [...own, ...carried], wakeAt: instance.wakeAt ?? null };
  }
}

/** Collects every registered source. A source that throws fails the instance's tick. */
@Injectable()
export class GoalFactsService {
  constructor(@Inject(GOAL_FACTS_SOURCES) private readonly sources: GoalFactsSource[]) {}

  beginTick(): void {
    for (const source of this.sources) source.beginTick?.();
  }

  async collect(ctx: GoalFactsContext): Promise<GoalFacts> {
    const facts: GoalFacts = {};
    for (const source of this.sources) {
      const value = await source.collect(ctx);
      if (value !== undefined) facts[source.name] = value;
    }
    return facts;
  }
}

/** The task facts the built-in source produced (empty when it is not registered). */
export function taskFactsOf(facts: GoalFacts): GoalTaskFact[] {
  const tasks = (facts.tasks as { tasks?: GoalTaskFact[] } | undefined)?.tasks;
  return Array.isArray(tasks) ? tasks : [];
}
