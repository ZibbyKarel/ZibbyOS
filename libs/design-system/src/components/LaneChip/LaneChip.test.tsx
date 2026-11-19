import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { LaneChip, LaneChipTestId } from "./LaneChip";

describe("LaneChip", () => {
  it("is a button, marks own overrides and shows the hint", () => {
    render(
      <LaneChip draggable own hint={<i>!</i>} tone="auto">
        Review
      </LaneChip>,
    );
    const chip = screen.getByTestId(LaneChipTestId.Root);
    expect(chip).toHaveRole("button");
    expect(chip).toHaveAttribute("draggable", "true");
    expect(chip).toHaveTextContent("Review");
    expect(screen.getByTestId(LaneChipTestId.Own)).toBeInTheDocument();
    expect(screen.getByTestId(LaneChipTestId.Hint)).toHaveTextContent("!");
  });

  it("has no own dot when inherited", () => {
    render(<LaneChip inherited>Review</LaneChip>);
    expect(screen.queryByTestId(LaneChipTestId.Own)).toBeNull();
  });

  it("shows the drag grip only when editable", () => {
    const { rerender } = render(<LaneChip>Review</LaneChip>);
    expect(screen.getByTestId(LaneChipTestId.Grip)).toBeInTheDocument();
    rerender(<LaneChip locked>Review</LaneChip>);
    expect(screen.queryByTestId(LaneChipTestId.Grip)).toBeNull();
  });
});
