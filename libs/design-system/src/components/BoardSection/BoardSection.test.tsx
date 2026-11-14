import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { BoardSection, BoardSectionTestId } from "./BoardSection";

describe("BoardSection", () => {
  it("renders label and count as a static divider", () => {
    render(<BoardSection count="02" label="Parked" />);
    expect(screen.getByTestId(BoardSectionTestId.Label)).toHaveTextContent("Parked");
    expect(screen.getByTestId(BoardSectionTestId.Count)).toHaveTextContent("02");
    expect(screen.getByTestId(BoardSectionTestId.Root)).not.toHaveRole("button");
  });

  it("toggles as a disclosure button", async () => {
    const onToggle = vi.fn();
    render(<BoardSection closed label="Queued" onToggle={onToggle} />);
    const root = screen.getByTestId(BoardSectionTestId.Root);
    expect(root).toHaveRole("button");
    expect(root).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(root);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
