import { renderWithProviders as render, screen } from "../../../test/render";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DepartmentWithStatus } from "@zibby/contracts";
import { CardSkeletonTestId, CodeTileTestId, OrgChartTestId } from "@zibby/design-system";
import { DepartmentsListScreen } from "./DepartmentsListScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const DEPTS = [
  { id: "dev", code: "ENG", name: "Vývoj", mandate: "Staví produkty.", state: "running" },
  { id: "qa", code: "QA", name: "Kvalita", mandate: "Testy.", state: "idle" },
] as DepartmentWithStatus[];

const { hooks } = vi.hoisted(() => ({
  hooks: {
    departments: {
      data: [] as DepartmentWithStatus[],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
  },
}));

vi.mock("../queries", () => ({
  useDepartmentsQuery: () => hooks.departments,
  useDepartmentSubtasksQuery: () => ({
    data: [{ state: "open" }, { state: "done" }],
    isPending: false,
  }),
}));
vi.mock("../../agents", () => ({
  useAgentsQuery: () => ({ data: [{ id: "a", department: "dev" }] }),
}));

describe("DepartmentsListScreen", () => {
  beforeEach(() => {
    push.mockClear();
    hooks.departments = { data: DEPTS, isPending: false, isError: false, refetch: vi.fn() };
  });

  it("renders the org-chart root and a card per department with its code tile", () => {
    render(<DepartmentsListScreen />);
    expect(screen.getByTestId(OrgChartTestId.Node)).toBeInTheDocument();
    expect(screen.getByText("ENG")).toBeInTheDocument();
    expect(screen.getAllByTestId(CodeTileTestId.Root).length).toBeGreaterThanOrEqual(3);
  });

  it("links to the detail tabs and opens the team tab on card click", async () => {
    render(<DepartmentsListScreen />);
    expect(screen.getAllByRole("link", { name: "Podúkoly" })[0]).toHaveAttribute(
      "href",
      "/workforce/departments/dev/subtasks",
    );
    await userEvent.click(screen.getAllByTestId("list-card-open")[0]!);
    expect(push).toHaveBeenCalledWith("/workforce/departments/dev/team");
  });

  it("shows skeletons while loading", () => {
    hooks.departments = { data: [], isPending: true, isError: false, refetch: vi.fn() };
    render(<DepartmentsListScreen />);
    expect(screen.getAllByTestId(CardSkeletonTestId.Root).length).toBeGreaterThan(0);
  });
});
