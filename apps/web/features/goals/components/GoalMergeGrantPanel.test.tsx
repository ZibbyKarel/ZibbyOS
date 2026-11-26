import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import type { Goal } from "@zibby/contracts";
import { DropdownTestId } from "@zibby/design-system";
import { act, renderWithProviders as render, screen } from "../../../test/render";
import { GoalMergeGrantPanel, GoalMergeGrantTestId } from "./GoalMergeGrantPanel";

const set = vi.fn();
const clear = vi.fn();
vi.mock("../mutations", () => ({
  useSetGoalMergeGrantMutation: () => ({ mutate: set, isPending: false }),
  useClearGoalMergeGrantMutation: () => ({ mutate: clear, isPending: false }),
}));

const goal: Goal = {
  id: "g",
  name: "Merge",
  outcome: "PRs merged.",
  scope: { kind: "projects", projectIds: ["alpha", "beta"] },
  ceiling: "tier3",
  enabled: true,
  createdAt: "2026-11-26T10:00:00.000Z",
  updatedAt: "2026-11-26T10:00:00.000Z",
};
const names = { projectName: (id: string) => id.toUpperCase(), companyName: (id: string) => id };
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const panel = (g: Goal = goal) =>
  render(<GoalMergeGrantPanel goal={g} names={names} projectIds={["alpha", "beta"]} />);

describe("GoalMergeGrantPanel", () => {
  beforeEach(() => {
    set.mockClear();
    clear.mockClear();
  });

  it("a non-tier3 goal shows one line and no grant controls", () => {
    panel({ ...goal, ceiling: "tier2" });
    expect(screen.getByTestId(GoalMergeGrantTestId.NeedsTier3)).toHaveTextContent("tier3");
    expect(screen.queryByTestId(GoalMergeGrantTestId.Grant)).not.toBeInTheDocument();
  });

  it("grants for the picked projects until the chosen time; a 401 shows the locked state", async () => {
    panel();
    expect(screen.getByTestId(GoalMergeGrantTestId.Grant)).toBeDisabled();
    await userEvent.click(screen.getByTestId(DropdownTestId.Trigger));
    await userEvent.click(screen.getAllByTestId(DropdownTestId.Option)[0]!);
    fireEvent.change(screen.getByTestId(GoalMergeGrantTestId.Until), {
      target: { value: "2026-11-27T09:30" },
    });
    await userEvent.click(screen.getByTestId(GoalMergeGrantTestId.Grant));
    expect(set).toHaveBeenCalledTimes(1);
    const [vars, opts] = set.mock.calls[0]!;
    expect(vars).toEqual({
      params: { id: "g" },
      body: { projectIds: ["alpha"], until: new Date("2026-11-27T09:30").toISOString() },
    });
    act(() => opts.onError({ status: 401, body: { message: "no token" } }));
    expect(screen.getByTestId(GoalMergeGrantTestId.Error)).toHaveTextContent("operátorský token");
  });

  it("an active grant shows its projects and can be revoked", async () => {
    panel({
      ...goal,
      mergeGrant: { projectIds: ["alpha"], until: inHours(3), grantedAt: inHours(0) },
    });
    expect(screen.getByTestId(GoalMergeGrantTestId.Active)).toHaveTextContent("ALPHA");
    await userEvent.click(screen.getByTestId(GoalMergeGrantTestId.Revoke));
    expect(clear).toHaveBeenCalledWith({ params: { id: "g" }, body: {} }, expect.anything());
  });

  it("an expired grant counts as none: the form is back", () => {
    panel({
      ...goal,
      mergeGrant: { projectIds: ["alpha"], until: inHours(-1), grantedAt: inHours(-3) },
    });
    expect(screen.queryByTestId(GoalMergeGrantTestId.Active)).not.toBeInTheDocument();
    expect(screen.getByTestId(GoalMergeGrantTestId.Grant)).toBeInTheDocument();
  });
});
