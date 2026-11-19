import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetBars, BudgetBarsTestId } from "./BudgetBars";

describe("BudgetBars", () => {
  it("renders one bar per item, clamped fill", () => {
    render(
      <BudgetBars
        items={[
          { id: "d", label: "Den", pct: 108 },
          { id: "w", label: "Týden", pct: 40, detail: "4/10" },
        ]}
      />,
    );
    expect(screen.getAllByTestId(BudgetBarsTestId.Item)).toHaveLength(2);
    expect(screen.getAllByTestId(BudgetBarsTestId.Fill)[0]).toHaveStyle({ width: "100%" });
  });
});
