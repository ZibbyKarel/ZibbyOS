import { describe, expect, it } from "vitest";
import type { Workflow } from "../../domain";
import type { RunView } from "../runs/run";
import {
  activePhaseNumber,
  latestWorkflowRun,
  pipelineStates,
  runMinutes,
  workflowMatches,
} from "./workflowListModel";

const phases = [
  { id: "plan", type: "agent", agent: "architekt" },
  { id: "impl", type: "agent", agent: "kodér" },
  { id: "test", type: "agent", agent: "tester" },
] as Workflow["phases"];

const run = (over: Partial<RunView>) =>
  ({
    runId: "r",
    kind: "workflow",
    owner: "wf",
    status: "running",
    startedAt: "2026-11-19T10:00:00Z",
    ...over,
  }) as RunView;

describe("pipelineStates", () => {
  it("marks done and active stages of a running run", () => {
    const r = run({
      currentStage: "impl",
      stageRuns: [{ phaseId: "plan", status: "done" }] as RunView["stageRuns"],
    });
    expect(pipelineStates(phases, r)).toEqual(["done", "active", "idle"]);
    expect(activePhaseNumber(phases, r)).toBe(2);
  });
  it("stays idle without a running run", () => {
    expect(pipelineStates(phases, run({ status: "done" }))).toEqual(["idle", "idle", "idle"]);
    expect(pipelineStates(phases, null)).toEqual(["idle", "idle", "idle"]);
    expect(activePhaseNumber(phases, null)).toBeNull();
  });
});

describe("latestWorkflowRun / runMinutes", () => {
  it("picks the newest run owned by the workflow", () => {
    const runs = [
      run({ runId: "old", startedAt: "2026-11-18T10:00:00Z" }),
      run({ runId: "new" }),
      run({ runId: "other", owner: "x" }),
    ];
    expect(latestWorkflowRun(runs, "wf")?.runId).toBe("new");
  });
  it("derives whole minutes, at least 1", () => {
    expect(runMinutes(run({ taskOutcomeFinishedAt: "2026-11-19T10:09:20Z" }))).toBe(9);
    expect(runMinutes(run({ taskOutcomeFinishedAt: "2026-11-19T10:00:05Z" }))).toBe(1);
    expect(runMinutes(run({}))).toBeNull();
  });
});

describe("workflowMatches", () => {
  const wf = { id: "pr", name: "Od issue k PR", phases } as Workflow;
  it("matches name or agent", () => {
    expect(workflowMatches(wf, "issue", [])).toBe(true);
    expect(workflowMatches(wf, "kodér", [])).toBe(true);
    expect(workflowMatches(wf, "zzz", [])).toBe(false);
  });
});
