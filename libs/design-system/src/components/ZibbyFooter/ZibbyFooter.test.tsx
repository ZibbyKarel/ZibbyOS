import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyFooter, ZibbyFooterTestId } from "./ZibbyFooter";

describe("ZibbyFooter", () => {
  it("renders start and end slots", () => {
    render(<ZibbyFooter end="Esc zavře" start="Hlas zapnutý" />);
    expect(screen.getByTestId(ZibbyFooterTestId.Root)).toHaveClass("flex-wrap");
    expect(screen.getByTestId(ZibbyFooterTestId.Start)).toHaveTextContent("Hlas zapnutý");
    expect(screen.getByTestId(ZibbyFooterTestId.End)).toHaveTextContent("Esc zavře");
  });
  it("omits empty slots", () => {
    render(<ZibbyFooter />);
    expect(screen.queryByTestId(ZibbyFooterTestId.Start)).toBeNull();
    expect(screen.queryByTestId(ZibbyFooterTestId.End)).toBeNull();
  });
});
