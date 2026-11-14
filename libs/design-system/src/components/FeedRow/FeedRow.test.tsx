import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { FeedRow, FeedRowTestId } from "./FeedRow";

describe("FeedRow", () => {
  it("renders glyph, who, text and age with the row key", () => {
    render(
      <FeedRow age="5m" glyph="GH" glyphLabel="github" rowKey="w:1" text="Looks good" who="anna" />,
    );
    expect(screen.getByTestId(FeedRowTestId.Glyph)).toHaveAccessibleName("github");
    expect(screen.getByTestId(FeedRowTestId.Who)).toHaveTextContent("anna");
    expect(screen.getByTestId(FeedRowTestId.Text)).toHaveTextContent("Looks good");
    expect(screen.getByTestId(FeedRowTestId.Age)).toHaveTextContent("5m");
    expect(screen.getByTestId(FeedRowTestId.Root)).toHaveAttribute("data-rk", "w:1");
  });

  it("is a button only when clickable", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<FeedRow glyph="#" onClick={onClick} text="x" />);
    await userEvent.click(screen.getByTestId(FeedRowTestId.Root));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByTestId(FeedRowTestId.Root)).toHaveRole("button");
    rerender(<FeedRow glyph="#" text="x" />);
    expect(screen.getByTestId(FeedRowTestId.Root)).not.toHaveRole("button");
  });

  it("shows the unread dot only when unread", () => {
    const { rerender } = render(<FeedRow glyph="@" text="x" />);
    expect(screen.queryByTestId(FeedRowTestId.Unread)).toBeNull();
    rerender(<FeedRow unread glyph="@" text="x" />);
    expect(screen.getByTestId(FeedRowTestId.Unread)).toBeInTheDocument();
  });
});
