import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SparklineTestId } from "../Sparkline/Sparkline";
import { KpiTile, KpiTileTestId } from "./KpiTile";

describe("KpiTile", () => {
  it("renders label, value and unit", () => {
    render(<KpiTile label="Success rate" unit="%" value="86" />);
    expect(screen.getByTestId(KpiTileTestId.Label)).toHaveTextContent("Success rate");
    expect(screen.getByTestId(KpiTileTestId.Value)).toHaveTextContent("86%");
    expect(screen.getByTestId(KpiTileTestId.Unit)).toHaveTextContent("%");
  });

  it("draws a sparkline only when the trend has at least two points", () => {
    const { rerender } = render(<KpiTile label="Runs" trend={[1]} value="1" />);
    expect(screen.queryByTestId(KpiTileTestId.Trend)).toBeNull();
    rerender(<KpiTile label="Runs" trend={[1, 3, 2]} value="3" />);
    expect(screen.getByTestId(KpiTileTestId.Trend)).toBeInTheDocument();
    expect(screen.getByTestId(SparklineTestId.Line)).toBeInTheDocument();
  });
});
