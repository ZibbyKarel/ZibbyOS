import { renderWithProviders as render, screen } from "../../../test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { RunView } from "../run";
import { LoopDetailPanel } from "./LoopDetailPanel";

const mutate = vi.fn();
vi.mock("../../loops/mutations", () => ({
  useResumeLoopRunMutation: () => ({ mutate, isPending: false }),
}));

// Phase 27: the iteration log disclosure mounts `RunLogStream`, which tails the child
// run via `useRunLog`. Stub it so the test doesn't need the SSE/polling backend, and
// so we can assert exactly which child runId each row opens.
const { useRunLogMock } = vi.hoisted(() => ({
  useRunLogMock: vi.fn((runId: string) => ({ text: `log-${runId}`, done: true })),
}));
vi.mock("../useRunLog", () => ({ useRunLog: useRunLogMock }));

// Phase 29: a workflow-maker iteration fetches the maker run (useWorkflowRunQuery) and
// renders its stage timeline. Stub both — the timeline itself is unit-tested separately;
// here we only assert the loop panel wires the right maker run id into it.
const { workflowRunMock } = vi.hoisted(() => ({
  workflowRunMock: vi.fn(() => ({ data: undefined as unknown })),
}));
vi.mock("../../workflows/queries", () => ({ useWorkflowRunQuery: workflowRunMock }));
vi.mock("./WorkflowStageTimeline", () => ({
  WorkflowStageTimeline: (p: { workflowRunId: string; owner: string }) => (
    <div data-testid="stage-timeline">{`${p.workflowRunId}:${p.owner}`}</div>
  ),
}));

// One stored loop: maxIterations 5, a daily run-budget of 2.
vi.mock("../../loops/queries", () => ({
  useLoopsQuery: () => ({
    data: [
      {
        id: "g1",
        objective: "do it",
        maker: { kind: "workflow", id: "delivery" },
        verifier: { kind: "claude", agent: "reviewer" },
        maxIterations: 5,
        budget: { dailyRuns: 2 },
        instructions: "iterate",
      },
    ],
  }),
}));

const ISO = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const iter = (index: number, msAgo: number) => ({
  index,
  makerKind: "workflow" as const,
  verifier: { kind: "claude" as const, satisfied: false, output: `verdict ${index}` },
  startedAt: ISO(msAgo),
  status: "done" as const,
});

function parkedLoop(reason: RunView["loopParkedReason"]): RunView {
  return {
    runId: "g1_1780000000000",
    kind: "loop",
    owner: "g1",
    status: "parked",
    pct: null,
    title: "",
    prompt: "do it",
    project: "g1_1780000000000",
    startedAt: "2026-06-14T10:00:00.000Z",
    logBase: null,
    loopId: "g1",
    iterations: [iter(0, 60_000), iter(1, 30_000)] as RunView["iterations"],
    loopParked: { iteration: 1, attempts: 2, verdictFile: "/runs/x/iteration-1.verdict.txt" },
    loopParkedReason: reason,
  };
}

describe("LoopDetailPanel (14.1)", () => {
  it("labels awaiting-resume (Law 3 restart park) with its hint", () => {
    render(<LoopDetailPanel run={parkedLoop("awaiting-resume")} />);
    expect(screen.getByText("Pozastaveno po restartu — čeká na tvé svolení")).toBeInTheDocument();
    expect(screen.getByText(/Zákon 3/)).toBeInTheDocument();
  });

  it("labels the budget park reason", () => {
    render(<LoopDetailPanel run={parkedLoop("budget")} />);
    expect(screen.getByText("Dosažen run budget smyčky")).toBeInTheDocument();
  });

  it("shows a loop-budget bar (windowed runs vs the cap) when a budget is set", () => {
    render(<LoopDetailPanel run={parkedLoop("budget")} />);
    // Two iterations within the last day, dailyRuns: 2 → "2 / 2 dnes".
    expect(screen.getByText("2 / 2 dnes")).toBeInTheDocument();
  });

  it("shows each iteration's maker kind in the timeline (kind lives in the detail)", () => {
    render(<LoopDetailPanel run={parkedLoop("iterations")} />);
    // Both iterations are workflow makers → the kind label appears per row.
    expect(screen.getAllByText("workflow").length).toBe(2);
  });

  it("renders no budget bar when no matching loop/budget is found", () => {
    // loopId "absent" → no loop matched → no budget → no bar.
    render(<LoopDetailPanel run={{ ...parkedLoop("iterations"), loopId: "absent" }} />);
    expect(screen.queryByText(/dnes|tento týden/)).not.toBeInTheDocument();
  });
});

