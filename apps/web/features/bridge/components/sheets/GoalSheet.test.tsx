import { AnchoredSheetTestId } from "@zibby/design-system";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../../../../test/render";
import { GoalPlanTestId } from "../../../goals/components/GoalPlanPanel";
import { GoalTimelineTestId } from "../../../goals/components/GoalTimelinePanel";
import { GoalSheet, GoalSheetTestId } from "./GoalSheet";

const d = vi.hoisted(() => ({ push: vi.fn(), wake: vi.fn(), update: vi.fn(), resume: vi.fn() }));
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
  useGoalQuery: () => ({ data: goal }),
  useGoalStateQuery: () => ({ data: state }),
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
    for (const fn of Object.values(d)) fn.mockClear();
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
