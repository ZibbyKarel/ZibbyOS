import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { BoardTag, BoardTagTestId } from "./BoardTag";

describe("BoardTag", () => {
  it("you is an amber pill, source is a neutral chip", () => {
    const { rerender } = render(<BoardTag variant="you">YOU · 2H</BoardTag>);
    expect(screen.getByTestId(BoardTagTestId.Root)).toHaveClass("text-accent-fg");
    rerender(<BoardTag variant="source">JIRA</BoardTag>);
    expect(screen.getByTestId(BoardTagTestId.Root)).toHaveClass("text-ink-2");
  });
});
