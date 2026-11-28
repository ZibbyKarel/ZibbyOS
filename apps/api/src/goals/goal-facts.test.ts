import type { GoalInstance, ScheduledTask } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import { type GoalTaskFact, TaskFactsSource, goalFingerprint } from "./goal-facts";

const NOW = new Date("2026-11-26T10:00:00.000Z");
const FINISHED = "2026-11-26T09:00:00.000Z";

function source(tasks: Record<string, Partial<ScheduledTask>>, runs: unknown[] = []) {
  const store = {
    get: async (id: string) => {
      const t = tasks[id];
      if (!t) throw new Error("not found");
      return t;
    },
  };
  return new TaskFactsSource(store as never, { listTaskRuns: async () => runs } as never);
}

async function collect(
  src: TaskFactsSource,
  instance: Partial<GoalInstance>,
): Promise<GoalTaskFact[]> {
  const out = await src.collect({
    goal: {} as never,
    instanceKey: "_",
    instance: { status: "planning", taskIds: [], ...instance },
    now: NOW,
  });
  return out.tasks;
}

describe("TaskFactsSource task states", () => {
  it("tells queued, running, waiting-on-operator, failed and done apart", async () => {
    const src = source({
      q: { id: "q", status: "queued" },
      r: { id: "r", status: "dispatched" },
      w: { id: "w", status: "awaiting-output" },
      f: {
        id: "f",
        status: "dispatched",
        outcome: { status: "error", summary: "boom", finishedAt: FINISHED },
      },
      c: { id: "c", status: "cancelled" },
      d: {
        id: "d",
        status: "dispatched",
        outcome: { status: "done", summary: "published: https://x/1", finishedAt: FINISHED },
      },
    });
    const tasks = await collect(src, { taskIds: ["q", "r", "w", "f", "c", "d", "gone"] });
    expect(Object.fromEntries(tasks.map((t) => [t.id, t.state]))).toEqual({
      q: "queued",
      r: "running",
      w: "waiting-operator",
      f: "failed",
      c: "failed",
      d: "done",
      gone: "failed",
    });
  });

  it("carries the finished task's outcome summary (truncated) for a done task", async () => {
    const long = "x".repeat(900);
    const src = source({
      d: {
        id: "d",
        status: "dispatched",
        outcome: { status: "done", summary: long, finishedAt: FINISHED },
      },
    });
    const [t] = await collect(src, { taskIds: ["d"] });
    expect(t?.summary).toHaveLength(500);
  });

  it("a parked run makes its task wait on the operator, with the run's reason", async () => {
    const src = source({ p: { id: "p", status: "dispatched" } }, [
      {
        runId: "run-1",
        taskId: "p",
        status: "parked",
        startedAt: "2026-11-26T09:00:00Z",
        parked: { phaseId: "build", attempts: 3, failureFile: "/f", note: "tests keep failing" },
      },
    ]);
    const [t] = await collect(src, { taskIds: ["p"] });
    expect(t).toMatchObject({ state: "waiting-operator" });
    expect(t?.reason).toContain("tests keep failing");
  });

  it("a run waiting for approval waits on the operator; a limit-paused run is still running", async () => {
    const src = source(
      { a: { id: "a", status: "dispatched" }, l: { id: "l", status: "dispatched" } },
      [
        {
          runId: "r1",
          taskId: "a",
          status: "awaiting-approval",
          startedAt: "2026-11-26T09:00:00Z",
        },
        { runId: "r2", taskId: "l", status: "paused-limit", startedAt: "2026-11-26T09:00:00Z" },
      ],
    );
    const tasks = await collect(src, { taskIds: ["a", "l"] });
    expect(tasks.map((t) => t.state)).toEqual(["waiting-operator", "running"]);
  });

  it("a run lookup failure degrades to running, never throws", async () => {
    const src = new TaskFactsSource(
      { get: async () => ({ id: "x", status: "dispatched" }) } as never,
      {
        listTaskRuns: async () => {
          throw new Error("disk");
        },
      } as never,
    );
    const [t] = await collect(src, { taskIds: ["x"] });
    expect(t?.state).toBe("running");
  });

  it("lists a carried task only while it is live, marked carried with its step", async () => {
    const src = source({
      live: { id: "live", status: "queued" },
      ended: {
        id: "ended",
        status: "dispatched",
        outcome: { status: "done", summary: "ok", finishedAt: FINISHED },
      },
    });
    const tasks = await collect(src, {
      carriedTasks: [
        { taskId: "live", stepId: "book-1" },
        { taskId: "ended", stepId: "book-2" },
        { taskId: "gone" },
      ],
    });
    expect(tasks).toEqual([
      expect.objectContaining({ id: "live", state: "queued", carried: true, stepId: "book-1" }),
    ]);
  });
});

describe("goalFingerprint", () => {
  const facts = (status: string, state: string) => ({
    tasks: { tasks: [{ id: "t", status, state, outcome: null }], wakeAt: null },
  });
  it("does not change when a task only moves from queued to running", () => {
    expect(goalFingerprint(facts("queued", "queued"))).toBe(
      goalFingerprint(facts("dispatched", "running")),
    );
  });
  it("changes when a task starts waiting on the operator", () => {
    expect(goalFingerprint(facts("dispatched", "running"))).not.toBe(
      goalFingerprint(facts("dispatched", "waiting-operator")),
    );
  });
});
