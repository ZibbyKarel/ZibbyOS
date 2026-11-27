import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SegmentedRing, SegmentedRingTestId } from "./SegmentedRing";

describe("SegmentedRing", () => {
  it("draws one segment per budgeted iteration and fills the used ones", () => {
    render(<SegmentedRing ariaLabel="7 of 12" caption="of 12" max={12} tone="working" used={7} />);
    const segs = screen.getAllByTestId(SegmentedRingTestId.Segment);
    expect(segs).toHaveLength(12);
    expect(segs.filter((s) => s.getAttribute("data-filled") === "true")).toHaveLength(7);
    expect(screen.getByTestId(SegmentedRingTestId.Used)).toHaveTextContent("7");
    expect(screen.getByRole("img")).toHaveAccessibleName("7 of 12");
  });

  it("clamps used to the budget", () => {
    render(<SegmentedRing ariaLabel="x" caption="c" max={3} tone="done" used={9} />);
    const segs = screen.getAllByTestId(SegmentedRingTestId.Segment);
    expect(segs.every((s) => s.getAttribute("data-filled") === "true")).toBe(true);
  });

  it("shows a value override instead of the used count, and no caption when omitted", () => {
    render(<SegmentedRing ariaLabel="not run yet" max={1} tone="idle" used={0} value="–" />);
    expect(screen.getByTestId(SegmentedRingTestId.Used)).toHaveTextContent("–");
    expect(screen.getByTestId(SegmentedRingTestId.Caption)).toHaveTextContent(/^–$/);
  });
});
