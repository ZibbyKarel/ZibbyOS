import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "@zibby/contracts";
import {
  ProjectStatusWidgetCard,
  ProjectStatusWidgetCardTestId,
  projectStatusRows,
} from "./ProjectStatusWidgetCard";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";

const { projects, ci, health } = vi.hoisted(() => ({
  projects: vi.fn(),
  ci: vi.fn(),
  health: vi.fn(),
}));
vi.mock("../../projects/queries", () => ({
  useProjectsQuery: projects,
  useCiStatusQuery: ci,
}));
vi.mock("../../project-health/queries", () => ({ useProjectHealthQuery: health }));

const p = (id: string) => ({ id, name: id.toUpperCase() }) as Project;
const red = {
  integrationId: "i",
  projectId: "b",
  adapterKind: "github-ci",
  state: "red" as const,
  sinceAt: "2026-11-15T08:00:00.000Z",
  checkedAt: "2026-11-15T08:00:00.000Z",
  summary: "x",
};

describe("ProjectStatusWidgetCard", () => {
  it("puts projects needing attention first and filters by projectId", () => {
    const rows = projectStatusRows([p("a"), p("b")], [red], []);
    expect(rows.map((r) => r.project.id)).toEqual(["b", "a"]);
    expect(projectStatusRows([p("a"), p("b")], [], [], "a")).toHaveLength(1);
  });

  it("renders the attention row with a project link", () => {
    projects.mockReturnValue({ data: [p("a"), p("b")], isPending: false, isError: false });
    ci.mockReturnValue({ data: [red] });
    health.mockReturnValue({ data: [] });
    render(<ProjectStatusWidgetCard widget={{ kind: "project-status" }} />);
    expect(screen.getByTestId(ProjectStatusWidgetCardTestId.Root)).toBeInTheDocument();
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-b`)).toHaveAttribute(
      "href",
      "/projects/b",
    );
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.RowStatus}-b`)).toHaveTextContent(
      "Potřebuje pozornost",
    );
  });
});
