import { renderWithProviders as render, screen, within } from "../../../test/render";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@zibby/contracts";
import { CardSkeletonTestId, ListSectionTestId, ListToolbarTestId } from "@zibby/design-system";
import { ProjectsListScreen } from "./ProjectsListScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const PROJECTS = [
  { id: "a", name: "Alpha", path: "~/a", category: "Produkty" },
  { id: "b", name: "Beta", path: "~/b", category: "Produkty" },
] as Project[];

const { hooks } = vi.hoisted(() => ({
  hooks: {
    projects: { data: [] as Project[], isPending: false, isError: false, refetch: vi.fn() },
    categories: [] as { name: string; glyph: string }[],
  },
}));

vi.mock("../queries", () => ({
  useProjectsQuery: () => hooks.projects,
  useProjectCategoriesQuery: () => ({ data: hooks.categories }),
  useBudgetQuery: () => ({ data: undefined }),
  useProjectTaskStats: () => ({ total: 0, groups: [] }),
}));
vi.mock("../mutations", () => ({
  useCreateProjectCategoryMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProjectCategoryMutation: () => ({ mutate: vi.fn() }),
}));
vi.mock("../../runs", () => ({ useRunsQuery: () => ({ runs: [] }) }));
vi.mock("../components/ProjectCard", () => ({
  ProjectCard: ({ project }: { project: Project }) => <div>{project.name}</div>,
}));

describe("ProjectsListScreen", () => {
  beforeEach(() => {
    push.mockClear();
    hooks.projects = { data: PROJECTS, isPending: false, isError: false, refetch: vi.fn() };
    hooks.categories = [
      { name: "Produkty", glyph: "code" },
      { name: "Archiv", glyph: "file" },
    ];
  });

  it("groups cards by category and keeps an empty category with its section", () => {
    render(<ProjectsListScreen />);
    expect(screen.getAllByTestId(ListSectionTestId.Root)).toHaveLength(2);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByLabelText("Smazat prázdnou kategorii Archiv")).toBeInTheDocument();
  });

  it("search narrows the cards and hides the emptied sections", async () => {
    render(<ProjectsListScreen />);
    await userEvent.type(
      within(screen.getByTestId(ListToolbarTestId.Search)).getByRole("textbox"),
      "alp",
    );
    expect(screen.queryByText("Beta")).toBeNull();
    expect(screen.getAllByTestId(ListSectionTestId.Root)).toHaveLength(1);
  });

  it("renders the filter chips and skeletons while loading", () => {
    render(<ProjectsListScreen />);
    expect(screen.getAllByTestId(ListToolbarTestId.Chip)).toHaveLength(4);
    hooks.projects = { data: [], isPending: true, isError: false, refetch: vi.fn() };
    render(<ProjectsListScreen />);
    expect(screen.getAllByTestId(CardSkeletonTestId.Root).length).toBeGreaterThan(0);
  });

  it("header add action navigates to /projects/new", async () => {
    render(<ProjectsListScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Nový projekt" }));
    expect(push).toHaveBeenCalledWith("/projects/new");
  });
});
