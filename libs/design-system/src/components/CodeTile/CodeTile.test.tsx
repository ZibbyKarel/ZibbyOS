import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeTile, CodeTileTestId } from "./CodeTile";

describe("CodeTile", () => {
  it("shows the code", () => {
    render(<CodeTile code="ENG" />);
    expect(screen.getByTestId(CodeTileTestId.Root)).toHaveTextContent("ENG");
  });
});
