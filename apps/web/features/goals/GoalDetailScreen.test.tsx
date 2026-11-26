import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { Goal, GoalStateView } from "@zibby/contracts";
import { act, renderWithProviders as render, screen, within } from "../../test/render";
import { GoalDetailScreen, GoalDetailScreenTestId } from "./GoalDetailScreen";
import { GoalFormTestId } from "./components/GoalForm";
import { GoalInstancesTestId } from "./components/GoalInstancesPanel";
import { GoalPlanTestId } from "./components/GoalPlanPanel";
import { GoalSettingsTestId } from "./components/GoalSettingsPanel";
import { GoalTimelineTestId } from "./components/GoalTimelinePanel";

const push = vi.fn();
const update = vi.fn();
const resume = vi.fn();
const wake = vi.fn();
const remove = vi.fn();

const goal: Goal = {
  id: "ci-green",
  name: "CI zůstává zelené",
  outcome: "CI na hlavní větvi je zelené.",
  predicate: "CI je zelené.",
  scope: { kind: "projects", projectIds: ["alpha", "beta"] },
  deadline: "2026-12-01T10:00:00.000Z",
  ceiling: "tier2",
  enabled: true,
  createdAt: "2026-11-26T10:00:00.000Z",
  updatedAt: "2026-11-26T10:00:00.000Z",
};

const stateView: GoalStateView = {
  state: {
    goalId: "ci-green",
    cycle: { index: 0, startedAt: "2026-11-26T10:00:00.000Z" },
    instances: {
      alpha: { status: "done", taskIds: [], summary: "Zelené" },
      beta: {
        status: "parked",
        parkedReason: "failed",
        taskIds: [],
        planNoteId: "plan-beta",
        summary: "Spadlo CI",
      },
    },
    decisionsThisMonth: { month: "2026-11", count: 0 },
    nudges: {},
  },
  rollup: {
    status: "needs-you",
    counts: { total: 2, done: 1, parked: 1, active: 0 },
    needsYou: 1,
  },
};

