import { AnchoredSheetTestId } from "@zibby/design-system";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../../../../test/render";
import { GoalPlanTestId } from "../../../goals/components/GoalPlanPanel";
import { GoalTimelineTestId } from "../../../goals/components/GoalTimelinePanel";
import { GoalSheet, GoalSheetTestId } from "./GoalSheet";

const d = vi.hoisted(() => ({
  push: vi.fn(),
  wake: vi.fn(),
  update: vi.fn(),
  resume: vi.fn(),
  goalError: undefined as unknown,
  stateError: undefined as unknown,
  stateBody: undefined as unknown,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: d.push }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const goal = {
  id: "ci-green",
  name: "CI zůstává zelené",
  outcome: "o",
  predicate: "p",
  scope: { kind: "none" },
  cadence: { every: "weekday", hour: 9 },
  ceiling: "tier2",
  enabled: true,
};
const state = {
  state: {
    goalId: "ci-green",
    cycle: { index: 2, startedAt: "2026-11-26T08:00:00.000Z" },
    instances: {
      alpha: {
        status: "waiting",
        taskIds: [],
        planNoteId: "plan-alpha",
        waitingOn: [{ kind: "pr", ref: "acme/web#4" }],
        wakeAt: "2026-11-27T08:00:00.000Z",
      },
      beta: { status: "parked", parkedReason: "failed", taskIds: [], summary: "Spadlo CI" },
    },
    decisionsThisMonth: { month: "2026-11", count: 0 },
    nudges: {},
  },
  rollup: {
    status: "needs-you",
    counts: { total: 2, done: 0, parked: 1, active: 1 },
    needsYou: 1,
  },
};
const timeline = [
  { at: "2026-11-25T08:00:00Z", cycle: 1, instance: "alpha", kind: "k", text: "old cycle step" },
  { at: "2026-11-26T08:00:00Z", cycle: 2, instance: "beta", kind: "k", text: "opened a PR" },
];

vi.mock("../../../goals/queries", () => ({
  // ts-rest throws every non-2xx response: `error` is the `{ status, body }`, `data` stays empty.
  useGoalQuery: () => ({
    data: d.goalError ? undefined : goal,
    isError: d.goalError !== undefined,
    error: d.goalError ?? null,
    isPending: false,
    refetch: vi.fn(),
  }),
  useGoalStateQuery: () => ({
    data: d.stateError ? undefined : (d.stateBody ?? state),
    isError: d.stateError !== undefined,
    error: d.stateError ?? null,
    isPending: false,
    refetch: vi.fn(),
  }),
  useGoalTimelineQuery: () => ({ data: timeline }),
}));
vi.mock("../../../goals/mutations", () => ({
  useWakeGoalMutation: () => ({ mutate: d.wake, isPending: false }),
  useUpdateGoalMutation: () => ({ mutate: d.update, isPending: false }),
  useResumeGoalInstanceMutation: () => ({ mutate: d.resume, isPending: false }),
}));
vi.mock("../../../projects/queries", () => ({
  useProjectsQuery: () => ({
    data: [
      { id: "alpha", name: "Alpha" },
      { id: "beta", name: "Beta" },
    ],
  }),
}));
vi.mock("../../../knowledge/queries", () => ({
  useNoteQuery: (id: string) => ({
    data: { id, title: "Plán", body: "## Krok 1" },
    isError: false,
  }),
}));

const anchor = {
  left: 0,
  width: 400,
  top: 0,
  height: 400,
  eL: 0,
  eT: 0,
  eH: 0,
  side: "r",
} as never;
const open = () =>
  renderWithProviders(<GoalSheet anchor={anchor} id="ci-green" onClose={vi.fn()} />);

describe("GoalSheet", () => {
  beforeEach(() => {
    for (const fn of [d.push, d.wake, d.update, d.resume]) fn.mockClear();
    d.goalError = d.stateError = d.stateBody = undefined;
    vi.useRealTimers();
  });

  it("a failed goal query shows the error and the sheet still closes", async () => {
    d.goalError = new TypeError("Failed to fetch");
    const onClose = vi.fn();
    renderWithProviders(<GoalSheet anchor={anchor} id="ci-green" onClose={onClose} />);
    expect(screen.getByTestId(GoalSheetTestId.Status)).toHaveTextContent("Nepodařilo se načíst");
    await userEvent.click(screen.getByTestId(AnchoredSheetTestId.Close));
    expect(onClose).toHaveBeenCalled();
  });

  it("a 404 says the goal no longer exists; any other non-200 status is the error with retry", () => {
    d.goalError = { status: 404, body: { message: "not found" } };
    const { unmount } = open();
    expect(screen.getByTestId(GoalSheetTestId.Status)).toHaveTextContent("už neexistuje");
    unmount();
    d.goalError = { status: 500, body: { message: "boom" } };
    open();
    expect(screen.getByTestId(GoalSheetTestId.Status)).toHaveTextContent("Nepodařilo se načíst");
    expect(screen.getByTestId(GoalSheetTestId.Status)).not.toHaveTextContent("už neexistuje");
  });

  it("a state HTTP 500 shows the error, not 'nothing planned' or a next cycle", () => {
    d.stateError = { status: 500, body: { message: "boom" } };
    open();
    expect(screen.getByTestId(GoalSheetTestId.StateError)).toBeInTheDocument();
    expect(screen.queryByText(/Zatím nic naplánováno/)).toBeNull();
    expect(screen.queryByTestId(GoalSheetTestId.NextCycle)).toBeNull();
  });

  it("a standing goal whose state has no instances yet still shows a next cycle from now", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-02T10:00:00Z"));
    d.stateBody = {
      ...state,
      state: {
        ...state.state,
        instances: {},
        cycle: { index: 0, startedAt: "2026-11-01T08:00:00Z" },
      },
    };
    open();
    expect(screen.getByTestId(GoalSheetTestId.NextCycle)).toHaveTextContent("3. 12. 2026");
  });

  it("a failed state query shows the error, not 'nothing planned' or a next cycle", () => {
    d.stateError = new TypeError("Failed to fetch");
    open();
    expect(screen.getByTestId(GoalSheetTestId.StateError)).toBeInTheDocument();
    expect(screen.queryByText(/Zatím nic naplánováno/)).toBeNull();
    expect(screen.queryByTestId(GoalSheetTestId.NextCycle)).toBeNull();
  });

  it("the next cycle is computed from now, never in the past", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-02T10:00:00Z")); // Wed; cycle started Thu 26 Nov
    open();
    // next weekday 9:00 Prague after Wed 2 Dec 11:00 Prague = Thu 3 Dec
    expect(screen.getByTestId(GoalSheetTestId.NextCycle)).toHaveTextContent("3. 12. 2026");
  });

  it("a failed action shows the error, and the next action clears it", async () => {
    d.wake.mockImplementationOnce((_v, o) => o.onError(new Error("x")));
    open();
    await userEvent.click(screen.getByTestId(GoalSheetTestId.Wake));
    expect(screen.getByTestId(GoalSheetTestId.Error)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(GoalSheetTestId.Wake));
    expect(screen.queryByTestId(GoalSheetTestId.Error)).toBeNull();
  });

  it("a successful pause/enable toggle clears a stale error too", async () => {
    d.wake.mockImplementationOnce((_v, o) => o.onError(new Error("x")));
    open();
    await userEvent.click(screen.getByTestId(GoalSheetTestId.Wake));
    expect(screen.getByTestId(GoalSheetTestId.Error)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(GoalSheetTestId.Toggle));
    expect(screen.queryByTestId(GoalSheetTestId.Error)).toBeNull();
  });

  it("renders the log (every entry, grouped by cycle) and what comes next", () => {
    open();
    expect(screen.getByTestId(AnchoredSheetTestId.Title)).toHaveTextContent("CI zůstává zelené");
    const log = screen.getByTestId(GoalSheetTestId.Log);
    expect(within(log).getAllByTestId(GoalTimelineTestId.Event)).toHaveLength(2);
    expect(within(log).getByTestId(`${GoalTimelineTestId.Cycle}-2`)).toBeInTheDocument();
    expect(screen.getByTestId(`${GoalSheetTestId.WaitingOn}-alpha`)).toHaveTextContent(
      "acme/web#4",
    );
    expect(screen.getByTestId(`${GoalSheetTestId.WakeAt}-alpha`)).toBeInTheDocument();
    expect(screen.getByTestId(GoalSheetTestId.NextCycle)).toBeInTheDocument();
    expect(screen.getByTestId(`${GoalPlanTestId.Note}-plan-alpha`)).toHaveTextContent("Krok 1");
  });

  it("the title opens the goal page", async () => {
    open();
    await userEvent.click(
      within(screen.getByTestId(AnchoredSheetTestId.Title)).getByRole("button"),
    );
    expect(d.push).toHaveBeenCalledWith("/work/goals/ci-green");
  });

  it("wake, pause and resume call the mutations", async () => {
    open();
    await userEvent.click(screen.getByTestId(GoalSheetTestId.Wake));
    expect(d.wake).toHaveBeenCalledWith(
      { params: { id: "ci-green" }, body: {} },
      expect.anything(),
    );
    await userEvent.click(screen.getByTestId(GoalSheetTestId.Toggle));
    expect(d.update).toHaveBeenCalledWith(
      { params: { id: "ci-green" }, body: { enabled: false } },
      expect.anything(),
    );
    await userEvent.click(screen.getByTestId(`${GoalSheetTestId.Resume}-beta`));
    expect(d.resume).toHaveBeenCalledWith(
      { params: { id: "ci-green", instance: "beta" }, body: {} },
      expect.anything(),
    );
    expect(screen.queryByTestId(`${GoalSheetTestId.Resume}-alpha`)).toBeNull();
  });
});
