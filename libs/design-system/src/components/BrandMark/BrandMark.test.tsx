import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { BrandMark, BrandMarkTestId } from "./BrandMark";

describe("BrandMark", () => {
  it("renders 24px by default, decorative, with an amber static knot", () => {
    render(<BrandMark />);
    const el = screen.getByTestId(BrandMarkTestId.Root);
    expect(el).toHaveAttribute("width", "24");
    expect(el).toHaveAttribute("height", "24");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).not.toHaveAttribute("role");
    expect(el).toHaveAttribute("data-state", "blocked");
    expect(el).not.toHaveAttribute("data-live");
    expect(screen.getByTestId(BrandMarkTestId.Knot)).toHaveAttribute(
      "fill",
      "var(--color-state-block)",
    );
  });

  it("draws the wings in currentColor with the knot cut out", () => {
    render(<BrandMark />);
    const wings = screen.getByTestId(BrandMarkTestId.Wings);
    expect(wings).toHaveAttribute("fill", "currentColor");
    expect(wings.getAttribute("mask")).toMatch(/^url\(#zb-mark-cut-/);
  });

  it("uses heavier wings at small sizes and adds the glow from 40px up", () => {
    render(<BrandMark size={16} />);
    expect(screen.getByTestId(BrandMarkTestId.Wings)).toHaveAttribute("stroke-width", "6");
    expect(screen.queryByTestId(BrandMarkTestId.Glow)).toBeNull();
  });

  it("adds the glow at 48px with standard wings", () => {
    render(<BrandMark size={48} />);
    expect(screen.getByTestId(BrandMarkTestId.Wings)).toHaveAttribute("stroke-width", "4");
    expect(screen.getByTestId(BrandMarkTestId.Glow)).toBeInTheDocument();
  });

  it("colours the knot by state", () => {
    render(<BrandMark size={64} state="working" />);
    expect(screen.getByTestId(BrandMarkTestId.Knot)).toHaveAttribute(
      "fill",
      "var(--color-state-work)",
    );
    expect(screen.getByTestId(BrandMarkTestId.Glow)).toHaveAttribute(
      "fill",
      "var(--color-state-work)",
    );
  });

  it("sends a ring wave only when live and blocked", () => {
    const { rerender } = render(<BrandMark live state="working" />);
    expect(screen.queryByTestId(BrandMarkTestId.Ring)).toBeNull();
    rerender(<BrandMark live state="blocked" />);
    expect(screen.getByTestId(BrandMarkTestId.Ring)).toBeInTheDocument();
    expect(screen.getByTestId(BrandMarkTestId.Root)).toHaveAttribute("data-live", "true");
  });

  it("marks the intro and shows its ring", () => {
    render(<BrandMark intro size={116} />);
    expect(screen.getByTestId(BrandMarkTestId.Root)).toHaveAttribute("data-intro", "true");
    expect(screen.getByTestId(BrandMarkTestId.Ring)).toBeInTheDocument();
  });

  it("is an image with an accessible name when labelled", () => {
    render(<BrandMark label="ZibbyOS" />);
    const el = screen.getByTestId(BrandMarkTestId.Root);
    expect(el).toHaveRole("img");
    expect(el).toHaveAccessibleName("ZibbyOS");
    expect(el).not.toHaveAttribute("aria-hidden");
  });
});
