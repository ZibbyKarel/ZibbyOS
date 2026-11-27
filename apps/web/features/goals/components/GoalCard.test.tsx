import { describe, expect, it, vi } from "vitest";
import type { GoalWithRollup } from "@zibby/contracts";
import { GoalLoopCardTestId } from "@zibby/design-system";
import { renderWithProviders as render, screen } from "../../../test/render";
import { GoalCard } from "./GoalCard";

vi.mock("../queries", () => ({
  useGoalTimelineQuery: () => ({
    data: [{ at: "2026-11-26T10:00:00.000Z", cycle: 0, instance: "_", kind: "n", text: "PR #4" }],
    isSuccess: true,
  }),
}));
vi.mock("../mutations", () => ({
  useUpdateGoalMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useWakeGoalMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const goal: GoalWithRollup = {
  id: "g",
  name: "Goal",
  outcome: "o",
  scope: { kind: "all" },
  ceiling: "tier1",
  enabled: true,
  createdAt: "2026-11-26T10:00:00.000Z",
  updatedAt: "2026-11-26T10:00:00.000Z",
  rollup: { status: "acting", counts: { total: 4, done: 1, parked: 0, active: 3 }, needsYou: 0 },
};
const names = { projectName: (id: string) => id, companyName: (id: string) => id };

describe("GoalCard", () => {
  it("passes compact and selected through to the DS card", () => {
    render(<GoalCard selected goal={goal} names={names} onOpen={vi.fn()} size="compact" />);
    const root = screen.getByTestId(GoalLoopCardTestId.Root);
    expect(root).toHaveAttribute("data-size", "compact");
    expect(root).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId(GoalLoopCardTestId.Verdict)).toHaveTextContent(/^PR #4$/);
    expect(screen.queryByTestId(GoalLoopCardTestId.Actions)).not.toBeInTheDocument();
  });
});