// Phase 27 — drill into the folded maker / verifier run log from the loop detail.
describe("LoopDetailPanel (27) — open the folded child run log", () => {
  beforeEach(() => {
    useRunLogMock.mockClear();
    workflowRunMock.mockClear();
    workflowRunMock.mockReturnValue({ data: undefined });
  });

  // A running loop (no parked panel, so the only buttons are the per-row log toggles).
  const running = (iterations: RunView["iterations"]): RunView => ({
    ...parkedLoop("iterations"),
    status: "running",
    iterations,
  });

  // An agent-maker iteration with a claude verifier — both spawn pollable child runs.
  const agentIter = (index: number) => ({
    index,
    makerKind: "agent" as const,
    makerRunRef: `maker_${index}`,
    verifier: {
      kind: "claude" as const,
      satisfied: false,
      output: `verdict ${index}`,
      runRef: `verify_${index}`,
    },
    startedAt: ISO(10_000),
    status: "running" as const,
  });

  const logToggles = () => screen.getAllByRole("button", { name: /^log$/i });

  it("mounts no child log stream until a row is expanded", () => {
    render(<LoopDetailPanel run={running([agentIter(0)] as RunView["iterations"])} />);
    expect(useRunLogMock).not.toHaveBeenCalled();
  });

  it("opens the agent maker log (by makerRunRef) on the row's log toggle", async () => {
    render(<LoopDetailPanel run={running([agentIter(0)] as RunView["iterations"])} />);
    await userEvent.click(logToggles()[0]!);
    expect(useRunLogMock).toHaveBeenCalledWith("maker_0");
    expect(screen.getByText("log makera")).toBeInTheDocument();
  });

  it("reveals the claude verifier log + verdict text when expanded", async () => {
    render(<LoopDetailPanel run={running([agentIter(0)] as RunView["iterations"])} />);
    await userEvent.click(logToggles()[0]!);
    expect(useRunLogMock).toHaveBeenCalledWith("verify_0");
    expect(screen.getByText("log verifieru")).toBeInTheDocument();
    expect(screen.getByText("verdikt")).toBeInTheDocument();
  });

  it("opens the workflow maker's stage timeline (not a note) when expanded", async () => {
    workflowRunMock.mockReturnValue({
      // useWorkflowRunQuery now returns a unified TaskRun: `owner` is the workflow id.
      data: {
        runId: "delivery_run_0",
        owner: "delivery",
        currentStage: null,
        status: "done",
        stageRuns: [],
      },
    });
    const pipeIter = {
      index: 0,
      makerKind: "workflow" as const,
      makerRunRef: "delivery_run_0",
      verifier: { kind: "claude" as const, satisfied: true, output: "" },
      startedAt: ISO(10_000),
      status: "done" as const,
    };
    render(<LoopDetailPanel run={running([pipeIter] as RunView["iterations"])} />);
    await userEvent.click(logToggles()[0]!);
    // The maker run id + its workflow definition id are wired into the timeline.
    expect(screen.getByTestId("stage-timeline")).toHaveTextContent("delivery_run_0:delivery");
    // A workflow maker mounts no agent-log stream.
    expect(useRunLogMock).not.toHaveBeenCalled();
  });

  it("keeps a single iteration open — opening another collapses the first", async () => {
    render(
      <LoopDetailPanel run={running([agentIter(0), agentIter(1)] as RunView["iterations"])} />,
    );
    await userEvent.click(logToggles()[0]!);
    expect(useRunLogMock).toHaveBeenCalledWith("maker_0");

    await userEvent.click(logToggles()[1]!);
    expect(useRunLogMock).toHaveBeenCalledWith("maker_1");
    // Only one maker log is mounted at a time.
    expect(screen.getAllByText("log makera")).toHaveLength(1);
  });
});
