import { DropdownTestId } from "@zibby/design-system";
import userEvent from "@testing-library/user-event";
import type { GoalRollupStatus, GoalWithRollup } from "@zibby/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../../../test/render";
import type { BridgeWidget } from "../grid/layout";
import type { BridgeWidgetProps } from "./registry";
import { GoalsWidget, GoalsWidgetSettings, GoalsWidgetTestId } from "./GoalsWidget";

const d = vi.hoisted(() => ({ goals: [] as unknown[] }));

vi.mock("../../goals/queries", () => ({
  useGoalsQuery: () => ({ data: d.goals, isPending: false, isError: false }),
  useGoalTimelineQuery: (id: string) => ({
    data: [
      { at: "2026-11-26T10:00:00Z", cycle: 0, instance: "_", kind: "x", text: `latest ${id}` },
    ],
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

const names = () => screen.getAllByTestId(GoalsWidgetTestId.Row).map((r) => r.textContent);

describe("GoalsWidget", () => {
  it("without picks shows every enabled goal, needs-you first, then busy, waiting, done", () => {
    renderWithProviders(<GoalsWidget {...setup()} />);
    expect(names()).toEqual(["beta-need", "acting", "alpha-wait", "zeta-done"]);
  });

  it("shows counts with the needs-you part and the latest timeline line", () => {
    renderWithProviders(<GoalsWidget {...setup()} />);
    expect(screen.getAllByTestId(GoalsWidgetTestId.Counts)[0]).toHaveTextContent(
      "7 z 9 hotovo · 1 čeká na tebe",
    );
    expect(screen.getAllByTestId(GoalsWidgetTestId.Latest)[0]).toHaveTextContent(
      "latest beta-need",
    );
  });

  it("shows only the picked goals (paused included), ignores gone ids, and opens the goal selection", async () => {
    const props = setup({ widget: widget({ goalIds: ["off", "zeta-done", "deleted"] }) });
    renderWithProviders(<GoalsWidget {...props} />);
    expect(names()).toEqual(["zeta-done", "off"]);
    await userEvent.click(screen.getAllByTestId(GoalsWidgetTestId.Row)[0]!);
    expect(props.onOpen).toHaveBeenCalledWith({
      kind: "goal",
      id: "zeta-done",
      widgetId: "w-goals",
      key: "w-goals:zeta-done",
    });
    expect(props.onCountChange).toHaveBeenLastCalledWith(expect.objectContaining({ count: 2 }));
  });

  it("picks that match nothing show the no-match state; no goals shows the link to the page", () => {
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
