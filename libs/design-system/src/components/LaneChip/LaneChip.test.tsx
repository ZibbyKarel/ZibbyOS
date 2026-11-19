import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { LaneChip, LaneChipTestId } from "./LaneChip";

describe("LaneChip", () => {
  it("is a toggle button exposing its state and the own-override dot", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <LaneChip own pressed onClick={onClick} tone="auto">
        Review
      </LaneChip>,
    );
    const chip = screen.getByTestId(LaneChipTestId.Root);
    expect(chip).toHaveRole("button");
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveTextContent("Review");
    expect(screen.getByTestId(LaneChipTestId.Own)).toBeInTheDocument();
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <LaneChip pressed={false} tone="auto">
        Review
      </LaneChip>,
    );
    expect(screen.getByTestId(LaneChipTestId.Root)).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId(LaneChipTestId.Own)).toBeNull();
  });
});
