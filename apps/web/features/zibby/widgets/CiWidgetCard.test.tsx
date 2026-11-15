import { renderWithProviders as render, screen } from "../../../test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CiWidgetCard, CiWidgetCardTestId, sortCi } from "./CiWidgetCard";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";

const { ci, projects } = vi.hoisted(() => ({
  ci: vi.fn(),
  projects: vi.fn(),
}));
vi.mock("../../projects/queries", () => ({ useCiStatusQuery: ci, useProjectsQuery: projects }));

const status = (state: "red" | "green", id: string) => ({
  integrationId: id,
  projectId: "alpha",
  adapterKind: "github-ci",
  state,
  sinceAt: "2026-11-15T08:00:00.000Z",
  checkedAt: "2026-11-15T08:05:00.000Z",
  summary: `build ${id}`,
});

describe("CiWidgetCard", () => {
  beforeEach(() => {
    projects.mockReturnValue({ data: [{ id: "alpha", name: "Alpha" }] });
  });

  it("sorts red first", () => {
    expect(sortCi([status("green", "a"), status("red", "b")])[0]?.state).toBe("red");
  });

  it("a red run offers 'Oprav to' which calls onPrompt with a concrete prompt", async () => {
    ci.mockReturnValue({
      data: [status("red", "r"), status("green", "g")],
      isPending: false,
      isError: false,
    });
    const onPrompt = vi.fn();
    render(<CiWidgetCard onPrompt={onPrompt} widget={{ kind: "ci" }} />);
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.Row}-r--github-ci`)).toBeInTheDocument();
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.Row}-g--github-ci`)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`${CiWidgetCardTestId.Fix}-r--github-ci`));
    expect(onPrompt).toHaveBeenCalledWith(expect.stringContaining("build r"));
    expect(onPrompt.mock.calls[0]?.[0]).toContain("Alpha");
    expect(screen.queryByTestId(`${CiWidgetCardTestId.Fix}-g--github-ci`)).not.toBeInTheDocument();
  });

  it("hides the fix button without onPrompt", () => {
    ci.mockReturnValue({ data: [status("red", "r")], isPending: false, isError: false });
    render(<CiWidgetCard widget={{ kind: "ci" }} />);
    expect(screen.queryByTestId(`${CiWidgetCardTestId.Fix}-r--github-ci`)).not.toBeInTheDocument();
  });

  it("shows the empty line", () => {
    ci.mockReturnValue({ data: [], isPending: false, isError: false });
    render(<CiWidgetCard widget={{ kind: "ci" }} />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.Empty)).toHaveTextContent("Žádné sledované CI");
  });
});
