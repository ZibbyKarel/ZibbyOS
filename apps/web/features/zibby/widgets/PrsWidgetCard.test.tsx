import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import { PrsWidgetCard, PrsWidgetCardTestId, projectOwnsRepo } from "./PrsWidgetCard";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";

const { prs, projects } = vi.hoisted(() => ({ prs: vi.fn(), projects: vi.fn() }));
vi.mock("../../inbox/queries", () => ({ useInboxPrsQuery: prs }));
vi.mock("../../projects/queries", () => ({ useProjectsQuery: projects }));

const pr = (n: number, bucket: "mine" | "to-review") => ({
  source: "github",
  number: n,
  title: `PR ${n}`,
  url: `https://github.com/org/repo/pull/${n}`,
  repo: "org/repo",
  author: "me",
  createdAt: "2026-11-14T08:00:00.000Z",
  updatedAt: "2026-11-15T08:00:00.000Z",
  draft: false,
  ci: { state: "passing" },
  review: { state: "none" },
  mergeable: true,
  bucket,
});

describe("PrsWidgetCard", () => {
  it("matches a repo against the project's git remote", () => {
    expect(projectOwnsRepo({ gitRemote: "git@github.com:Org/Repo.git" }, "org/repo")).toBe(true);
    expect(projectOwnsRepo({ gitRemote: "https://github.com/x/y" }, "org/repo")).toBe(false);
  });

  it("links a row to the PR detail the dashboard uses", () => {
    prs.mockReturnValue({
      data: { prs: [pr(1, "mine")] },
      isPending: false,
      isError: false,
    });
    projects.mockReturnValue({ data: [] });
    render(<PrsWidgetCard widget={{ kind: "prs" }} />);
    expect(screen.getByTestId(PrsWidgetCardTestId.Root)).toBeInTheDocument();
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-repo#1`)).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/inbox/pull-requests?pr="),
    );
  });
});
