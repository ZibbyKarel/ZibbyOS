import { DropdownTestId, GoalLoopCardTestId } from "@zibby/design-system";
import userEvent from "@testing-library/user-event";
import type { GoalRollupStatus, GoalWithRollup } from "@zibby/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../../../test/render";
import type { BridgeWidget } from "../grid/layout";
import type { BridgeWidgetProps } from "./registry";
import { GoalsWidget, GoalsWidgetSettings, GoalsWidgetTestId } from "./GoalsWidget";

const d = vi.hoisted(() => ({
  goals: [] as unknown[],
  timeline: "ok" as "ok" | "empty" | "pending" | "error",
  held: [] as string[],
}));
vi.mock("../../goals/mutations", () => ({
  useUpdateGoalMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useWakeGoalMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../goals/queries", () => ({
  useGoalsQuery: () => ({ data: d.goals, isPending: false, isError: false }),
  useGoalStateQuery: (id: string) => ({
    data: d.held.includes(id)
      ? {
          state: { instances: { _: { status: "planning", taskIds: [], held: "autonomy-manual" } } },
        }
      : undefined,
  }),
  useGoalTimelineQuery: (id: string) => ({
    data:
      d.timeline === "ok"
        ? [{ at: "2026-11-26T10:00:00Z", cycle: 0, instance: "_", kind: "x", text: `latest ${id}` }]
        : d.timeline === "empty"
          ? []
          : undefined,
    isSuccess: d.timeline === "ok" || d.timeline === "empty",
    isPending: d.timeline === "pending",
    isError: d.timeline === "error",
  }),
}));

const goal = (
  id: string,
  status: GoalRollupStatus,
  over: Partial<GoalWithRollup> = {},
): GoalWithRollup =>
  ({
    id,
    name: id,
    outcome: "o",
    predicate: "p",
    scope: { kind: "none" },
    ceiling: "tier2",
    enabled: status !== "paused",
    createdAt: "2026-11-26T10:00:00.000Z",
    updatedAt: "2026-11-26T10:00:00.000Z",
    rollup: {
      status,
      counts: { total: 9, done: 7, parked: status === "needs-you" ? 1 : 0, active: 1 },
      needsYou: status === "needs-you" ? 1 : 0,
    },
    ...over,
  }) as GoalWithRollup;

const widget = (scope?: BridgeWidget["scope"]): BridgeWidget => ({
  id: "w-goals",
  type: "goals",
  x: 0,
  y: 0,
  w: 4,
  h: 6,
  scope,
});
const setup = (over: Partial<BridgeWidgetProps> = {}): BridgeWidgetProps => ({
  widget: widget(),
  adding: false,
  onEmptyChange: vi.fn(),
  onCountChange: vi.fn(),
  selection: null,
  onOpen: vi.fn(),
  epicClosed: {},
  onEpicToggle: vi.fn(),
  ...over,
});

beforeEach(() => {
  d.goals = [
    goal("zeta-done", "done"),
    goal("alpha-wait", "waiting"),
    goal("beta-need", "needs-you"),
    goal("off", "paused"),
    goal("acting", "acting"),
  ];
});

const names = () => screen.getAllByTestId(GoalLoopCardTestId.Title).map((r) => r.textContent);

