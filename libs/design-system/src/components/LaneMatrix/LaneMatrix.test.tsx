import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { LaneHead, LaneMatrix, LaneMatrixTestId } from "./LaneMatrix";

describe("LaneMatrix", () => {
  const columns = [
    { key: "a", header: <LaneHead meaning="Never starts" title="Manual" /> },
    { key: "b", header: <LaneHead note="Now as Semi" title="Auto" tone="auto" /> },
  ];

  it("renders column heads, row heads and one cell per column", () => {
    render(
      <LaneMatrix
        columns={columns}
        rowHeader="Company"
        rows={[
          { key: "x", header: "Acme", cells: ["one", "two"] },
          { key: "y", header: "Team", nested: true, cells: ["three", "four"] },
        ]}
      />,
    );
    expect(screen.getByTestId(`${LaneMatrixTestId.Head}-a`)).toHaveTextContent("Never starts");
    expect(screen.getByTestId(`${LaneMatrixTestId.LaneNote}`)).toHaveTextContent("Now as Semi");
    expect(screen.getByTestId(`${LaneMatrixTestId.RowHead}-x`)).toHaveTextContent("Acme");
    expect(screen.getByTestId(`${LaneMatrixTestId.Cell}-y-b`)).toHaveTextContent("four");
  });

  it("draws a tree connector only for nested rows", () => {
    render(
      <LaneMatrix
        columns={columns}
        rowHeader="Company"
        rows={[
          { key: "x", header: "Acme", cells: ["", ""] },
          { key: "y", header: "Team", nested: true, cells: ["", ""] },
        ]}
      />,
    );
    expect(screen.getAllByTestId(LaneMatrixTestId.Connector)).toHaveLength(1);
  });
});
