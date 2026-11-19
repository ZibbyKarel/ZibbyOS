import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadioMatrix, RadioMatrixTestId } from "./RadioMatrix";

const columns = [
  { id: "visible", label: "Visible" },
  { id: "grouped", label: "Grouped" },
  { id: "hidden", label: "Hidden" },
];
const rows = [
  { id: "tasks", label: "Tasks", hint: "Created, started, done", value: "visible" },
  { id: "runs", label: "Runs", value: "grouped" },
];

describe("RadioMatrix", () => {
  it("checks the selected cell of each row", () => {
    render(
      <RadioMatrix
        ariaLabel="Live log"
        columns={columns}
        onChange={vi.fn()}
        rowHeader="Group"
        rows={rows}
      />,
    );
    expect(screen.getAllByTestId(RadioMatrixTestId.Row)).toHaveLength(2);
    expect(screen.getByTestId(`${RadioMatrixTestId.Cell}-tasks-visible`)).toBeChecked();
    expect(screen.getByTestId(`${RadioMatrixTestId.Cell}-runs-grouped`)).toBeChecked();
    expect(screen.getByTestId(`${RadioMatrixTestId.Cell}-runs-hidden`)).not.toBeChecked();
  });

  it("reports the picked cell and honours disabled", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RadioMatrix
        ariaLabel="Live log"
        columns={columns}
        onChange={onChange}
        rowHeader="Group"
        rows={rows}
      />,
    );
    fireEvent.click(screen.getByTestId(`${RadioMatrixTestId.Cell}-tasks-hidden`));
    expect(onChange).toHaveBeenCalledWith("tasks", "hidden");
    rerender(
      <RadioMatrix
        disabled
        ariaLabel="Live log"
        columns={columns}
        onChange={onChange}
        rowHeader="Group"
        rows={rows}
      />,
    );
    expect(screen.getByTestId(`${RadioMatrixTestId.Cell}-tasks-hidden`)).toBeDisabled();
  });
});
