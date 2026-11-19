import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { WidgetPlaceholder, WidgetPlaceholderTestId } from "./WidgetPlaceholder";

describe("WidgetPlaceholder", () => {
  it("renders its action at the given geometry", () => {
    render(
      <WidgetPlaceholder style={{ left: 10, top: 20, width: 100, height: 50 }}>
        <button type="button">add</button>
      </WidgetPlaceholder>,
    );
    expect(screen.getByTestId(WidgetPlaceholderTestId.Root)).toHaveStyle({ width: "100px" });
    expect(screen.getByText("add")).toBeInTheDocument();
  });
});
