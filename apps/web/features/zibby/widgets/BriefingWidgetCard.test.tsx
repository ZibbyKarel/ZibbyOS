import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import { BriefingWidgetCard, BriefingWidgetCardTestId } from "./BriefingWidgetCard";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";

const { briefing } = vi.hoisted(() => ({ briefing: vi.fn() }));
vi.mock("../../briefing/queries", () => ({ useBriefingQuery: briefing }));

const base = {
  generatedAt: "2026-11-15T07:00:00.000Z",
  since: "2026-11-14T07:00:00.000Z",
  headline: "Dvě věci čekají.",
  nothingNeedsYou: false,
  needsYou: [1, 2, 3, 4].map((n) => ({
    kind: "approval",
    id: `n${n}`,
    summary: `Věc ${n}`,
    at: "2026-11-15T06:00:00.000Z",
    refs: {},
  })),
  didForYou: [],
  watching: [],
  engagements: [],
  counts: {},
};

describe("BriefingWidgetCard", () => {
  it("shows the headline, 3 needs-you rows and the remainder", () => {
    briefing.mockReturnValue({ data: base, isPending: false, isError: false });
    render(<BriefingWidgetCard widget={{ kind: "briefing" }} />);
    expect(screen.getByTestId(BriefingWidgetCardTestId.Headline)).toHaveTextContent("Dvě věci");
    expect(screen.getByTestId(BriefingWidgetCardTestId.MoreNeedsYou)).toHaveTextContent("+1");
  });

  it("shows the empty line without a briefing", () => {
    briefing.mockReturnValue({ data: undefined, isPending: false, isError: false });
    render(<BriefingWidgetCard widget={{ kind: "briefing" }} />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.Empty)).toBeInTheDocument();
  });
});
