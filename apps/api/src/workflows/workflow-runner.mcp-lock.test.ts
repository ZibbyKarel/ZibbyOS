import { describe, expect, it, vi } from "vitest";
import { McpExclusiveLocksService } from "../mcp/mcp-exclusive-locks.service";
import { WorkflowRunnerService } from "./workflow-runner.service";

/** A runner with only what `runStage` / `gated` touch; stage execution itself is stubbed. */
function makeRunner(tools: string[], unlocked: () => Promise<unknown>) {
  const locks = new McpExclusiveLocksService({
    list: async () => [
      {
        id: "pw-mw",
        type: "stdio",
        args: ["-c", "exec playwright-mcp --user-data-dir /p"],
        enabled: true,
        hasCredentials: false,
      },
    ],
  } as never);
  const svc = Object.create(WorkflowRunnerService.prototype) as Record<string, unknown>;
  svc.mcpLocks = locks;
  svc.agents = { get: async () => ({ tools }) };
  svc.log = { info: vi.fn() };
  svc.slotGate = null;
  svc.runStageUnlocked = vi.fn(unlocked);
  const call = (id: string) =>
    (
      svc.runStage as (
        run: unknown,
        phase: unknown,
        cwd: string,
        attempt: number,
        project: null,
      ) => Promise<unknown>
    ).call(svc, { workflowRunId: `run_${id}` }, { id, agent: "publisher" }, "/tmp", 1, null);
  return { svc, locks, call };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("WorkflowRunnerService.runStage — exclusive MCP server lock", () => {
  it("serialises two stages that use the same browser profile, FIFO, and frees the lock after", async () => {
    const gates = [deferred(), deferred()];
    const started: number[] = [];
    let i = 0;
    const { svc, locks, call } = makeRunner(["mcp__pw-mw__*"], async () => {
      const n = i++;
      started.push(n);
      await gates[n]?.promise;
      return { status: "done" };
    });

    const first = call("a");
    const second = call("b");
    await vi.waitFor(() => expect(started).toEqual([0]));
    await new Promise((r) => setTimeout(r, 20));
    expect(started).toEqual([0]); // the second waits, it does not fail or start

    gates[0]?.resolve();
    await first;
    await vi.waitFor(() => expect(started).toEqual([0, 1]));
    gates[1]?.resolve();
    await second;
    expect(locks.isFree(["pw-mw"])).toBe(true);
    expect(svc.runStageUnlocked).toHaveBeenCalledTimes(2);
  });

  it("releases the lock when the stage throws, so a crashed holder never leaks it", async () => {
    const { locks, call } = makeRunner(["mcp__pw-mw__*"], async () => {
      throw new Error("spawn failed");
    });
    await expect(call("a")).rejects.toThrow("spawn failed");
    expect(locks.isFree(["pw-mw"])).toBe(true);
  });

  it("does not serialise stages whose agent has no exclusive server", async () => {
    const gate = deferred();
    let running = 0;
    let peak = 0;
    const { call } = makeRunner(["Read", "Write"], async () => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
      return {};
    });
    const a = call("a");
    const b = call("b");
    await vi.waitFor(() => expect(peak).toBe(2));
    gate.resolve();
    await Promise.all([a, b]);
  });
});

describe("WorkflowRunnerService.gated — approval resume through the run-slot gate", () => {
  function runnerWithGate(gate: ReturnType<typeof vi.fn> | null) {
    const svc = Object.create(WorkflowRunnerService.prototype) as WorkflowRunnerService;
    (svc as unknown as { slotGate: unknown }).slotGate = gate;
    return svc as unknown as {
      gated: (ref: string | undefined, resume: () => Promise<unknown>) => Promise<void>;
    };
  }

  it("resumes directly without a scheduler gate", async () => {
    const resume = vi.fn(async () => {});
    await runnerWithGate(null).gated("run_1", resume);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("hands the resume to the gate, which decides when to run it", async () => {
    const resume = vi.fn(async () => {});
    const gate = vi.fn(async () => {}); // a gate that queues and never calls resume yet
    await runnerWithGate(gate).gated("run_1", resume);
    expect(gate).toHaveBeenCalledWith("workflow", "run_1", expect.any(Function));
    expect(resume).not.toHaveBeenCalled();
  });

  it("bypasses the gate for an unknown run", async () => {
    const resume = vi.fn(async () => {});
    const gate = vi.fn(async () => {});
    await runnerWithGate(gate).gated(undefined, resume);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(gate).not.toHaveBeenCalled();
  });
});