const { hooks } = vi.hoisted(() => ({
  hooks: {
    goal: { data: undefined as unknown, isPending: false, isError: false, refetch: vi.fn() },
    state: { data: undefined as unknown, isPending: false, isError: false, refetch: vi.fn() },
    timeline: [] as unknown[],
    updateError: undefined as unknown,
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./queries", () => ({
  useGoalQuery: () => hooks.goal,
  useGoalStateQuery: () => hooks.state,
  useGoalTimelineQuery: () => ({ data: hooks.timeline }),
}));
vi.mock("./mutations", () => ({
  useUpdateGoalMutation: () => ({
    mutate: update,
    reset: vi.fn(),
    isPending: false,
    isError: hooks.updateError !== undefined,
    error: hooks.updateError,
  }),
  useDeleteGoalMutation: () => ({ mutate: remove, isPending: false }),
  useWakeGoalMutation: () => ({ mutate: wake, isPending: false }),
  useResumeGoalInstanceMutation: () => ({ mutate: resume, isPending: false }),
}));
vi.mock("../projects/queries", () => ({
  useProjectsQuery: () => ({
    data: [
      { id: "alpha", name: "Alpha" },
      { id: "beta", name: "Beta" },
    ],
  }),
}));
vi.mock("../companies/queries", () => ({ useCompaniesQuery: () => ({ data: [] }) }));
vi.mock("../knowledge/queries", () => ({
  useNoteQuery: (id: string | null) => ({
    data: id ? { id, title: "Plán", body: "## Krok 1\n\nOpravit CI." } : undefined,
    isError: false,
  }),
}));

describe("GoalDetailScreen", () => {
  beforeEach(() => {
    for (const fn of [push, update, resume, wake, remove]) fn.mockClear();
    hooks.goal = { data: goal, isPending: false, isError: false, refetch: vi.fn() };
    hooks.state = { data: stateView, isPending: false, isError: false, refetch: vi.fn() };
    hooks.timeline = [];
    hooks.updateError = undefined;
  });

  it("renders the roll-up rows with project names and a resume button only on parked ones", () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    const table = screen.getByTestId("data-table-root");
    expect(within(table).getByText("Alpha")).toBeInTheDocument();
    expect(within(table).getByText("Beta")).toBeInTheDocument();
    expect(within(table).getByText("Selhalo")).toBeInTheDocument();
    expect(screen.getByTestId(`${GoalInstancesTestId.Resume}-beta`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${GoalInstancesTestId.Resume}-alpha`)).not.toBeInTheDocument();
  });

  it("resume calls the mutation for that instance", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    await userEvent.click(screen.getByTestId(`${GoalInstancesTestId.Resume}-beta`));
    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume.mock.calls[0]![0]).toEqual({
      params: { id: "ci-green", instance: "beta" },
      body: {},
    });
  });

  it("wakes the goal from the header", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    await userEvent.click(screen.getByTestId(GoalDetailScreenTestId.Wake));
    expect(wake).toHaveBeenCalledWith({ params: { id: "ci-green" }, body: {} }, expect.anything());
  });

  it("renders the plan note from the vault when an instance has one", () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(`${GoalPlanTestId.Note}-plan-beta`)).toHaveTextContent("Opravit CI.");
    expect(screen.queryByTestId(GoalPlanTestId.Empty)).not.toBeInTheDocument();
  });

  it("shows the plan and timeline empty states before the first wake-up", () => {
    hooks.state = {
      data: { ...stateView, state: { ...stateView.state, instances: {} } },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalPlanTestId.Empty)).toHaveTextContent("Plán zatím není");
    expect(screen.getByTestId(GoalPlanTestId.Empty)).toHaveTextContent(
      "Vznikne při prvním probuzení",
    );
    expect(screen.getByTestId(GoalTimelineTestId.Empty)).toBeInTheDocument();
  });

  it("groups timeline events by cycle", () => {
    hooks.timeline = [
      { at: "2026-11-26T10:00:00.000Z", cycle: 0, instance: "alpha", kind: "n", text: "Začátek" },
      { at: "2026-11-27T10:00:00.000Z", cycle: 1, instance: "beta", kind: "n", text: "Další" },
    ];
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(`${GoalTimelineTestId.Cycle}-0`)).toHaveTextContent("Začátek");
    expect(screen.getByTestId(`${GoalTimelineTestId.Cycle}-1`)).toHaveTextContent("Další");
  });

  it("edit swaps the settings for the form, and Save sends nulls for emptied fields", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalSettingsTestId.Outcome)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(GoalDetailScreenTestId.Edit));
    expect(screen.queryByTestId(GoalSettingsTestId.Outcome)).not.toBeInTheDocument();

    await userEvent.clear(screen.getByTestId(GoalFormTestId.Predicate));
    await userEvent.click(screen.getByRole("button", { name: "Stálý" }));
    await userEvent.click(screen.getByTestId(GoalFormTestId.Submit));

    expect(update).toHaveBeenCalledTimes(1);
    const { params, body } = update.mock.calls[0]![0];
    expect(params).toEqual({ id: "ci-green" });
    expect(body).toMatchObject({
      predicate: null,
      deadline: null,
      cadence: { every: "weekday", hour: 9 },
      cycleHours: null,
      budget: null,
    });
  });

  it("shows the server error inside the form when a save fails", async () => {
    hooks.updateError = {
      status: 422,
      body: { message: "deadline and cadence are mutually exclusive" },
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    await userEvent.click(screen.getByTestId(GoalDetailScreenTestId.Edit));
    expect(screen.getByTestId(GoalFormTestId.Error)).toHaveTextContent("mutually exclusive");
  });

  it("shows a page error when wake, resume or the toggle fail", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    await userEvent.click(screen.getByTestId(GoalDetailScreenTestId.Wake));
    act(() => wake.mock.calls[0]![1].onError({ body: { message: "wake failed" } }));
    expect(screen.getByTestId(GoalDetailScreenTestId.Error)).toHaveTextContent("wake failed");

    await userEvent.click(screen.getByTestId(`${GoalInstancesTestId.Resume}-beta`));
    act(() => resume.mock.calls[0]![1].onError(new Error("network")));
    expect(screen.getByTestId(GoalDetailScreenTestId.Error)).toHaveTextContent("Akce se nepovedla");

    await userEvent.click(screen.getByTestId(GoalDetailScreenTestId.Toggle));
    expect(update).toHaveBeenCalledWith(
      { params: { id: "ci-green" }, body: { enabled: false } },
      expect.anything(),
    );
    act(() => update.mock.calls[0]![1].onError({ body: { message: "toggle failed" } }));
    expect(screen.getByTestId(GoalDetailScreenTestId.Error)).toHaveTextContent("toggle failed");
  });

  it("deletes only after the confirm dialog", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    await userEvent.click(screen.getByTestId(GoalDetailScreenTestId.Delete));
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Smazat" }).at(-1)!);
    expect(remove).toHaveBeenCalledWith({ params: { id: "ci-green" } }, expect.anything());
  });

  it("shows the error state with retry instead of a blank page", () => {
    hooks.goal = { data: undefined, isPending: false, isError: true, refetch: vi.fn() };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByText("Nepodařilo se načíst")).toBeInTheDocument();
  });
});
