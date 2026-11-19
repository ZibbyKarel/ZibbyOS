import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListToolbar, ListToolbarTestId } from "./ListToolbar";

describe("ListToolbar", () => {
  it("renders chips with counts and reports a change", () => {
    const onChipChange = vi.fn();
    render(
      <ListToolbar
        activeChip="all"
        chips={[
          { id: "all", label: "All", count: 3 },
          { id: "run", label: "Running", count: 1 },
        ]}
        onChipChange={onChipChange}
      />,
    );
    expect(screen.getAllByTestId(ListToolbarTestId.Chip)).toHaveLength(2);
    expect(screen.getAllByTestId(ListToolbarTestId.Count)[0]).toHaveTextContent("3");
    fireEvent.click(screen.getByText("Running"));
    expect(onChipChange).toHaveBeenCalledWith("run");
  });

  it("renders the search box only when asked", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ListToolbar />);
    expect(screen.queryByTestId(ListToolbarTestId.Search)).toBeNull();
    rerender(<ListToolbar search={{ value: "", onChange, placeholder: "Search" }} />);
    expect(screen.getByTestId(ListToolbarTestId.Search)).toBeInTheDocument();
  });
});
