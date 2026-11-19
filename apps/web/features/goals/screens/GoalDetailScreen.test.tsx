import type { ReactElement } from "react";
import { NextIntlClientProvider } from "next-intl";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IterationGaugeTestId,
  IterationTimelineTestId,
  LoopDiagramTestId,
} from "@zibby/design-system";
import type { Goal, GoalIteration, TaskRun } from "@zibby/contracts";
import { renderWithProviders } from "../../../test/render";
import cs from "../../../i18n/messages/cs.json";
import { GoalDetailScreen } from "./GoalDetailScreen";

const messages = cs;
const render = (ui: ReactElement) =>
  renderWithProviders(
    <NextIntlClientProvider locale="cs" messages={messages} timeZone="Europe/Prague">
      {ui}
    </NextIntlClientProvider>,
  );

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const goal: Goal = {
  id: "remember-me",
  name: "Remember-me login",
  objective: "Users stay signed in for 30 days.",
  maker: { kind: "agent", id: "writer" },
  verifier: { kind: "claude", agent: "judge", model: "opus", thinking: "high" },
  maxIterations: 8,
  budget: { dailyRuns: 5 },
  instructions: "Keep changes inside auth.",
};

const iteration = (index: number, over: Partial<GoalIteration> = {}): GoalIteration => ({
  index,
  makerKind: "agent",
  verifier: { kind: "claude", satisfied: false, output: "Session lost after restart." },
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
  status: "done",
  ...over,
});

const hooks = vi.hoisted(() => ({ runs: [] as TaskRun[] }));
const resumeMutate = vi.hoisted(() => vi.fn());
const taskMutate = vi.hoisted(() => vi.fn());
const stopMutate = vi.hoisted(() => vi.fn());

vi.mock("../queries", () => ({
  useGoalQuery: () => ({ data: goal, isPending: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../mutations", () => ({
  useCreateGoalMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteGoalMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateGoalMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useResumeGoalRunMutation: () => ({ mutate: resumeMutate, isPending: false }),
}));
vi.mock("../../agents", () => ({
  useAgentsQuery: () => ({
    data: [
      { id: "writer", name: "Writer Dev" },
      { id: "judge", name: "Judge" },
    ],
  }),
}));
vi.mock("../../workflows", () => ({
  useWorkflowsQuery: () => ({ data: [] }),
  useWorkflowRunQuery: () => ({ data: undefined }),
}));
vi.mock("../../projects", () => ({ useProjectsQuery: () => ({ data: [] }) }));
vi.mock("../../runs", () => ({
  useRunsQuery: () => ({ runs: hooks.runs, isPending: false }),
  useStopTaskRunMutation: () => ({ mutate: stopMutate }),
}));
vi.mock("../../tasks/mutations", () => ({
  useCreateTaskMutation: () => ({ mutate: taskMutate, isPending: false }),
}));

const run = (over: Partial<TaskRun>): TaskRun =>
  ({
    runId: "run-1",
    kind: "goal",
    goalId: goal.id,
    status: "running",
    startedAt: new Date().toISOString(),
    iterations: [],
    ...over,
  }) as TaskRun;

beforeEach(() => {
  hooks.runs = [];
  resumeMutate.mockClear();
  taskMutate.mockClear();
  stopMutate.mockClear();
});

describe("GoalDetailScreen", () => {
  it("shows the hero, the loop and one timeline item per iteration, newest first", () => {
    hooks.runs = [
      run({
        iterations: [
          iteration(0),
          iteration(1, {
            status: "running",
            verifier: { kind: "claude", satisfied: false, output: "" },
          }),
        ],
      }),
    ];
    render(<GoalDetailScreen goalId={goal.id} />);
    expect(screen.getByText(goal.objective)).toBeInTheDocument();
    expect(screen.getByTestId(IterationGaugeTestId.Used)).toHaveTextContent("2");
    expect(screen.getByTestId(LoopDiagramTestId.Count)).toHaveTextContent("2 / 8");
    const items = screen.getAllByTestId(IterationTimelineTestId.Item);
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(messages.goalPage.iterationN.replace("{n}", "2"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stops a running run from the toolbar", async () => {
    hooks.runs = [run({ iterations: [iteration(0, { status: "running" })] })];
    render(<GoalDetailScreen goalId={goal.id} />);
    await userEvent.click(screen.getByRole("button", { name: messages.goalPage.stop }));
    expect(stopMutate).toHaveBeenCalledWith({ params: { runId: "run-1" }, body: {} });
  });

  it("resumes a parked run with the note, or without it", async () => {
    hooks.runs = [
      run({
        status: "parked",
        goalParkedReason: "awaiting-resume",
        goalParked: { iteration: 0, attempts: 1, verdictFile: "/v.md" },
        iterations: [iteration(0)],
      }),
    ];
    render(<GoalDetailScreen goalId={goal.id} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(messages.goalPage.noteForNext), "use preview");
    await userEvent.click(screen.getByRole("button", { name: messages.goalPage.resume }));
    expect(resumeMutate).toHaveBeenLastCalledWith({
      params: { runId: "run-1" },
      body: { note: "use preview" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: messages.goalPage.resumeWithoutNote }),
    );
    expect(resumeMutate).toHaveBeenLastCalledWith({ params: { runId: "run-1" }, body: {} });
  });

  it("offers Start on a goal that never ran, targeting the goal", async () => {
    render(<GoalDetailScreen goalId={goal.id} />);
    expect(screen.getByText(messages.goalPage.noRunsTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: messages.goalPage.startGoal }));
    expect(taskMutate.mock.calls[0]?.[0].body.target).toMatchObject({ kind: "goal", id: goal.id });
  });

  it("turns the objective into a field in edit mode", async () => {
    render(<GoalDetailScreen goalId={goal.id} />);
    await userEvent.click(screen.getAllByRole("button", { name: messages.goalPage.edit })[0]!);
    expect(screen.getByLabelText(messages.goalPage.objective)).toHaveValue(goal.objective);
    expect(screen.getByRole("button", { name: messages.goalPage.save })).toBeEnabled();
  });
});
