import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SegmentedBar, SegmentedBarTestId } from "./SegmentedBar";

describe("SegmentedBar", () => {
  it("skips zero segments", () => {
    render(
      <SegmentedBar
        ariaLabel="ratio"
        segments={[
          { id: "a", value: 2, tone: "run" },
          { id: "b", value: 0, tone: "bad" },
          { id: "c", value: 5, tone: "ok" },
        ]}
      />,
    );
    expect(screen.getAllByTestId(SegmentedBarTestId.Segment)).toHaveLength(2);
    expect(screen.getByTestId(SegmentedBarTestId.Root)).toHaveAccessibleName("ratio");
  });
});
