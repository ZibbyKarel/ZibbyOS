import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import { RunWidgetCard, RunWidgetCardTestId } from "./RunWidgetCard";

vi.mock("../../chat/components/ChatRunCard", () => ({
  ChatRunCard: (p: { runRef: string }) => <div data-testid="inner">{p.runRef}</div>,
}));

describe("RunWidgetCard", () => {
  it("wraps ChatRunCard with the runRef", () => {
    render(<RunWidgetCard widget={{ kind: "run", runRef: "delivery_1" }} />);
    expect(screen.getByTestId(RunWidgetCardTestId.Root)).toContainElement(
      screen.getByTestId("inner"),
    );
    expect(screen.getByTestId("inner")).toHaveTextContent("delivery_1");
  });
});
