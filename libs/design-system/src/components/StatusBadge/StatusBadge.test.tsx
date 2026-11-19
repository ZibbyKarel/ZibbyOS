import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge, StatusBadgeTestId } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the label with its tone", () => {
    render(<StatusBadge tone="wait">Waits for you</StatusBadge>);
    const badge = screen.getByTestId(StatusBadgeTestId.Root);
    expect(badge).toHaveTextContent("Waits for you");
    expect(badge).toHaveAttribute("data-tone", "wait");
  });
});
