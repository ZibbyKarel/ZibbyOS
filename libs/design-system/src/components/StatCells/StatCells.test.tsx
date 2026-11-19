import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCells, StatCellsTestId } from "./StatCells";

describe("StatCells", () => {
  it("renders cells and the note", () => {
    render(
      <StatCells
        items={[
          { id: "a", label: "Agenti", value: 4 },
          { id: "b", label: "Podúkoly", value: 9, note: "1 na tebe" },
        ]}
      />,
    );
    expect(screen.getAllByTestId(StatCellsTestId.Cell)).toHaveLength(2);
    expect(screen.getByTestId(StatCellsTestId.Note)).toHaveTextContent("1 na tebe");
  });
});
