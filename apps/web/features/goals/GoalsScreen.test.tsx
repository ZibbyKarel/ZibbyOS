import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { GOAL_PRESETS, type GoalWithRollup } from "@zibby/contracts";
import { renderWithProviders as render, screen } from "../../test/render";
import { GoalsScreen, GoalsScreenTestId } from "./GoalsScreen";
import { GoalCardTestId } from "./components/GoalCard";
import { GoalPresetsTestId } from "./components/GoalPresets";

const push = vi.fn();
const create = vi.fn();
const update = vi.fn();
const refetch = vi.fn();

const { query } = vi.hoisted(() => ({
  query: { goals: [] as GoalWithRollup[], isPending: false, isError: false },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./queries", () => ({
  getGoalsQueryKey: () => ["goals"],
  useGoalsQuery: () => ({
    data: query.goals,
    isPending: query.isPending,
    isError: query.isError,
    refetch,
  }),
}));
vi.mock("./mutations", () => ({
  useCreateGoalMutation: () => ({ mutate: create, isPending: false, isError: false }),
  useUpdateGoalMutation: () => ({ mutate: update, isPending: false }),
}));
vi.mock("../projects/queries", () => ({ useProjectsQuery: () => ({ data: [] }) }));
vi.mock("../companies/queries", () => ({ useCompaniesQuery: () => ({ data: [] }) }));

const goal: GoalWithRollup = {
  id: "my-prs",
  name: "Moje PR jsou hotové",
  outcome: "Všechny PR zelené.",
  scope: { kind: "none" },
  cadence: { every: "weekday", hour: 9 },
  ceiling: "tier2",
  enabled: true,
  createdAt: "2026-11-26T10:00:00.000Z",
  updatedAt: "2026-11-26T10:00:00.000Z",
  rollup: {
    status: "needs-you",
    counts: { total: 9, done: 7, parked: 1, active: 1 },
    needsYou: 1,
  },
};

describe("GoalsScreen", () => {
  beforeEach(() => {
    query.goals = [goal];
    query.isPending = false;
    query.isError = false;
    push.mockClear();
    create.mockClear();
    update.mockClear();
    refetch.mockClear();
  });

  it("shows skeletons while loading, never an empty workspace", () => {
    query.isPending = true;
    render(<GoalsScreen />);
    expect(screen.getByTestId(GoalsScreenTestId.Skeletons)).toBeInTheDocument();
    expect(screen.queryByTestId(GoalsScreenTestId.Empty)).not.toBeInTheDocument();
  });

  it("lists a goal with its scope, schedule, status pill and counts", () => {
    render(<GoalsScreen />);
    const card = screen.getByTestId(GoalCardTestId.Root);
    expect(card).toHaveTextContent("Moje PR jsou hotové");
    expect(card).toHaveTextContent("Bez projektu");
    expect(card).toHaveTextContent("Každý pracovní den v 09:00");
    expect(card).toHaveTextContent("Čeká na tebe");
    expect(screen.getByTestId(GoalCardTestId.Counts)).toHaveTextContent(
      "7 z 9 hotovo · 1 čeká na tebe",
    );
  });

  it("toggles enabled through the update mutation", async () => {
    render(<GoalsScreen />);
    await userEvent.click(screen.getByTestId(GoalCardTestId.Toggle));
    expect(update).toHaveBeenCalledWith({ params: { id: "my-prs" }, body: { enabled: false } });
  });

  it("opens the detail page from the card", async () => {
    render(<GoalsScreen />);
    await userEvent.click(screen.getByTestId(GoalCardTestId.Open));
    expect(push).toHaveBeenCalledWith("/work/goals/my-prs");
  });

  it("shows the empty state, and the presets, when there are no goals", () => {
    query.goals = [];
    render(<GoalsScreen />);
    expect(screen.getByTestId(GoalsScreenTestId.Empty)).toBeInTheDocument();
    expect(screen.getByText("Připravené cíle")).toBeInTheDocument();
    expect(screen.getByText("PR a CI")).toBeInTheDocument();
    expect(screen.getByText("Údržba projektů")).toBeInTheDocument();
    expect(screen.getByText("Mozek a osobní")).toBeInTheDocument();
    expect(screen.getByText("Směrové")).toBeInTheDocument();
  });

  it("adds a preset paused, without its group, then opens it", () => {
    query.goals = [];
    render(<GoalsScreen />);
    const preset = GOAL_PRESETS[0]!;
    screen.getByTestId(`${GoalPresetsTestId.Add}-${preset.id}`).click();
    expect(create).toHaveBeenCalledTimes(1);
    const [args, options] = create.mock.calls[0]!;
    expect(args.body).toMatchObject({ id: preset.id, enabled: false });
    expect(args.body).not.toHaveProperty("group");
    options.onSuccess();
    expect(push).toHaveBeenCalledWith(`/work/goals/${preset.id}`);
  });

  it("shows 'Přidáno' instead of the button for a preset whose id already exists", () => {
    const preset = GOAL_PRESETS[0]!;
    query.goals = [{ ...goal, id: preset.id }];
    render(<GoalsScreen />);
    expect(screen.getByTestId(`${GoalPresetsTestId.Added}-${preset.id}`)).toHaveTextContent(
      "Přidáno",
    );
    expect(screen.queryByTestId(`${GoalPresetsTestId.Add}-${preset.id}`)).not.toBeInTheDocument();
  });

  it("filters by roll-up status", async () => {
    render(<GoalsScreen />);
    await userEvent.click(screen.getByRole("button", { name: /^Pozastavené/ }));
    expect(screen.getByTestId(GoalsScreenTestId.NoMatch)).toBeInTheDocument();
  });
});
