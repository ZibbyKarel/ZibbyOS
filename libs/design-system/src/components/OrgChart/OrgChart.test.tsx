import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrgChart, OrgChartTestId } from "./OrgChart";

describe("OrgChart", () => {
  it("renders root and children", () => {
    render(<OrgChart root="ZibbyCorp">kids</OrgChart>);
    expect(screen.getByTestId(OrgChartTestId.Node)).toHaveTextContent("ZibbyCorp");
    expect(screen.getByText("kids")).toBeInTheDocument();
  });
});
