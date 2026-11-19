import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { LaneCell, LaneCellTestId } from "./LaneCell";

describe("LaneCell", () => {
  it("renders its chips and flags a capped lane", () => {
    const { rerender } = render(
      <LaneCell aria-label="Auto · Acme" role="group">
        <i>chip</i>
      </LaneCell>,
    );
    const cell = screen.getByTestId(LaneCellTestId.Root);
    expect(cell).toHaveAccessibleName("Auto · Acme");
    expect(cell).toHaveTextContent("chip");
    expect(cell).not.toHaveAttribute("data-capped");
    rerender(<LaneCell capped />);
    expect(screen.getByTestId(LaneCellTestId.Root)).toHaveAttribute("data-capped", "true");
  });
});
