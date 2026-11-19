import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import type { DepartmentWithStatus } from "@zibby/contracts";
import { StatCellsTestId, StatePillTestId } from "@zibby/design-system";
import { DepartmentCard } from "./DepartmentCard";

vi.mock("../queries", () => ({
  useDepartmentSubtasksQuery: () => ({
    data: [{ state: "open" }, { state: "open" }, { state: "done" }],
    isPending: false,
  }),
}));

const dept = (state: DepartmentWithStatus["state"]) =>
  ({ id: "dev", code: "ENG", name: "Vývoj", mandate: "Staví.", state }) as DepartmentWithStatus;

describe("DepartmentCard", () => {
  it("shows open subtasks and agent count in the KPI strip", () => {
    render(<DepartmentCard agentCount={4} department={dept("idle")} />);
    const cells = screen.getAllByTestId(StatCellsTestId.Cell);
    expect(cells[0]).toHaveTextContent("2");
    expect(cells[1]).toHaveTextContent("4");
  });

  it("shows the status pill only while the department is active", () => {
    const { unmount } = render(<DepartmentCard agentCount={0} department={dept("idle")} />);
    expect(screen.queryByTestId(StatePillTestId.Root)).toBeNull();
    unmount();
    render(<DepartmentCard agentCount={0} department={dept("running")} />);
    expect(screen.getByTestId(StatePillTestId.Root)).toBeInTheDocument();
  });
});
