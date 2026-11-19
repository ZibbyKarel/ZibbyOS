import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetGauge, BudgetGaugeTestId } from "./BudgetGauge";

describe("BudgetGauge", () => {
  it("shows the rounded percent, the figure and one row per usage line", () => {
    render(
      <BudgetGauge
        caption="Budget · November"
        of="/ $2 000"
        pct={61.8}
        rows={[{ label: "Runs", value: "318 / 500", pct: 63 }]}
        value="$1 240"
      />,
    );
    expect(screen.getByTestId(BudgetGaugeTestId.Percent)).toHaveTextContent("62%");
    expect(screen.getByTestId(BudgetGaugeTestId.Value)).toHaveTextContent("$1 240/ $2 000");
    expect(screen.getAllByTestId(BudgetGaugeTestId.Row)).toHaveLength(1);
  });
});
