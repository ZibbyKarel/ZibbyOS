import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { StateGlyph, StateGlyphTestId } from "./StateGlyph";

describe("StateGlyph", () => {
  it("is an image named by its meaning, coloured by state", () => {
    render(<StateGlyph icon="x" label="CI failing" tone="error" />);
    const root = screen.getByTestId(StateGlyphTestId.Root);
    expect(root).toHaveRole("img");
    expect(root).toHaveAccessibleName("CI failing");
    expect(root).toHaveAttribute("title", "CI failing");
    expect(root).toHaveClass("text-state-err");
  });

  it("amber uses the text token on the fill token; spin respects reduced motion", () => {
    render(<StateGlyph spin icon="run" label="Conflict" tone="blocked" />);
    const root = screen.getByTestId(StateGlyphTestId.Root);
    expect(root).toHaveClass("text-accent-fg", "bg-accent-dim");
    expect(root.firstElementChild?.className).toContain("motion-reduce:animate-none");
  });
});
