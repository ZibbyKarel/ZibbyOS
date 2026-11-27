import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { ApprovalsService } from "../src/approvals/approvals.service";
import { WorkflowRunnerService } from "../src/workflows/workflow-runner.service";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until<T>(fn: () => Promise<T>, timeoutMs = 25000): Promise<NonNullable<T>> {
  const start = Date.now();
  for (;;) {
    const result = await fn();
    if (result) return result as NonNullable<T>;
    if (Date.now() - start > timeoutMs) throw new Error("until: timed out");
    await sleep(40);
  }
}

const phase = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  agent: "writer",
  consumes: `${id}.in`,
  produces: `${id}.out`,
  model: "sonnet",
  thinking: "medium",
  ...extra,
});
const parPhase = (id: string, branches: { id: string; workflow: string }[]) => ({
  id,
  type: "parallel",
  consumes: `${id}.in`,
  produces: `${id}.out`,
  branches,
});

describe("Workflow parallel phases (e2e)", () => {
  let app: INestApplication;
  const dirs: string[] = [];

  beforeAll(async () => {
    for (const k of ["workflows", "runs", "projects", "vault"]) {
      dirs.push(await fs.mkdtemp(path.join(os.tmpdir(), `parallel-${k}-`)));
    }
    process.env.WORKFLOWS_DIR = dirs[0];
    process.env.WORKFLOW_RUNS_DIR = dirs[1];
    process.env.PROJECTS_DIR = dirs[2];
    process.env.VAULT_DIR = dirs[3];
    process.env.AGENT_DEMO_STEPS = "2";
    process.env.AGENT_DEMO_DELAY_MS = "30";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const d of dirs) {
      await fs.rm(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
    for (const k of [
      "WORKFLOWS_DIR",
      "WORKFLOW_RUNS_DIR",
      "PROJECTS_DIR",
      "VAULT_DIR",
      "AGENT_DEMO_STEPS",
      "AGENT_DEMO_DELAY_MS",
      "WORKFLOW_DEMO_FAIL_PHASES",
    ]) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    delete process.env.WORKFLOW_DEMO_FAIL_PHASES;
  });

  const create = (id: string, phases: unknown[]) =>
    request(app.getHttpServer())
      .post("/api/workflows")
      .send({ id, phases, instructions: id, department: "dev" });

  const runner = () => app.get(WorkflowRunnerService);
  const settle = (id: string) =>
    until(async () => {
      const r = runner().get(id);
      return r.status !== "running" && r.status !== "parked" ? r : null;
    });
  const pendingGate = async (runId: string) => {
    const all = await app.get(ApprovalsService).list("pending");
    return all.find((a) => a.kind === "workflow-gate" && a.runId === runId) ?? null;
  };
  const childrenOf = (parentRunId: string) =>
    runner()
      .list()
      .filter((r) => r.parentRunId === parentRunId);

  it("(a) agent → parallel(2 workflows) → agent: both run, the join feeds the next phase", async () => {
    await create("pr-left", [phase("l1")]).expect(201);
    await create("pr-right", [phase("r1")]).expect(201);
    await create("pr-parent", [
      phase("a"),
      parPhase("fan", [
        { id: "left", workflow: "pr-left" },
        { id: "right", workflow: "pr-right" },
      ]),
      phase("z"),
    ]).expect(201);

    const start = await runner().start("pr-parent", undefined, undefined);
    const final = await settle(start.workflowRunId);
    expect(final.status).toBe("done");
    expect(final.pendingBranches).toBeUndefined();
    expect(final.stageRuns.map((s) => s.phaseId)).toEqual(["a", "fan", "z"]);

    const stage = final.stageRuns[1];
    expect(stage?.status).toBe("done");
    expect(stage?.childRunId).toBeUndefined();
    expect(stage?.branches?.map((b) => `${b.id}:${b.status}`)).toEqual(["left:done", "right:done"]);
    expect(childrenOf(start.workflowRunId)).toHaveLength(2);

    const dir = path.join(final.cwd, stage?.dir ?? "");
    const joined = await fs.readFile(path.join(dir, "fan.out"), "utf8");
    expect(joined).toContain("## left — pr-left (done)");
    expect(joined).toContain("## right — pr-right (done)");
    expect(joined).toContain("output of l1");
    expect(joined).toContain("output of r1");
    expect(await fs.readFile(path.join(dir, "left.md"), "utf8")).toContain("output of l1");
    expect(await fs.readFile(path.join(dir, "right.md"), "utf8")).toContain("output of r1");
    expect(await fs.readFile(path.join(final.cwd, "03_z", "z.in"), "utf8")).toContain(
      "## right — pr-right (done)",
    );
  });

  it("(b) a failing branch lets its sibling finish, then fails the stage and the run", async () => {
    process.env.WORKFLOW_DEMO_FAIL_PHASES = "boom";
    await create("pr-bad", [phase("boom")]).expect(201);
    await create("pr-good", [phase("g1")]).expect(201);
    await create("pr-bad-parent", [
      parPhase("fan", [
        { id: "bad", workflow: "pr-bad" },
        { id: "good", workflow: "pr-good" },
      ]),
      phase("z"),
    ]).expect(201);

    const start = await runner().start("pr-bad-parent", undefined, undefined);
    const final = await settle(start.workflowRunId);
    expect(final.status).toBe("failed");
    expect(final.stageRuns.map((s) => `${s.phaseId}:${s.status}`)).toEqual(["fan:error"]);
    expect(final.stageRuns[0]?.branches?.map((b) => `${b.id}:${b.status}`)).toEqual([
      "bad:failed",
      "good:done",
    ]);
    const dir = path.join(final.cwd, final.stageRuns[0]?.dir ?? "");
    expect(await fs.readFile(path.join(dir, "good.md"), "utf8")).toContain("output of g1");
  });

  it("(c) a parked branch parks the parent only once its sibling is terminal; approving finishes both", async () => {
    await create("pr-gate", [phase("c1", { approval: "ask" }), phase("c2")]).expect(201);
    await create("pr-quick", [phase("q1")]).expect(201);
    await create("pr-gate-parent", [
      parPhase("fan", [
        { id: "gated", workflow: "pr-gate" },
        { id: "quick", workflow: "pr-quick" },
      ]),
    ]).expect(201);

    const start = await runner().start("pr-gate-parent", undefined, undefined);
    const parked = await until(async () => {
      const r = runner().get(start.workflowRunId);
      return r.status === "parked" ? r : null;
    });
    expect(parked.parkedReason).toBe("child");
    // Parked only because nothing was left running.
    expect(parked.pendingBranches?.branches.map((b) => `${b.id}:${b.status}`)).toEqual([
      "gated:parked",
      "quick:done",
    ]);

    const gated = childrenOf(start.workflowRunId).find((r) => r.workflowId === "pr-gate");
    const gate = await until(() => pendingGate(gated?.workflowRunId ?? ""));
    await app.get(ApprovalsService).approve(gate.id);

    const final = await until(async () => {
      const r = runner().get(start.workflowRunId);
      return r.status === "done" ? r : null;
    });
    expect(final.stageRuns).toHaveLength(1);
    expect(final.stageRuns[0]?.branches?.map((b) => b.status)).toEqual(["done", "done"]);
  });

  it("(d) an instantly-failing branch (missing workflow) fails the stage; the sibling still runs", async () => {
    await create("pr-ok", [phase("o1")]).expect(201);
    await create("pr-missing-parent", [
      parPhase("fan", [
        { id: "ghost", workflow: "no-such-workflow" },
        { id: "ok", workflow: "pr-ok" },
      ]),
    ]).expect(201);

    const start = await runner().start("pr-missing-parent", undefined, undefined);
    const final = await settle(start.workflowRunId);
    expect(final.status).toBe("failed");
    const stage = final.stageRuns[0];
    expect(stage?.status).toBe("error");
    expect(stage?.branches?.map((b) => `${b.id}:${b.status}`)).toEqual(["ghost:failed", "ok:done"]);
    expect(stage?.branches?.[0]?.childRunId).toBeUndefined();
    const joined = await fs.readFile(path.join(final.cwd, stage?.dir ?? "", "fan.out"), "utf8");
    expect(joined).toContain("Could not start");
  });

  it("(e) every branch refused at start still joins and fails the run", async () => {
    await create("pr-none-parent", [
      parPhase("fan", [
        { id: "x", workflow: "no-such-a" },
        { id: "y", workflow: "no-such-b" },
      ]),
    ]).expect(201);
    const start = await runner().start("pr-none-parent", undefined, undefined);
    const final = await settle(start.workflowRunId);
    expect(final.status).toBe("failed");
    expect(final.stageRuns[0]?.branches?.map((b) => b.status)).toEqual(["failed", "failed"]);
  });

  it("(f) stopping a parent parked on a branch interrupts the branch and the parent", async () => {
    await create("pr-stop-gate", [phase("c1", { approval: "ask" })]).expect(201);
    await create("pr-stop-quick", [phase("q1")]).expect(201);
    await create("pr-stop-parent", [
      parPhase("fan", [
        { id: "gated", workflow: "pr-stop-gate" },
        { id: "quick", workflow: "pr-stop-quick" },
      ]),
    ]).expect(201);

    const start = await runner().start("pr-stop-parent", undefined, undefined);
    await until(async () => (runner().get(start.workflowRunId).status === "parked" ? true : null));
    await runner().stop(start.workflowRunId);
    const final = await until(async () => {
      const r = runner().get(start.workflowRunId);
      return r.status === "interrupted" ? r : null;
    });
    expect(final.pendingBranches).toBeUndefined();
    expect(
      childrenOf(start.workflowRunId)
        .map((r) => r.status)
        .sort(),
    ).toEqual(["done", "interrupted"]);
  });
});
