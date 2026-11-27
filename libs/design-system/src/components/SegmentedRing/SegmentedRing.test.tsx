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

  it("marks segment `used` as the pulsing current one while working or blocked", () => {
    const { rerender } = render(
      <SegmentedRing ariaLabel="0 of 3" max={3} tone="working" used={0} />,
    );
    const current = () =>
      screen.getAllByTestId(SegmentedRingTestId.Segment).map((s) => s.getAttribute("data-current"));
    expect(current()).toEqual(["true", "false", "false"]);
    rerender(<SegmentedRing ariaLabel="1 of 3" max={3} tone="blocked" used={1} />);
    expect(current()).toEqual(["false", "true", "false"]);
    rerender(<SegmentedRing ariaLabel="3 of 3" max={3} tone="working" used={3} />);
    expect(current()).toEqual(["false", "false", "false"]);
  });

  it("draws the current segment lighter than a done one", () => {
    render(<SegmentedRing ariaLabel="1 of 3" max={3} tone="working" used={1} />);
    const segs = screen.getAllByTestId(SegmentedRingTestId.Segment);
    expect(segs[0]).not.toHaveAttribute("stroke-opacity");
    expect(segs[1]).toHaveAttribute("stroke-opacity", "0.45");
    expect(segs[2]).not.toHaveAttribute("stroke-opacity");
  });

  it("has no current segment for a resting tone", () => {
    render(<SegmentedRing ariaLabel="0 of 2" max={2} tone="thinking" used={0} />);
    const segs = screen.getAllByTestId(SegmentedRingTestId.Segment);
    expect(segs.every((s) => s.getAttribute("data-current") === "false")).toBe(true);
    expect(screen.getByTestId(SegmentedRingTestId.Graphic)).toHaveRole("img");
    expect(screen.getByTestId(SegmentedRingTestId.Graphic)).toHaveAccessibleName("0 of 2");
  });
});
