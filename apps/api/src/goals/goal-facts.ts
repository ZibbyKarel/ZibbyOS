import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Goal, GoalInstance, ScheduledTaskStatus } from "@zibby/contracts";
import { ScheduledTasksStorageService } from "../tasks/scheduled-tasks.storage.service";

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

/** One task the instance started this cycle. `outcome` null = no outcome yet. */
export interface GoalTaskFact {
  id: string;
  status: ScheduledTaskStatus | "missing";
  outcome: "done" | "error" | null;
  /** Why it failed (the outcome summary, cut short); only for an errored task. */
  error?: string;
}

/** Enough to tell the causes apart without flooding the planner prompt. */
const ERROR_MAX = 300;

/** Task statuses that end a task without an outcome. */
const ENDED = new Set<GoalTaskFact["status"]>(["cancelled", "failed", "dead-letter", "missing"]);

/** A task still running (or queued) — the instance is `acting` while one exists. */
export function isTaskInFlight(t: GoalTaskFact): boolean {
  return t.outcome === null && !ENDED.has(t.status);
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

export function goalFingerprint(facts: GoalFacts): string {
  return createHash("sha256").update(stableStringify(facts)).digest("hex").slice(0, 32);
}

/** Task outcomes of the instance's `taskIds` (sorted by id) plus its `wakeAt`. */
@Injectable()
export class TaskFactsSource implements GoalFactsSource {
  readonly name = "tasks";

  constructor(private readonly tasks: ScheduledTasksStorageService) {}

  async collect({ instance }: GoalFactsContext): Promise<{
    tasks: GoalTaskFact[];
    wakeAt: string | null;
  }> {
    const ids = [...new Set(instance.taskIds)].sort();
    const tasks = await Promise.all(
      ids.map(async (id): Promise<GoalTaskFact> => {
        const task = await this.tasks.get(id).catch(() => null);
        if (!task) return { id, status: "missing", outcome: null };
        const outcome = task.outcome?.status ?? null;
        const error = outcome === "error" ? task.outcome?.summary.slice(0, ERROR_MAX) : undefined;
        return { id, status: task.status, outcome, ...(error ? { error } : {}) };
      }),
    );
    return { tasks, wakeAt: instance.wakeAt ?? null };
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
