import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { BoardPill, BoardPillTestId } from "./BoardPill";

describe("BoardPill", () => {
  it("you is the amber fill, blocked amber text; sentence case", () => {
    const { rerender } = render(<BoardPill tone="you">Tvoje review</BoardPill>);
    const root = screen.getByTestId(BoardPillTestId.Root);
    expect(root).toHaveTextContent("Tvoje review");
    expect(root).toHaveClass("bg-accent", "text-accent-contrast");
    expect(root).not.toHaveClass("uppercase");
    rerender(<BoardPill tone="blocked">Změny</BoardPill>);
    expect(root).toHaveClass("text-accent-fg");
  });
});
