import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IndentRail, IndentRailTestId } from "./IndentRail";

describe("IndentRail", () => {
  it("renders its children inside the rail", () => {
    render(
      <IndentRail>
        <span>kid</span>
      </IndentRail>,
    );
    expect(screen.getByTestId(IndentRailTestId.Root)).toHaveTextContent("kid");
  });

  it("passes the ref through", () => {
    let el: HTMLDivElement | null = null;
    render(
      <IndentRail ref={(n) => void (el = n)}>
        <span>kid</span>
      </IndentRail>,
    );
    expect(el).toBe(screen.getByTestId(IndentRailTestId.Root));
  });

  it("stack draws the spine and the per-row elbow; rail stays the default", () => {
    const { rerender } = render(
      <IndentRail>
        <span>kid</span>
      </IndentRail>,
    );
    expect(screen.getByTestId(IndentRailTestId.Root)).toHaveAttribute("data-variant", "rail");
    rerender(
      <IndentRail variant="stack">
        <span>kid</span>
      </IndentRail>,
    );
    const root = screen.getByTestId(IndentRailTestId.Root);
    expect(root).toHaveAttribute("data-variant", "stack");
    expect(root.className).toContain("[&>[data-rk]]:before:w-[9px]");
  });
});
