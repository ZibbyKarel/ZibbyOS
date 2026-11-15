import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import type { RunView } from "../../runs/run";
import { RunsWidgetCard, RunsWidgetCardTestId, mergeRuns } from "./RunsWidgetCard";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";

const run = (id: string, status: RunView["status"], projectId = "alpha"): RunView =>
  ({
    runId: id,
    kind: "agent",
    owner: "writer",
    status,
    title: `Run ${id}`,
    prompt: "",
    project: "",
    projectId,
    startedAt: "2026-11-15T08:00:00.000Z",
    logBase: "agents",
  }) as RunView;

const { live, archived } = vi.hoisted(() => ({ live: vi.fn(), archived: vi.fn() }));
vi.mock("../../runs/components/TasksDockPanel", () => ({
  useLiveRunsSnapshot: live,
  useInvalidateOnTerminalRun: () => undefined,
}));
vi.mock("../../runs/queries/useRecentArchivedRunsQuery", () => ({
  useRecentArchivedRunsQuery: archived,
}));
vi.mock("../../runs/queries/useRunsQuery", () => ({
  useRunsQuery: () => ({ isPending: false, isError: false, refetch: vi.fn() }),
}));

describe("RunsWidgetCard", () => {
  it("mergeRuns puts live first, dedupes and filters by project", () => {
    const merged = mergeRuns(
      [run("a", "running")],
      [run("a", "done"), run("b", "done", "beta")],
      "alpha",
    );
    expect(merged.map((r) => r.runId)).toEqual(["a"]);
  });

  it("renders rows linking to the run detail with state text", () => {
    live.mockReturnValue({ runs: [run("r1", "running")], updatedAt: 1 });
    archived.mockReturnValue({ data: [run("r2", "done")], isPending: false, isError: false });
    render(<RunsWidgetCard widget={{ kind: "runs", limit: 1 }} />);
    expect(screen.getByTestId(RunsWidgetCardTestId.Root)).toBeInTheDocument();
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-r1`)).toHaveAttribute(
      "href",
      "/activity/runs/r1",
    );
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.RowStatus}-r1`)).toHaveTextContent("běží");
    expect(screen.getByTestId(ChatWidgetFrameTestId.More)).toHaveTextContent("+1 dalších");
  });
});
