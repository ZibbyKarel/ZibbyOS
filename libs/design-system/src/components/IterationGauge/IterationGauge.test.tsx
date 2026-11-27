import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { IterationGauge, IterationGaugeTestId } from "./IterationGauge";

describe("IterationGauge", () => {
  it("shows the used count, a named ring and the caption", () => {
    render(
      <IterationGauge
        ariaLabel="4 of 8 used"
        caption="4 left"
        label="Iterations"
        max={8}
        ofLabel="of 8"
        used={4}
      />,
    );
    expect(screen.getByTestId(IterationGaugeTestId.Used)).toHaveTextContent("4");
    expect(screen.getByTestId(IterationGaugeTestId.Svg)).toHaveRole("img");
    expect(screen.getByTestId(IterationGaugeTestId.Svg)).toHaveAccessibleName("4 of 8 used");
    expect(screen.getByTestId(IterationGaugeTestId.Caption)).toHaveTextContent("4 left");
  });

  it("turns amber from 75 % and clamps over max", () => {
    const { rerender } = render(
      <IterationGauge ariaLabel="a" label="x" max={8} ofLabel="of 8" used={5} />,
    );
    expect(screen.getByTestId(IterationGaugeTestId.Fill)).toHaveAttribute(
      "stroke",
      "var(--color-ink)",
    );
    rerender(<IterationGauge ariaLabel="a" label="x" max={8} ofLabel="of 8" used={6} />);
    expect(screen.getByTestId(IterationGaugeTestId.Fill)).toHaveAttribute(
      "stroke",
      "var(--color-warn)",
    );
    rerender(<IterationGauge ariaLabel="a" label="x" max={0} ofLabel="of 0" used={3} />);
    expect(screen.getByTestId(IterationGaugeTestId.Fill)).toHaveAttribute(
      "stroke-dasharray",
      expect.stringMatching(/^0 /),
    );
  });

  it("lets the caller decide the amber arc", () => {
    const { rerender } = render(
      <IterationGauge ariaLabel="a" hot={false} label="x" max={3} ofLabel="of 3" used={3} />,
    );
    expect(screen.getByTestId(IterationGaugeTestId.Fill)).toHaveAttribute(
      "stroke",
      "var(--color-ink)",
    );
    rerender(<IterationGauge hot ariaLabel="a" label="x" max={3} ofLabel="of 3" used={1} />);
    expect(screen.getByTestId(IterationGaugeTestId.Fill)).toHaveAttribute(
      "stroke",
      "var(--color-warn)",
    );
  });
});
