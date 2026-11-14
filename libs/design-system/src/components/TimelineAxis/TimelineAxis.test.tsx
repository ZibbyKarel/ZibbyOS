import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { TimelineAxis, TimelineAxisTestId } from "./TimelineAxis";

describe("TimelineAxis", () => {
  it("is one labelled image with ticks and markers placed by fraction", () => {
    render(
      <TimelineAxis
        label="Next 24 hours: 2 starts"
        markers={[
          { at: 0.25, label: "03:00" },
          { at: 0.5, label: "09:00", error: true },
        ]}
        ticks={[{ at: 0.1, label: "00" }]}
      />,
    );
    const root = screen.getByTestId(TimelineAxisTestId.Root);
    expect(root).toHaveRole("img");
    expect(root).toHaveAccessibleName("Next 24 hours: 2 starts");
    expect(screen.getByTestId(TimelineAxisTestId.Now)).toBeInTheDocument();
    expect(screen.getByTestId(TimelineAxisTestId.Tick)).toHaveTextContent("00");
    const markers = screen.getAllByTestId(TimelineAxisTestId.Marker);
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveStyle({ left: "25%" });
    expect(markers[0]).toHaveAttribute("title", "03:00");
    expect(markers[1]).toHaveAttribute("data-error", "true");
  });

  it("clamps positions to the axis", () => {
    render(<TimelineAxis label="x" markers={[{ at: 2, label: "late" }]} />);
    expect(screen.getByTestId(TimelineAxisTestId.Marker)).toHaveStyle({ left: "100%" });
  });
});
