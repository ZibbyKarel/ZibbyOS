import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoalLoopCardTestId, ListToolbarTestId, SegmentedRingTestId } from "@zibby/design-system";
import type { Goal, TaskRun } from "@zibby/contracts";
import { renderWithProviders as render } from "../../../test/render";
import { GoalsListScreen, GoalsListScreenTestId } from "./GoalsListScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const goal: Goal = {
  id: "ship-feature",
  objective: "Ship feature Y green",
  maker: { kind: "workflow", id: "delivery" },
  verifier: { kind: "claude", agent: "reviewer" },
  maxIterations: 10,
  instructions: "Keep going.",
  projectId: "client-portal",
};

const { hooks } = vi.hoisted(() => ({
  hooks: {
    goals: [] as Goal[],
    goalsPending: false,
    goalsError: false,
    runs: [] as TaskRun[],
    runsPending: false,
  },
}));

const resumeMutate = vi.fn();
const stopMutate = vi.fn();
const createMutate = vi.fn();

vi.mock("../queries", () => ({
  useGoalsQuery: () => ({
    data: hooks.goals,
    isPending: hooks.goalsPending,
    isError: hooks.goalsError,
    refetch: vi.fn(),
  }),
}));
vi.mock("../../agents", () => ({
  useAgentsQuery: () => ({ data: [{ id: "delivery", name: "Delivery agent" }] }),
}));
vi.mock("../../tasks/mutations", () => ({
  useCreateTaskMutation: () => ({ mutate: createMutate }),
}));
vi.mock("../mutations", () => ({
  useResumeGoalRunMutation: () => ({ mutate: resumeMutate }),
}));
vi.mock("../../runs", () => ({
  useRunsQuery: () => ({ runs: hooks.runs, isPending: hooks.runsPending }),
  useStopTaskRunMutation: () => ({ mutate: stopMutate }),
}));

beforeEach(() => {
  hooks.goals = [];
  hooks.goalsPending = false;
  hooks.goalsError = false;
  hooks.runs = [];
  hooks.runsPending = false;
  push.mockClear();
  resumeMutate.mockClear();
  stopMutate.mockClear();
  createMutate.mockClear();
});

const runOf = (status: string, extra: Partial<TaskRun> = {}) =>
  ({
    runId: `run-${status}`,
    kind: "goal",
    goalId: "ship-feature",
    status,
    owner: "ship-feature",
    title: "",
    prompt: "",
    startedAt: "2026-01-01T00:00:00.000Z",
    iterations: [],
    ...extra,
  }) as unknown as TaskRun;

describe("GoalsListScreen", () => {
  it("renders one loop card per goal with a ring segment per budgeted iteration", () => {
    hooks.goals = [goal];
    render(<GoalsListScreen />);
    expect(screen.getByTestId(GoalLoopCardTestId.Title)).toHaveTextContent("Ship feature Y green");
    expect(screen.getAllByTestId(SegmentedRingTestId.Segment)).toHaveLength(10);
    expect(screen.getByTestId(GoalLoopCardTestId.Maker)).toHaveTextContent("delivery");
  });

  it("opens the goal detail from the card cover", async () => {
    hooks.goals = [goal];
    render(<GoalsListScreen />);
    await userEvent.click(screen.getByTestId(GoalLoopCardTestId.Open));
    expect(push).toHaveBeenCalledWith("/work/goals/ship-feature");
  });

  it("offers resume for a parked run and calls the resume mutation", async () => {
    hooks.goals = [goal];
    hooks.runs = [runOf("parked")];
    render(<GoalsListScreen />);
    const actions = within(screen.getByTestId(GoalLoopCardTestId.Actions));
    await userEvent.click(actions.getAllByRole("button")[0]!);
    expect(resumeMutate).toHaveBeenCalledWith({ params: { runId: "run-parked" }, body: {} });
  });

  it("stops a running run", async () => {
    hooks.goals = [goal];
    hooks.runs = [runOf("running")];
    render(<GoalsListScreen />);
    const actions = within(screen.getByTestId(GoalLoopCardTestId.Actions));
    await userEvent.click(actions.getAllByRole("button")[0]!);
    expect(stopMutate).toHaveBeenCalledWith({ params: { runId: "run-running" }, body: {} });
  });

  it("starts the loop of an idle goal", async () => {
    hooks.goals = [goal];
    render(<GoalsListScreen />);
    const actions = within(screen.getByTestId(GoalLoopCardTestId.Actions));
    await userEvent.click(actions.getAllByRole("button")[0]!);
    expect(createMutate).toHaveBeenCalledTimes(1);
  });

  it("filters by status chip", async () => {
    hooks.goals = [goal, { ...goal, id: "other", objective: "Other" }];
    hooks.runs = [runOf("parked")];
    render(<GoalsListScreen />);
    expect(screen.getAllByTestId(GoalLoopCardTestId.Root)).toHaveLength(2);
    const chips = screen.getAllByTestId(ListToolbarTestId.Chip);
    // order: all, active, parked, done, error
    await userEvent.click(within(chips[2]!).getByRole("button"));
    expect(screen.getAllByTestId(GoalLoopCardTestId.Root)).toHaveLength(1);
    await userEvent.click(within(chips[1]!).getByRole("button"));
    expect(screen.queryAllByTestId(GoalLoopCardTestId.Root)).toHaveLength(0);
  });

  it("shows the empty state when there are no goals", () => {
    render(<GoalsListScreen />);
    expect(screen.getByTestId(GoalsListScreenTestId.Empty)).toBeInTheDocument();
  });

  it("shows skeletons while loading", () => {
    hooks.goalsPending = true;
    render(<GoalsListScreen />);
    expect(screen.getAllByTestId(GoalsListScreenTestId.Skeleton).length).toBeGreaterThan(0);
  });
});
