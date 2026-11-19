import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { LaneCell, LaneCellTestId } from "./LaneCell";

describe("LaneCell", () => {
  it("shows the empty text only without children and forwards drop handlers", () => {
    const onDrop = vi.fn();
    const { rerender } = render(<LaneCell capped empty="Nothing" onDrop={onDrop} />);
    const cell = screen.getByTestId(LaneCellTestId.Root);
    expect(cell).toHaveAttribute("data-capped", "true");
    expect(screen.getByTestId(LaneCellTestId.Empty)).toHaveTextContent("Nothing");
    fireEvent.drop(cell);
    expect(onDrop).toHaveBeenCalledTimes(1);
    rerender(
      <LaneCell dropTarget empty="Nothing">
        <i>chip</i>
      </LaneCell>,
    );
    expect(screen.queryByTestId(LaneCellTestId.Empty)).toBeNull();
    expect(screen.getByTestId(LaneCellTestId.Root)).toHaveAttribute("data-drop-target", "true");
  });
});
