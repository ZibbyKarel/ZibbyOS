import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render, screen } from "../../../test/render";
import { GoalFormDialog } from "./GoalFormDialog";
import { GoalFormTestId } from "./GoalForm";

vi.mock("../../projects/queries", () => ({ useProjectsQuery: () => ({ data: [] }) }));
vi.mock("../../companies/queries", () => ({ useCompaniesQuery: () => ({ data: [] }) }));

const onCreate = vi.fn();

async function fillBasics() {
  await userEvent.type(screen.getByTestId(GoalFormTestId.Name), "Moje PR");
  await userEvent.type(screen.getByTestId(GoalFormTestId.Outcome), "Všechny PR jsou zelené.");
}

describe("GoalFormDialog", () => {
  beforeEach(() => onCreate.mockClear());

  it("keeps submit disabled until name and outcome are filled", async () => {
    render(<GoalFormDialog onClose={vi.fn()} onCreate={onCreate} />);
    expect(screen.getByTestId(GoalFormTestId.Submit)).toBeDisabled();
    await fillBasics();
    expect(screen.getByTestId(GoalFormTestId.Submit)).toBeEnabled();
  });

  it("creates a paused one-off goal with a deadline and no cadence", async () => {
    render(<GoalFormDialog onClose={vi.fn()} onCreate={onCreate} />);
    await fillBasics();
    expect(screen.queryByTestId(GoalFormTestId.CadenceHour)).not.toBeInTheDocument();
    await userEvent.type(screen.getByTestId(GoalFormTestId.Deadline), "2026-12-01T10:00");
    await userEvent.click(screen.getByTestId(GoalFormTestId.Submit));
    const body = onCreate.mock.calls[0]![0];
    expect(body).toMatchObject({ id: "moje-pr", enabled: false, scope: { kind: "none" } });
    expect(body.deadline).toBeDefined();
    expect(body).not.toHaveProperty("cadence");
  });

  it("switching to standing swaps the deadline field for cadence and drops the deadline", async () => {
    render(<GoalFormDialog onClose={vi.fn()} onCreate={onCreate} />);
    await fillBasics();
    await userEvent.type(screen.getByTestId(GoalFormTestId.Deadline), "2026-12-01T10:00");
    await userEvent.click(screen.getByRole("button", { name: "Stálý" }));
    expect(screen.queryByTestId(GoalFormTestId.Deadline)).not.toBeInTheDocument();
    await userEvent.type(screen.getByTestId(GoalFormTestId.CycleHours), "6");
    await userEvent.click(screen.getByTestId(GoalFormTestId.Submit));
    const body = onCreate.mock.calls[0]![0];
    expect(body.cadence).toEqual({ every: "weekday", hour: 9 });
    expect(body.cycleHours).toBe(6);
    expect(body).not.toHaveProperty("deadline");
  });

  it("requires a project once the scope is projects", async () => {
    render(<GoalFormDialog onClose={vi.fn()} onCreate={onCreate} />);
    await fillBasics();
    await userEvent.click(screen.getByRole("button", { name: "Projekty" }));
    expect(screen.getByTestId(GoalFormTestId.Submit)).toBeDisabled();
  });

  it("shows a server error above the actions", () => {
    render(<GoalFormDialog error="id already exists" onClose={vi.fn()} onCreate={onCreate} />);
    expect(screen.getByTestId(GoalFormTestId.Error)).toHaveTextContent("id already exists");
  });
});