describe("GoalsWidget", () => {
  it("without picks shows every enabled goal, needs-you first, then busy, waiting, done", () => {
    renderWithProviders(<GoalsWidget {...setup()} />);
    expect(names()).toEqual(["beta-need", "acting", "alpha-wait", "zeta-done"]);
  });

  it("renders the list page's goal card, compact, in one grid", () => {
    renderWithProviders(<GoalsWidget {...setup()} />);
    expect(screen.getByTestId(GoalsWidgetTestId.List)).toBeInTheDocument();
    const roots = screen.getAllByTestId(GoalLoopCardTestId.Root);
    expect(roots).toHaveLength(4);
    expect(roots[0]).toHaveAttribute("data-size", "compact");
    expect(roots[0]).toHaveAttribute("data-rk", "w-goals:beta-need");
    expect(screen.getAllByTestId(GoalLoopCardTestId.Verdict)[0]).toHaveTextContent(
      "latest beta-need",
    );
  });

  it("a pending or failed timeline shows no verdict, an empty one says nothing happened yet", () => {
    for (const state of ["pending", "error"] as const) {
      d.timeline = state;
      const { unmount } = renderWithProviders(<GoalsWidget {...setup()} />);
      expect(screen.queryByTestId(GoalLoopCardTestId.Verdict)).toBeNull();
      unmount();
    }
    d.timeline = "empty";
    renderWithProviders(<GoalsWidget {...setup()} />);
    expect(screen.getAllByTestId(GoalLoopCardTestId.Verdict)[0]).not.toHaveTextContent("latest");
    d.timeline = "ok";
  });

  it("a held goal reads 'held by Manual' with the reason, not working", () => {
    d.held = ["acting"];
    renderWithProviders(<GoalsWidget {...setup()} />);
    const card = screen
      .getAllByTestId(GoalLoopCardTestId.Root)
      .find((r) => r.textContent?.includes("acting"))!;
    expect(within(card).getByTestId(GoalLoopCardTestId.State)).toHaveTextContent("Drží manuál");
    expect(within(card).getByTestId(GoalLoopCardTestId.Verdict)).toHaveTextContent(
      "Spouštění a rozhodování cílů je tady na Manuálu",
    );
    d.held = [];
  });

  it("shows only the picked goals (paused included), ignores gone ids, and opens the goal selection", async () => {
    const props = setup({ widget: widget({ goalIds: ["off", "zeta-done", "deleted"] }) });
    renderWithProviders(<GoalsWidget {...props} />);
    expect(names()).toEqual(["zeta-done", "off"]);
    await userEvent.click(screen.getAllByTestId(GoalLoopCardTestId.Open)[0]!);
    expect(props.onOpen).toHaveBeenCalledWith({
      kind: "goal",
      id: "zeta-done",
      widgetId: "w-goals",
      key: "w-goals:zeta-done",
    });
    expect(props.onCountChange).toHaveBeenLastCalledWith(expect.objectContaining({ count: 2 }));
  });

  it("marks the open goal's card as selected", () => {
    renderWithProviders(
      <GoalsWidget
        {...setup({
          selection: { kind: "goal", id: "acting", widgetId: "w-goals", key: "w-goals:acting" },
        })}
      />,
    );
    const selected = screen
      .getAllByTestId(GoalLoopCardTestId.Root)
      .filter((r) => r.getAttribute("data-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAttribute("data-rk", "w-goals:acting");
  });

  it("picks that match nothing show the no-match state", () => {
    renderWithProviders(<GoalsWidget {...setup({ widget: widget({ goalIds: ["gone"] }) })} />);
    expect(screen.getByTestId(GoalsWidgetTestId.NoMatch)).toBeInTheDocument();
  });

  it("no goals at all links to /work/goals", () => {
    d.goals = [];
    renderWithProviders(<GoalsWidget {...setup()} />);
    expect(screen.getByTestId(GoalsWidgetTestId.Empty)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/work/goals");
  });

  it("settings write the pick into scope.goalIds", async () => {
    const onChange = vi.fn();
    const draft = widget();
    renderWithProviders(<GoalsWidgetSettings draft={draft} onChange={onChange} />);
    const select = screen.getByTestId(GoalsWidgetTestId.Select);
    await userEvent.click(within(select).getByTestId(DropdownTestId.Trigger));
    const option = screen
      .getAllByTestId(DropdownTestId.Option)
      .find((o) => o.textContent === "acting");
    await userEvent.click(option!);
    expect(onChange).toHaveBeenCalledWith({ ...draft, scope: { goalIds: ["acting"] } });
  });
});
