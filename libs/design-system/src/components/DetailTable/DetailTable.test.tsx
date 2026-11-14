import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { DetailTable, DetailTableTestId } from "./DetailTable";

describe("DetailTable", () => {
  it("renders key/value rows", () => {
    render(<DetailTable rows={[{ cells: ["EPIC", "ZB-1"] }, { cells: ["TEAM", "Core"] }]} />);
    expect(screen.getAllByTestId(DetailTableTestId.Row)).toHaveLength(2);
    expect(screen.getAllByTestId(DetailTableTestId.Cell)[0]).toHaveTextContent("EPIC");
    expect(screen.getAllByTestId(DetailTableTestId.Row)[0]?.className).toContain("110px");
  });

  it("puts a state dot on check rows", () => {
    render(<DetailTable rows={[{ cells: ["lint", "PASSED"], tone: "working" }]} variant="check" />);
    expect(screen.getByTestId(DetailTableTestId.Row)).toHaveAttribute("data-tone", "working");
    expect(
      screen.getByTestId(DetailTableTestId.Row).querySelector(".bg-state-work"),
    ).not.toBeNull();
  });

  it("shows the empty note when there are no rows", () => {
    render(<DetailTable emptyText="None yet." rows={[]} />);
    expect(screen.getByTestId(DetailTableTestId.Empty)).toHaveTextContent("None yet.");
  });
});
