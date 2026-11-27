import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import {
  AGENT_ID_REGEX,
  type GoalState,
  GoalStateSchema,
  type GoalTimelineEvent,
  GoalTimelineEventSchema,
  emptyGoalState,
} from "@zibby/contracts";
import { ensureDir, safeJson, withPathLock, writeFileAtomic } from "../shared/file-storage";
import {
  GoalInstanceNotFoundError,
  GoalInstanceNotParkedError,
  InvalidGoalIdError,
} from "./goals.errors";
import { GOALS_DIR } from "./goals.storage.service";

export const TIMELINE_CAP = 500;

export interface TimelineQuery {
  instance?: string;
  cycle?: number;
}

/**
 * `<goals dir>/state/<id>/state.json` + append-only `timeline.jsonl`. Display reads fail
 * open: a missing or corrupt file reads as an empty state / skipped line. The write paths
 * (update, wake, resume) throw on a corrupt state file instead of overwriting it.
 */
@Injectable()
export class GoalStateStore {
  private readonly root: string;
  private readonly events = new EventEmitter().setMaxListeners(0);

  constructor(@Inject(GOALS_DIR) goalsDir: string) {
    this.root = path.join(path.resolve(goalsDir), "state");
  }

  private dirOf(goalId: string): string {
    if (!AGENT_ID_REGEX.test(goalId)) throw new InvalidGoalIdError(goalId);
    return path.join(this.root, goalId);
  }

  /** `startedAt` seeds the empty state of a goal that has none yet. */
  async read(goalId: string, startedAt: string): Promise<GoalState> {
    const raw = await fs
      .readFile(path.join(this.dirOf(goalId), "state.json"), "utf8")
      .catch(() => null);
    const parsed = raw === null ? null : GoalStateSchema.safeParse(safeJson(raw));
    return parsed?.success ? parsed.data : emptyGoalState(goalId, startedAt);
  }

  /**
   * The read every write path starts from: a missing file is the empty state, but an existing
   * file that does not parse throws — writing an empty state over it would wipe `taskIds`,
   * `appliedActionIds` and `nudges` (a hand edit or a downgrade must not reset the work).
   */
  private async readForWrite(goalId: string, startedAt: string): Promise<GoalState> {
    const file = path.join(this.dirOf(goalId), "state.json");
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyGoalState(goalId, startedAt);
      }
      throw error;
    }
    const parsed = GoalStateSchema.safeParse(safeJson(raw));
    if (parsed.success) return parsed.data;
    throw new Error(
      `goal state ${file} does not parse (${parsed.error.issues[0]?.message ?? "invalid JSON"}) — not overwriting it`,
    );
  }

  /** Fires with the goal id after every state or timeline write (the SSE `goals` scope). */
  onChange(listener: (goalId: string) => void): () => void {
    this.events.on("change", listener);
    return () => this.events.off("change", listener);
  }

  write(state: GoalState): Promise<void> {
    const dir = this.dirOf(state.goalId);
    return withPathLock(dir, () => this.writeUnlocked(dir, state));
  }

  /**
   * Read, mutate and write under the path lock, so a concurrent wake/resume is never lost.
   * An unchanged state is not rewritten (no change event), so an idle tick stays silent.
   */
  update(
    goalId: string,
    startedAt: string,
    fn: (state: GoalState) => void | Promise<void>,
  ): Promise<GoalState> {
    const dir = this.dirOf(goalId);
    return withPathLock(dir, async () => {
      const state = await this.readForWrite(goalId, startedAt);
      const before = JSON.stringify(state);
      await fn(state);
      if (JSON.stringify(state) !== before) await this.writeUnlocked(dir, state);
      return state;
    });
  }

  private async writeUnlocked(dir: string, state: GoalState): Promise<void> {
    await ensureDir(dir);
    await writeFileAtomic(path.join(dir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
    this.events.emit("change", state.goalId);
  }

  appendTimeline(goalId: string, event: GoalTimelineEvent): Promise<void> {
    const dir = this.dirOf(goalId);
    return withPathLock(dir, () => this.appendUnlocked(dir, event));
  }

  private async appendUnlocked(dir: string, event: GoalTimelineEvent): Promise<void> {
    await ensureDir(dir);
    await fs.appendFile(path.join(dir, "timeline.jsonl"), `${JSON.stringify(event)}\n`);
    this.events.emit("change", path.basename(dir));
  }

  /** Newest last, capped at the last {@link TIMELINE_CAP} matches. */
  async timeline(goalId: string, q: TimelineQuery = {}): Promise<GoalTimelineEvent[]> {
    const raw = await fs
      .readFile(path.join(this.dirOf(goalId), "timeline.jsonl"), "utf8")
      .catch(() => "");
    const events: GoalTimelineEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const parsed = GoalTimelineEventSchema.safeParse(safeJson(line));
      if (!parsed.success) continue;
      const e = parsed.data;
      if (q.instance !== undefined && e.instance !== q.instance) continue;
      if (q.cycle !== undefined && e.cycle !== q.cycle) continue;
      events.push(e);
    }
    return events.slice(-TIMELINE_CAP);
  }

  /**
   * Clear every instance's fingerprint so the engine re-plans. A held instance (autonomy
   * `manual`) gets `operatorWake`: one pass as `semi`. Only held ones, so the mark never lingers
   * on a running or parked instance to grant a pass later.
   */
  wake(goalId: string, startedAt: string): Promise<GoalState> {
    const dir = this.dirOf(goalId);
    return withPathLock(dir, async () => {
      const state = await this.readForWrite(goalId, startedAt);
      for (const instance of Object.values(state.instances)) {
        delete instance.fingerprint;
        delete instance.limitedUntil;
        if (instance.held && instance.status !== "parked" && instance.status !== "done") {
          instance.operatorWake = true;
        }
      }
      await this.writeUnlocked(dir, state);
      await this.appendUnlocked(dir, {
        at: new Date().toISOString(),
        cycle: state.cycle.index,
        instance: "*",
        kind: "wake",
        text: "Woken by the operator; every instance will re-plan.",
      });
      return state;
    });
  }

  /** Parked → planning. Unknown instance → not-found, not parked → not-parked. */
  resume(goalId: string, instance: string, startedAt: string): Promise<GoalState> {
    const dir = this.dirOf(goalId);
    return withPathLock(dir, async () => {
      const state = await this.readForWrite(goalId, startedAt);
      const target = Object.hasOwn(state.instances, instance)
        ? state.instances[instance]
        : undefined;
      if (!target) throw new GoalInstanceNotFoundError(goalId, instance);
      if (target.status !== "parked") throw new GoalInstanceNotParkedError(goalId, instance);
      target.status = "planning";
      delete target.parkedReason;
      // Resume takes effect: no deadline/budget re-park this cycle, a fresh failure count.
      target.resumedCycle = state.cycle.index;
      // Budget grace ends once one more run is recorded past this point.
      target.resumedRuns = target.taskIds.length;
      delete target.planFailures;
      delete target.limitedUntil;
      // A wake that landed before the park must not buy the resumed instance an extra semi pass.
      delete target.operatorWake;
      await this.writeUnlocked(dir, state);
      await this.appendUnlocked(dir, {
        at: new Date().toISOString(),
        cycle: state.cycle.index,
        instance,
        kind: "resume",
        text: "Resumed by the operator.",
      });
      return state;
    });
  }

  /** Remove a goal's whole state dir (no-op when absent). */
  async remove(goalId: string): Promise<void> {
    await fs.rm(this.dirOf(goalId), { recursive: true, force: true });
  }
}
