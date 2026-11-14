import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { BoardText, BoardTextTestId } from "./BoardText";

describe("BoardText", () => {
  it("renders the kind's voice and lets tone/underline override", () => {
    render(
      <BoardText underline kind="id" tone="ink3">
        ZB-1
      </BoardText>,
    );
    const el = screen.getByTestId(BoardTextTestId.Root);
    expect(el).toHaveTextContent("ZB-1");
    expect(el).toHaveClass("font-mono", "text-ink-3", "underline");
    expect(el).not.toHaveClass("text-ink-2");
  });

  it("redesign voices are sentence case; ids stay mono", () => {
    render(<BoardText kind="rowMeta">repo</BoardText>);
    expect(screen.getByTestId(BoardTextTestId.Root)).toHaveClass("text-meta", "text-ink-3");
    expect(screen.getByTestId(BoardTextTestId.Root)).not.toHaveClass("uppercase");
  });
});
