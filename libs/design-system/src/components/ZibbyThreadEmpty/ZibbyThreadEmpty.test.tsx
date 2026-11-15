import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyThreadEmpty, ZibbyThreadEmptyTestId } from "./ZibbyThreadEmpty";

describe("ZibbyThreadEmpty", () => {
  it("renders the hint centred", () => {
    render(<ZibbyThreadEmpty>Drž mezerník a mluv</ZibbyThreadEmpty>);
    const el = screen.getByTestId(ZibbyThreadEmptyTestId.Root);
    expect(el).toHaveTextContent("Drž mezerník a mluv");
    expect(el).toHaveClass("m-auto", "text-center");
  });
});
