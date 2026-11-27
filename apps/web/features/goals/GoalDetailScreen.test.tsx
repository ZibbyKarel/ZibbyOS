import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { Goal, GoalStateView } from "@zibby/contracts";
import { act, renderWithProviders as render, screen, within } from "../../test/render";
import {
  IterationTimelineTestId,
  ListToolbarTestId,
  MenuButtonTestId,
  SegmentedControlTestId,
} from "@zibby/design-system";
import { GoalDetailScreen, GoalDetailScreenTestId } from "./GoalDetailScreen";
import { GoalCriteriaTestId } from "./components/GoalCriteriaCard";
import { GoalCycleTimelineTestId } from "./components/GoalCycleTimeline";
import { GoalDetailActionsTestId } from "./components/GoalDetailActions";
import { GoalFormTestId } from "./components/GoalForm";
import { GoalHeroTestId } from "./components/GoalHero";
import { GoalInstanceStatusTestId } from "./components/GoalInstanceStatus";
import { GoalInstancesTestId } from "./components/GoalInstancesPanel";
import { GoalPlanTestId } from "./components/GoalPlanPanel";
import { GoalSettingsTestId } from "./components/GoalSettingsPanel";
import { GoalUpcomingTestId } from "./components/GoalUpcoming";
import { GoalWaitingCardTestId } from "./components/GoalWaitingCard";
import { formatGoalDateTime } from "./goalView";

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
    goal: {
      data: undefined as unknown,
      isPending: false,
      isError: false,
      error: undefined as unknown,
      refetch: vi.fn(),
    },
    state: { data: undefined as unknown, isPending: false, isError: false, refetch: vi.fn() },
    timeline: [] as unknown[],
    timelineState: "ok" as "ok" | "pending" | "error",
    updateError: undefined as unknown,
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./queries", () => ({
  useGoalQuery: () => hooks.goal,
  useGoalStateQuery: () => hooks.state,
  useGoalTimelineQuery: (_id: string, instance?: string) => ({
    data:
      hooks.timelineState === "ok"
        ? (hooks.timeline as { instance: string }[]).filter(
            (e) => instance === undefined || e.instance === instance,
          )
        : undefined,
    isPending: hooks.timelineState === "pending",
    isError: hooks.timelineState === "error",
    refetch: vi.fn(),
  }),
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
  useSetGoalMergeGrantMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useClearGoalMergeGrantMutation: () => ({ mutate: vi.fn(), isPending: false }),
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
    hooks.goal = {
      data: goal,
      isPending: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    };
    hooks.state = { data: stateView, isPending: false, isError: false, refetch: vi.fn() };
    hooks.timeline = [];
    hooks.timelineState = "ok";
    hooks.updateError = undefined;
  });

  it("renders the hero: name, outcome, scope tag and the projects gauge", () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalHeroTestId.Name)).toHaveTextContent("CI zůstává zelené");
    expect(screen.getByTestId(GoalHeroTestId.Outcome)).toHaveTextContent(
      "CI na hlavní větvi je zelené.",
    );
    expect(screen.getByTestId(GoalHeroTestId.Tags)).toHaveTextContent("Alpha, Beta");
    expect(screen.getByTestId(GoalHeroTestId.Gauge)).toBeInTheDocument();
  });

  it("hides the gauge for a single goal without a project", () => {
    hooks.goal = { ...hooks.goal, data: { ...goal, scope: { kind: "none" } } };
    hooks.state = {
      data: {
        ...stateView,
        state: { ...stateView.state, instances: { _: { status: "acting", taskIds: [] } } },
        rollup: {
          status: "acting",
          counts: { total: 1, done: 0, parked: 0, active: 1 },
          needsYou: 0,
        },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.queryByTestId(GoalHeroTestId.Gauge)).not.toBeInTheDocument();
  });

  it("shows only the meters the mandate carries: runs against the per-cycle cap", () => {
    hooks.goal = {
      ...hooks.goal,
      data: { ...goal, budget: { maxRunsPerCycle: 4 } },
    };
    hooks.state = {
      data: {
        ...stateView,
        state: {
          ...stateView.state,
          cycle: { ...stateView.state.cycle, deadlineAt: "2026-12-01T10:00:00.000Z" },
          instances: {
            alpha: { status: "acting", taskIds: ["t1", "t2", "t3"] },
            beta: { status: "acting", taskIds: ["t4"] },
          },
        },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalHeroTestId.MeterRuns)).toHaveTextContent("3 / 4");
    expect(screen.getByTestId(GoalHeroTestId.MeterDeadline)).toBeInTheDocument();
    expect(screen.queryByTestId(GoalHeroTestId.MeterDecisions)).not.toBeInTheDocument();
  });

  it("lists the instances with project names, status and parked reason", () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    const list = screen.getByTestId(GoalInstancesTestId.List);
    expect(within(list).getByText("Alpha")).toBeInTheDocument();
    expect(within(list).getByText("Beta")).toBeInTheDocument();
    expect(within(list).getByTestId(`${GoalInstanceStatusTestId.Reason}-beta`)).toHaveTextContent(
      "Selhalo",
    );
    expect(within(list).getByTestId(`${GoalInstancesTestId.Summary}-beta`)).toHaveTextContent(
      "Spadlo CI",
    );
  });

  it("a parked instance gets a waiting card whose resume calls the mutation", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(`${GoalWaitingCardTestId.Root}-beta`)).toHaveRole("alert");
    expect(screen.queryByTestId(`${GoalWaitingCardTestId.Root}-alpha`)).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`${GoalWaitingCardTestId.Resume}-beta`));
    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume.mock.calls[0]![0]).toEqual({
      params: { id: "ci-green", instance: "beta" },
      body: {},
    });
  });

  it("wakes the goal from the context-bar actions", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    await userEvent.click(screen.getByTestId(GoalDetailActionsTestId.Wake));
    expect(wake).toHaveBeenCalledWith({ params: { id: "ci-green" }, body: {} }, expect.anything());
  });

  it("a standing goal shows its cycle chip, counted from 1", () => {
    hooks.goal = {
      ...hooks.goal,
      data: { ...goal, deadline: undefined, cadence: { every: "day", hour: 9 } },
    };
    hooks.state = {
      data: {
        ...stateView,
        state: { ...stateView.state, cycle: { index: 2, startedAt: "2026-11-26T10:00:00.000Z" } },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalDetailActionsTestId.Cycle)).toHaveTextContent("3");
  });

  it("a one-off goal has no cycle chip", () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.queryByTestId(GoalDetailActionsTestId.Cycle)).not.toBeInTheDocument();
  });

  it("shows the success predicate in the criteria card", () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalCriteriaTestId.Predicate)).toHaveTextContent("CI je zelené.");
  });

  it("renders the plan note from the vault when an instance has one", () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(`${GoalPlanTestId.Note}-plan-beta`)).toHaveTextContent("Opravit CI.");
    expect(screen.queryByTestId(GoalPlanTestId.Empty)).not.toBeInTheDocument();
  });

  it("shows the plan, upcoming and timeline empty states before the first wake-up", () => {
    hooks.state = {
      data: {
        ...stateView,
        state: { ...stateView.state, instances: {} },
        rollup: {
          status: "planning",
          counts: { total: 0, done: 0, parked: 0, active: 0 },
          needsYou: 0,
        },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalPlanTestId.Empty)).toHaveTextContent("Plán zatím není");
    expect(screen.getByTestId(GoalUpcomingTestId.Nothing)).toBeInTheDocument();
    expect(screen.getByTestId(GoalCycleTimelineTestId.Empty)).toBeInTheDocument();
    // Nothing to count yet: no "0 of 0" ring.
    expect(screen.queryByTestId(GoalHeroTestId.Gauge)).not.toBeInTheDocument();
  });

  it("'Co bude' shows what an instance waits on, when it wakes, and the deadline", () => {
    const wakeAt = "2026-11-27T08:00:00.000Z";
    hooks.state = {
      data: {
        ...stateView,
        state: {
          ...stateView.state,
          instances: {
            alpha: {
              status: "waiting",
              taskIds: [],
              waitingOn: [{ kind: "pr", ref: "acme/web#4" }],
              wakeAt,
            },
          },
        },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(`${GoalUpcomingTestId.WaitingOn}-alpha`)).toHaveTextContent(
      "acme/web#4",
    );
    expect(screen.getByTestId(`${GoalUpcomingTestId.WakeAt}-alpha`)).toHaveTextContent(
      formatGoalDateTime(wakeAt, "cs"),
    );
    expect(screen.getByTestId(GoalUpcomingTestId.Deadline)).toHaveTextContent(
      formatGoalDateTime(goal.deadline!, "cs"),
    );
  });

  it("a pending or failed timeline is not shown as 'nothing happened yet'", () => {
    hooks.timelineState = "pending";
    const { unmount } = render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalCycleTimelineTestId.Loading)).toBeInTheDocument();
    expect(screen.queryByTestId(GoalCycleTimelineTestId.Empty)).toBeNull();
    unmount();
    hooks.timelineState = "error";
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByText("Nepodařilo se načíst")).toBeInTheDocument();
    expect(screen.queryByTestId(GoalCycleTimelineTestId.Empty)).toBeNull();
  });

  it("a one-off goal with one cycle titles it 'Průběh'", () => {
    hooks.timeline = [
      { at: "2026-11-26T10:00:00.000Z", cycle: 0, instance: "alpha", kind: "n", text: "Začátek" },
    ];
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(IterationTimelineTestId.Title)).toHaveTextContent(/^Průběh$/);
  });

  it("a cycle shows its newest 5 rows and the toggle reveals the rest", async () => {
    hooks.timeline = Array.from({ length: 7 }, (_, i) => ({
      at: `2026-11-26T1${i}:00:00.000Z`,
      cycle: 0,
      instance: "alpha",
      kind: "n",
      text: `Krok ${i + 1}`,
    }));
    render(<GoalDetailScreen goalId="ci-green" />);
    const rows = () => screen.getAllByTestId(IterationTimelineTestId.Row);
    expect(rows()).toHaveLength(5);
    expect(rows()[0]).toHaveTextContent("Krok 7");
    await userEvent.click(screen.getByTestId(IterationTimelineTestId.Toggle));
    expect(rows()).toHaveLength(7);
    await userEvent.click(screen.getByTestId(IterationTimelineTestId.Toggle));
    expect(rows()).toHaveLength(5);
  });

  it("the order switch puts the oldest cycle and row first", async () => {
    hooks.timeline = [
      { at: "2026-11-26T10:00:00.000Z", cycle: 0, instance: "alpha", kind: "n", text: "První" },
      { at: "2026-11-26T11:00:00.000Z", cycle: 0, instance: "alpha", kind: "n", text: "Druhý" },
      { at: "2026-11-27T10:00:00.000Z", cycle: 1, instance: "alpha", kind: "n", text: "Další" },
    ];
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getAllByTestId(IterationTimelineTestId.Item)[0]).toHaveTextContent("Další");
    await userEvent.click(screen.getByTestId(`${SegmentedControlTestId.Item}-oldest`));
    const items = screen.getAllByTestId(IterationTimelineTestId.Item);
    expect(items[0]).toHaveTextContent("Průběh 1");
    const rows = screen.getAllByTestId(IterationTimelineTestId.Row);
    expect(rows[0]).toHaveTextContent("První");
    expect(rows[1]).toHaveTextContent("Druhý");
  });

  it("the instance chips filter the timeline to one project", async () => {
    hooks.timeline = [
      { at: "2026-11-26T10:00:00.000Z", cycle: 0, instance: "alpha", kind: "n", text: "Alfa krok" },
      { at: "2026-11-26T11:00:00.000Z", cycle: 0, instance: "beta", kind: "n", text: "Beta krok" },
    ];
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getAllByTestId(IterationTimelineTestId.Row)).toHaveLength(2);
    const chips = screen.getAllByTestId(ListToolbarTestId.Chip);
    expect(chips.map((c) => c.textContent)).toEqual(["Vše", "Alpha", "Beta"]);
    await userEvent.click(within(chips[2]!).getByRole("button"));
    const rows = screen.getAllByTestId(IterationTimelineTestId.Row);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Beta krok");
  });

  it("groups timeline events into one item per cycle, newest first", () => {
    hooks.timeline = [
      { at: "2026-11-26T10:00:00.000Z", cycle: 0, instance: "alpha", kind: "n", text: "Začátek" },
      { at: "2026-11-27T10:00:00.000Z", cycle: 1, instance: "beta", kind: "n", text: "Další" },
    ];
    render(<GoalDetailScreen goalId="ci-green" />);
    const items = screen.getAllByTestId(IterationTimelineTestId.Item);
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Průběh 2");
    expect(items[0]).toHaveTextContent("Beta: Další");
    expect(items[1]).toHaveTextContent("Alpha: Začátek");
  });

  it("edit swaps the left column for the form, and Save sends nulls for emptied fields", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    await userEvent.click(screen.getByTestId(GoalDetailActionsTestId.Edit));
    expect(screen.queryByTestId(GoalUpcomingTestId.Root)).not.toBeInTheDocument();
    expect(screen.queryByTestId(GoalDetailActionsTestId.Edit)).not.toBeInTheDocument();

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

  it("the settings card's edit opens the same form, and a save error shows inside it", async () => {
    hooks.updateError = {
      status: 422,
      body: { message: "deadline and cadence are mutually exclusive" },
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalSettingsTestId.Scope)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(GoalDetailScreenTestId.SettingsEdit));
    expect(screen.getByTestId(GoalFormTestId.Error)).toHaveTextContent("mutually exclusive");
  });

  it("shows a page error when wake, resume or pause fail", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    await userEvent.click(screen.getByTestId(GoalDetailActionsTestId.Wake));
    act(() => wake.mock.calls[0]![1].onError({ body: { message: "wake failed" } }));
    expect(screen.getByTestId(GoalDetailScreenTestId.Error)).toHaveTextContent("wake failed");

    await userEvent.click(screen.getByTestId(`${GoalWaitingCardTestId.Resume}-beta`));
    act(() => resume.mock.calls[0]![1].onError(new Error("network")));
    expect(screen.getByTestId(GoalDetailScreenTestId.Error)).toHaveTextContent("Akce se nepovedla");

    await userEvent.click(screen.getByTestId(GoalDetailActionsTestId.Pause));
    expect(update).toHaveBeenCalledWith(
      { params: { id: "ci-green" }, body: { enabled: false } },
      expect.anything(),
    );
    act(() => update.mock.calls[0]![1].onError({ body: { message: "toggle failed" } }));
    expect(screen.getByTestId(GoalDetailScreenTestId.Error)).toHaveTextContent("toggle failed");
  });

  it("a disabled goal offers Enable instead of Pause", () => {
    hooks.goal = { ...hooks.goal, data: { ...goal, enabled: false } };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalDetailActionsTestId.Enable)).toBeInTheDocument();
    expect(screen.queryByTestId(GoalDetailActionsTestId.Pause)).not.toBeInTheDocument();
  });

  it("deletes from the more menu only after the confirm dialog", async () => {
    render(<GoalDetailScreen goalId="ci-green" />);
    await userEvent.click(screen.getByTestId(GoalDetailActionsTestId.More));
    await userEvent.click(screen.getByTestId(`${MenuButtonTestId.Item}-delete`));
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Smazat" }).at(-1)!);
    expect(remove).toHaveBeenCalledWith({ params: { id: "ci-green" } }, expect.anything());
  });

  it("a 404 says the goal no longer exists, inside the page frame", () => {
    hooks.goal = {
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 404, body: { message: "not found" } },
      refetch: vi.fn(),
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByTestId(GoalDetailScreenTestId.Gone)).toHaveTextContent(
      "Tento cíl už neexistuje.",
    );
    expect(screen.getByText("ci-green")).toBeInTheDocument();
    expect(screen.queryByText("Nepodařilo se načíst")).toBeNull();
  });

  it("shows the error state with retry, inside the page frame", () => {
    hooks.goal = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new TypeError("Failed to fetch"),
      refetch: vi.fn(),
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByText("Nepodařilo se načíst")).toBeInTheDocument();
    expect(screen.getByText("ci-green")).toBeInTheDocument();
  });

  it("shows the loading state inside the page frame", () => {
    hooks.goal = {
      data: undefined,
      isPending: true,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getByText("ci-green")).toBeInTheDocument();
    expect(screen.queryByTestId(GoalHeroTestId.Name)).not.toBeInTheDocument();
  });

  it("a failed state load shows a retry in the projects card instead of an empty list", () => {
    hooks.state = { data: undefined, isPending: false, isError: true, refetch: vi.fn() };
    render(<GoalDetailScreen goalId="ci-green" />);
    expect(screen.getAllByTestId(GoalDetailScreenTestId.StateError)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Zkusit znovu" })).toHaveLength(1);
    expect(screen.queryByTestId(GoalInstancesTestId.List)).not.toBeInTheDocument();
  });
});
