import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { Meter, MeterTestId } from "./Meter";

describe("Meter", () => {
  it("renders label, value and a progressbar named after the label", () => {
    render(<Meter label="5 h limit" pct={40} value="40 %" />);
    expect(screen.getByTestId(MeterTestId.Label)).toHaveTextContent("5 h limit");
    expect(screen.getByTestId(MeterTestId.Value)).toHaveTextContent("40 %");
    const bar = screen.getByTestId(MeterTestId.Bar);
    expect(bar).toHaveRole("progressbar");
    expect(bar).toHaveAccessibleName("5 h limit");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
  });

  it("clamps the fill", () => {
    render(<Meter label="x" pct={140} value="140 %" />);
    expect(screen.getByTestId(MeterTestId.Bar)).toHaveAttribute("aria-valuenow", "100");
  });

  it("has no bar without pct, and shows a note", () => {
    render(<Meter label="x" note="runs out in 2 h" tone="hot" value="9" />);
    expect(screen.queryByTestId(MeterTestId.Bar)).toBeNull();
    expect(screen.getByTestId(MeterTestId.Note)).toHaveTextContent("runs out in 2 h");
  });
});
