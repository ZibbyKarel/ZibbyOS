import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SemiGauge, SemiGaugeTestId } from "./SemiGauge";

describe("SemiGauge", () => {
  it("shows the value, caption and aria value", () => {
    render(<SemiGauge ariaLabel="Budget" caption="dnes $1 z $2" pct={31} />);
    expect(screen.getByTestId(SemiGaugeTestId.Value)).toHaveTextContent("31 %");
    expect(screen.getByTestId(SemiGaugeTestId.Caption)).toHaveTextContent("dnes $1 z $2");
    expect(screen.getByTestId(SemiGaugeTestId.Root)).toHaveAttribute("aria-valuenow", "31");
  });
  it("tints the arc warn from 80 %", () => {
    render(<SemiGauge ariaLabel="Budget" pct={86} />);
    expect(screen.getByTestId(SemiGaugeTestId.Arc)).toHaveAttribute("stroke", "var(--color-warn)");
  });
});
