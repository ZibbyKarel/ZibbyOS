import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListEmptyRow, ListEmptyRowTestId } from "./ListEmptyRow";

describe("ListEmptyRow", () => {
  it("shows the text", () => {
    render(<ListEmptyRow text="Prázdná kategorie" />);
    expect(screen.getByTestId(ListEmptyRowTestId.Root)).toHaveTextContent("Prázdná kategorie");
  });
});
