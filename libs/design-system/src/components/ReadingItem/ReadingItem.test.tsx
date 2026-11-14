import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ReadingItem, ReadingItemTestId } from "./ReadingItem";

describe("ReadingItem", () => {
  it("renders text, sub and action with the row key", () => {
    render(
      <ReadingItem
        action={<a href="#r">Resolve</a>}
        rowKey="w:q:0"
        sub="Standup"
        text="Who owns X?"
      />,
    );
    expect(screen.getByTestId(ReadingItemTestId.Text)).toHaveTextContent("Who owns X?");
    expect(screen.getByTestId(ReadingItemTestId.Sub)).toHaveTextContent("Standup");
    expect(screen.getByTestId(ReadingItemTestId.Action)).toHaveTextContent("Resolve");
    expect(screen.getByTestId(ReadingItemTestId.Root)).toHaveAttribute("data-rk", "w:q:0");
  });

  it("opens through the text area, not the action", async () => {
    const onClick = vi.fn();
    render(<ReadingItem action={<button type="button">go</button>} onClick={onClick} text="Q" />);
    await userEvent.click(screen.getByText("go"));
    expect(onClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId(ReadingItemTestId.Open));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
