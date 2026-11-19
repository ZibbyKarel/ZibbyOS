import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListCard, ListCardTestId } from "./ListCard";

describe("ListCard", () => {
  it("renders children and opens via the overlay", () => {
    const onOpen = vi.fn();
    render(
      <ListCard onOpen={onOpen} openLabel="Open">
        <a href="#x">inner</a>
      </ListCard>,
    );
    expect(screen.getByText("inner")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(ListCardTestId.Open));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getByTestId(ListCardTestId.Open)).toHaveAccessibleName("Open");
  });
  it("has no open target without onOpen", () => {
    render(<ListCard>x</ListCard>);
    expect(screen.queryByTestId(ListCardTestId.Open)).toBeNull();
  });
});
