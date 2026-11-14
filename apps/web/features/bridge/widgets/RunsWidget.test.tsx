import { BoardSectionTestId, ProgressTestId, StatusRailTestId } from "@zibby/design-system";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../../../test/render";
import type { BridgeWidget } from "../grid/layout";
import type { BridgeWidgetProps } from "./registry";
import { RunsWidget, RunsWidgetTestId } from "./RunsWidget";

const d = vi.hoisted(() => ({
  live: [] as unknown[],
  archived: [] as unknown[],
  liveAt: 0,
  archivedAt: 0,
  approvals: [] as unknown[],
  approve: vi.fn(),
}));

vi.mock("../../runs/components/TasksDockPanel", () => ({
  useLiveRunsSnapshot: () => ({ runs: d.live, updatedAt: d.liveAt }),
  useInvalidateOnTerminalRun: () => undefined,
}));
vi.mock("../../runs/queries/useRecentArchivedRunsQuery", () => ({
  useRecentArchivedRunsQuery: () => ({
    data: d.archived,
    isPending: false,
    dataUpdatedAt: d.archivedAt,
  }),
}));
vi.mock("../../workflows", () => ({ useWorkflowsQuery: () => ({ data: [] }) }));
vi.mock("../../approvals", () => ({
  useApprovalsQuery: () => ({ data: d.approvals }),
  useApproveMutation: () => ({ mutate: d.approve, isPending: false }),
  useRejectMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const widget: BridgeWidget = { id: "w-r", type: "runs", x: 0, y: 0, w: 4, h: 8 };
const props: BridgeWidgetProps = {
  widget,
  adding: false,
  onEmptyChange: vi.fn(),
  onCountChange: vi.fn(),
  selection: null,
  onOpen: vi.fn(),
  epicClosed: {},
  onEpicToggle: vi.fn(),
};
const run = (runId: string, status: string) => ({
  runId,
  status,
  kind: "task",
  owner: "wf",
  project: "p",
  title: runId,
  startedAt: "2026-10-27T10:00:00Z",
});
const key = (runId: string) => `${widget.id}:${runId}`;

beforeEach(() => {
  d.live = [run("a", "running"), run("b", "awaiting-approval")];
  d.archived = [run("c", "error"), run("d", "done")];
  d.liveAt = 0;
  d.archivedAt = 0;
  d.approvals = [];
});
const dot = (id: string) =>
  within(
    screen
      .getAllByTestId(StatusRailTestId.Item)
      .find((r) => r.getAttribute("data-rk") === key(id))!,
  ).getByTestId(StatusRailTestId.Dot);

describe("RunsWidget", () => {
  // todo-16: the old task queue widget's runs sit in the Active group, below the running ones.
  describe("queued runs in the Active group (todo-16)", () => {
    beforeEach(() => {
      d.live = [
        { ...run("q", "queued"), taskId: "t-q" },
        run("a", "running"),
        { ...run("s", "scheduled"), kind: "scheduled" },
        { ...run("h", "held"), taskId: "t-h" },
        run("b", "awaiting-approval"),
      ];
      d.archived = [];
    });
    const rowKeys = () =>
      screen.getAllByTestId(StatusRailTestId.Item).map((r) => r.getAttribute("data-rk"));

    it("lists running, then parked, then queued runs under overline sections", () => {
      renderWithProviders(<RunsWidget {...props} />);
      expect(screen.getAllByTestId(BoardSectionTestId.Label).map((h) => h.textContent)).toEqual([
        "Zaparkováno",
        "Ve frontě",
      ]);
      expect(rowKeys()).toEqual(["a", "b", "q", "s", "h"].map(key));
    });

    it("marks queued rows with their waiting state and counts them", () => {
      renderWithProviders(<RunsWidget {...props} />);
      for (const id of ["q", "s", "h"])
        expect(screen.getByTestId(`${RunsWidgetTestId.Queued}-${key(id)}`)).toBeInTheDocument();
      for (const id of ["a", "b"])
        expect(screen.queryByTestId(`${RunsWidgetTestId.Queued}-${key(id)}`)).toBeNull();
      expect(screen.getByTestId(`${RunsWidgetTestId.Queued}-${key("q")}`)).toHaveTextContent(
        "ve frontě",
      );
      expect(props.onCountChange).toHaveBeenLastCalledWith(expect.objectContaining({ count: 5 }));
    });

    it("a queued row opens its task (scheduled: its own id)", async () => {
      renderWithProviders(<RunsWidget {...props} />);
      const row = screen
        .getAllByTestId(StatusRailTestId.Item)
        .find((r) => r.getAttribute("data-rk") === key("s"));
      await userEvent.click(row as HTMLElement);
      expect(props.onOpen).toHaveBeenLastCalledWith({
        kind: "task",
        id: "s",
        widgetId: widget.id,
        key: key("s"),
        href: "/work/tasks/s",
      });
    });
  });

  it("shows a progress bar only for the running run", () => {
    renderWithProviders(<RunsWidget {...props} />);
    expect(screen.getAllByTestId(new RegExp(`^${RunsWidgetTestId.Progress}-`))).toHaveLength(1);
    const bar = screen.getByTestId(`${RunsWidgetTestId.Progress}-${key("a")}`);
    expect(within(bar).getByTestId(ProgressTestId.Root)).toBeInTheDocument();
    for (const id of ["b", "c", "d"])
      expect(screen.queryByTestId(`${RunsWidgetTestId.Progress}-${key(id)}`)).toBeNull();
  });

  it("shows only the elapsed time under a running bar without phases (no phase count)", () => {
    vi.useFakeTimers({ now: Date.parse("2026-10-27T10:03:12Z"), toFake: ["Date"] });
    try {
      renderWithProviders(<RunsWidget {...props} />);
      const meta = screen.getByTestId(`${RunsWidgetTestId.Meta}-${key("a")}`);
      expect(meta).toHaveTextContent("3m 12s");
      expect(meta).not.toHaveTextContent(/phase|fáz/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("colours the state dot by state", () => {
    renderWithProviders(<RunsWidget {...props} />);
    expect(dot("a")).toHaveAttribute("data-state", "working");
    expect(dot("b")).toHaveAttribute("data-state", "blocked");
    expect(dot("c")).toHaveAttribute("data-state", "error");
    expect(dot("d")).toHaveAttribute("data-state", "done");
  });

  it("a waiting-for-you run is an amber block counted for you; its approval is decided inline", () => {
    d.approvals = [{ id: "ap1", runId: "b", action: "pr.merge", summary: "Merge the fix" }];
    renderWithProviders(<RunsWidget {...props} />);
    expect(screen.getByTestId(StatusRailTestId.Park)).toHaveTextContent("Merge the fix");
    expect(screen.getByTestId(`${RunsWidgetTestId.Approve}-${key("b")}`)).toBeInTheDocument();
    expect(screen.getByTestId(`${RunsWidgetTestId.Reject}-${key("b")}`)).toBeInTheDocument();
    expect(props.onCountChange).toHaveBeenLastCalledWith(expect.objectContaining({ you: 1 }));
  });

  it("the Detail action opens the run sheet", async () => {
    renderWithProviders(<RunsWidget {...props} />);
    expect(screen.queryByTestId(`${RunsWidgetTestId.Approve}-${key("b")}`)).toBeNull();
    await userEvent.click(screen.getByTestId(`${RunsWidgetTestId.Detail}-${key("b")}`));
    expect(props.onOpen).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "run", id: "b", key: key("b") }),
    );
  });

  it("with nothing running the Now line says so and names the next scheduled start", () => {
    vi.useFakeTimers({ now: Date.parse("2026-10-27T09:49:00Z"), toFake: ["Date"] });
    try {
      d.live = [{ ...run("s", "scheduled"), kind: "scheduled" }];
      d.archived = [];
      renderWithProviders(<RunsWidget {...props} />);
      expect(screen.getByTestId(StatusRailTestId.Now)).toHaveTextContent("Teď nic neběží");
      expect(screen.getByTestId(StatusRailTestId.NowAside)).toHaveTextContent("další za 11 min");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a section collapses", async () => {
    renderWithProviders(<RunsWidget {...props} />);
    const finished = screen
      .getAllByTestId(BoardSectionTestId.Root)
      .find((h) => h.textContent?.startsWith("Dokončené"));
    await userEvent.click(finished as HTMLElement);
    expect(
      screen.queryAllByTestId(StatusRailTestId.Item).map((r) => r.getAttribute("data-rk")),
    ).toEqual(["a", "b"].map(key));
  });

  // todo-16: the live feed and the archive are fetched at different moments, so one run can sit
  // in both. The fresher snapshot decides which row shows; a tie goes to the archive.
  describe("a run in both the live feed and the archive (todo-16)", () => {
    const rows = () =>
      screen
        .getAllByTestId(StatusRailTestId.Item)
        .filter((r) => r.getAttribute("data-rk") === key("x"));

    it("a fresher archive (done) drops the stale live 'waiting for you' row", () => {
      d.live = [run("x", "awaiting-approval")];
      d.archived = [run("x", "done")];
      d.liveAt = 1_000;
      d.archivedAt = 2_000;
      renderWithProviders(<RunsWidget {...props} />);
      expect(rows()).toHaveLength(1);
      expect(dot("x")).toHaveAttribute("data-state", "done");
    });

    it("a fresher live feed keeps a real pending gate over a stale archived 'done'", () => {
      // The gate stamp lands after the run's `done`: the archive caught `done` first.
      d.live = [run("x", "awaiting-approval")];
      d.archived = [run("x", "done")];
      d.liveAt = 2_000;
      d.archivedAt = 1_000;
      renderWithProviders(<RunsWidget {...props} />);
      expect(rows()).toHaveLength(1);
      expect(dot("x")).toHaveAttribute("data-state", "blocked");
    });

    it("on a tie the archive wins", () => {
      d.live = [run("x", "awaiting-approval")];
      d.archived = [run("x", "done")];
      d.liveAt = 1_000;
      d.archivedAt = 1_000;
      renderWithProviders(<RunsWidget {...props} />);
      expect(rows()).toHaveLength(1);
      expect(dot("x")).toHaveAttribute("data-state", "done");
    });
  });
});
