import { renderSettings as render, screen } from "../testing/renderSettings";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ActivityView, DEFAULT_ACTIVITY_VIEW } from "@zibby/contracts";
import { ActivitySection } from "./ActivitySection";

let view: ActivityView = DEFAULT_ACTIVITY_VIEW;
const setView = vi.fn();

vi.mock("../queries", () => ({ useActivityViewQuery: () => ({ data: view }) }));
vi.mock("../mutations", () => ({
  useSetActivityViewMutation: () => ({ mutate: setView, isPending: false }),
}));

beforeEach(() => {
  setView.mockReset();
  view = DEFAULT_ACTIVITY_VIEW;
});

async function openPanel() {
  const header = screen.queryByRole("button", { expanded: false });
  if (header) await userEvent.click(header);
}

describe("ActivitySection", () => {
  it("reflects the current mode per group (tasks default = visible)", async () => {
    render(<ActivitySection />);
    await openPanel();
    expect(screen.getByTestId("radio-matrix-cell-tasks-visible")).toBeChecked();
  });

  it("changing a group's mode PUTs the whole view with only that group changed", async () => {
    render(<ActivitySection />);
    await openPanel();
    await userEvent.click(screen.getByTestId("radio-matrix-cell-tasks-hidden"));
    expect(setView).toHaveBeenCalledWith({ body: { ...DEFAULT_ACTIVITY_VIEW, tasks: "hidden" } });
  });
});
