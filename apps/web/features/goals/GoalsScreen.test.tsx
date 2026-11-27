import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { GOAL_PRESETS, type GoalTimelineEvent, type GoalWithRollup } from "@zibby/contracts";
import { GoalLoopCardTestId, ListHeaderTestId } from "@zibby/design-system";
import { act, renderWithProviders as render, screen } from "../../test/render";
import { GoalsScreen, GoalsScreenTestId } from "./GoalsScreen";
import { GoalCardTestId } from "./components/GoalCard";
import { GoalPresetsTestId } from "./components/GoalPresets";

const push = vi.fn();
const create = vi.fn();
const update = vi.fn();
const wake = vi.fn();
const refetch = vi.fn();

const { query, timeline } = vi.hoisted(() => ({
  query: { goals: [] as GoalWithRollup[], isPending: false, isError: false },
  timeline: { data: [] as GoalTimelineEvent[], isSuccess: true },
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
  useGoalTimelineQuery: () => ({ data: timeline.data, isSuccess: timeline.isSuccess }),
}));
vi.mock("./mutations", () => ({
  useCreateGoalMutation: () => ({ mutate: create, isPending: false, isError: false }),
  useUpdateGoalMutation: () => ({ mutate: update, isPending: false }),
  useWakeGoalMutation: () => ({ mutate: wake, isPending: false }),
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
    counts: { total: 1, done: 0, parked: 1, active: 0 },
    needsYou: 1,
  },
};

const withStatus = (
  status: GoalWithRollup["rollup"]["status"],
  patch: Partial<GoalWithRollup> = {},
): GoalWithRollup => ({ ...goal, ...patch, rollup: { ...goal.rollup, status } });

describe("GoalsScreen", () => {
  beforeEach(() => {
    query.goals = [goal];
    query.isPending = false;
    query.isError = false;
    timeline.data = [];
    timeline.isSuccess = true;
    push.mockClear();
    create.mockClear();
    update.mockClear();
    wake.mockClear();
    refetch.mockClear();
  });

  it("shows skeletons while loading, never an empty workspace", () => {
    query.isPending = true;
    render(<GoalsScreen />);
    expect(screen.getByTestId(GoalsScreenTestId.Skeletons)).toBeInTheDocument();
    expect(screen.queryByTestId(GoalsScreenTestId.Empty)).not.toBeInTheDocument();
  });

  it("renders a goal as the design card: pill, schedule, title, scope, ceiling, ring", () => {
    render(<GoalsScreen />);
    expect(screen.getByTestId(GoalLoopCardTestId.State)).toHaveTextContent("Čeká na tebe");
    expect(screen.getByTestId(GoalLoopCardTestId.TopMeta)).toHaveTextContent(
      "Každý pracovní den v 09:00",
    );
    expect(screen.getByTestId(GoalLoopCardTestId.Title)).toHaveTextContent("Moje PR jsou hotové");
    expect(screen.getByTestId(`${GoalLoopCardTestId.Party}-0`)).toHaveTextContent(
      "RozsahBez projektu",
    );
    expect(screen.getByTestId(`${GoalLoopCardTestId.Party}-1`)).toHaveTextContent(
      "StropTier 2 · jednat a hlásit",
    );
    expect(screen.queryByTestId(`${GoalLoopCardTestId.Party}-2`)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "0 z 1 projektů hotovo" })).toBeInTheDocument();
    expect(screen.getByText("z 1")).toBeInTheDocument();
  });

  it("adds the loop as a third party", () => {
    query.goals = [{ ...goal, loop: { loopId: "fixer" } }];
    render(<GoalsScreen />);
    expect(screen.getByTestId(`${GoalLoopCardTestId.Party}-2`)).toHaveTextContent("Smyčkafixer");
  });

  it("reads a goal without instances as not run yet", () => {
    query.goals = [
      { ...goal, rollup: { ...goal.rollup, counts: { total: 0, done: 0, parked: 0, active: 0 } } },
    ];
    render(<GoalsScreen />);
    expect(screen.getByRole("img", { name: "zatím neběžel" })).toBeInTheDocument();
  });

  it("counts working, needs-you and done goals in the header", () => {
    query.goals = [goal, withStatus("acting", { id: "a" }), withStatus("done", { id: "b" })];
    render(<GoalsScreen />);
    expect(screen.getByTestId(ListHeaderTestId.Count)).toHaveTextContent(
      "3 cíle · 1 pracuje · 1 čeká na tebe · 1 hotový",
    );
  });

  it("shows the newest timeline event as the verdict, flagged for a needs-you goal", () => {
    timeline.data = [
      { at: "2026-11-26T09:00:00.000Z", cycle: 0, instance: "_", kind: "note", text: "old" },
      { at: "2026-11-26T10:00:00.000Z", cycle: 0, instance: "_", kind: "park", text: "CI red" },
    ];
    render(<GoalsScreen />);
    const verdict = screen.getByTestId(GoalLoopCardTestId.Verdict);
    expect(verdict).toHaveTextContent("Poslední krok");
    expect(verdict).toHaveTextContent("čeká na tebe");
    expect(verdict).toHaveTextContent("CI red");
    expect(verdict).not.toHaveTextContent("old");
  });

  it("shows the no-record box for an empty timeline and no box while it is not loaded", () => {
    const { unmount } = render(<GoalsScreen />);
    expect(screen.getByTestId(GoalLoopCardTestId.Verdict)).toHaveTextContent(
      "Zatím bez záznamuCíl ještě neběžel.",
    );
    unmount();
    timeline.isSuccess = false;
    render(<GoalsScreen />);
    expect(screen.queryByTestId(GoalLoopCardTestId.Verdict)).not.toBeInTheDocument();
  });

  it("offers Rozhodnout on a needs-you goal, which opens the detail page", async () => {
    render(<GoalsScreen />);
    await userEvent.click(screen.getByTestId(GoalCardTestId.Decide));
    expect(push).toHaveBeenCalledWith("/work/goals/my-prs");
    expect(screen.queryByTestId(GoalCardTestId.Wake)).not.toBeInTheDocument();
  });

  it("wakes and pauses an enabled goal", async () => {
    query.goals = [withStatus("acting")];
    render(<GoalsScreen />);
    await userEvent.click(screen.getByTestId(GoalCardTestId.Wake));
    expect(wake).toHaveBeenCalledWith({ params: { id: "my-prs" }, body: {} }, expect.anything());
    await userEvent.click(screen.getByTestId(GoalCardTestId.Pause));
    expect(update).toHaveBeenCalledWith(
      { params: { id: "my-prs" }, body: { enabled: false } },
      expect.anything(),
    );
  });

  it("turns a paused goal back on", async () => {
    query.goals = [withStatus("paused", { enabled: false })];
    render(<GoalsScreen />);
    await userEvent.click(screen.getByTestId(GoalCardTestId.Enable));
    expect(update).toHaveBeenCalledWith(
      { params: { id: "my-prs" }, body: { enabled: true } },
      expect.anything(),
    );
  });

  it("opens the detail page from the card cover", async () => {
    render(<GoalsScreen />);
    const cover = screen.getByTestId(GoalLoopCardTestId.Open);
    expect(cover).toHaveAccessibleName("Otevřít: Moje PR jsou hotové");
    await userEvent.click(cover);
    expect(push).toHaveBeenCalledWith("/work/goals/my-prs");
  });

  it("shows an error when a card action fails", async () => {
    query.goals = [withStatus("acting")];
    render(<GoalsScreen />);
    await userEvent.click(screen.getByTestId(GoalCardTestId.Wake));
    act(() => wake.mock.calls[0]![1].onError(new Error("network")));
    expect(screen.getByTestId(GoalsScreenTestId.Error)).toHaveTextContent("Akce se nepovedla");
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

  it("shows the server error when a preset add fails with anything but 409", () => {
    query.goals = [];
    render(<GoalsScreen />);
    const preset = GOAL_PRESETS[0]!;
    screen.getByTestId(`${GoalPresetsTestId.Add}-${preset.id}`).click();
    act(() => create.mock.calls[0]![1].onError({ status: 500, body: { message: "boom" } }));
    expect(screen.getByTestId(GoalsScreenTestId.Error)).toHaveTextContent("boom");
  });

  it("stays silent on a 409 preset add (the refetch flips it to Přidáno)", () => {
    query.goals = [];
    render(<GoalsScreen />);
    const preset = GOAL_PRESETS[0]!;
    screen.getByTestId(`${GoalPresetsTestId.Add}-${preset.id}`).click();
    act(() => create.mock.calls[0]![1].onError({ status: 409, body: { message: "exists" } }));
    expect(screen.queryByTestId(GoalsScreenTestId.Error)).not.toBeInTheDocument();
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
