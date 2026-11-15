import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import { IssuesWidgetCard, IssuesWidgetCardTestId } from "./IssuesWidgetCard";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";

const { items } = vi.hoisted(() => ({ items: vi.fn() }));
vi.mock("../../inbox/queries", () => ({ useInboxItemsQuery: items }));

describe("IssuesWidgetCard", () => {
  it("shows the empty line when nothing is open", () => {
    items.mockReturnValue({ data: { items: [], epics: [] }, isPending: false, isError: false });
    render(<IssuesWidgetCard widget={{ kind: "issues" }} />);
    expect(screen.getByTestId(IssuesWidgetCardTestId.Root)).toBeInTheDocument();
    expect(screen.getByTestId(ChatWidgetFrameTestId.Empty)).toHaveTextContent(
      "Žádné otevřené issues",
    );
  });

  it("shows the error state", () => {
    items.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: vi.fn() });
    render(<IssuesWidgetCard widget={{ kind: "issues" }} />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.Error)).toBeInTheDocument();
  });
});
