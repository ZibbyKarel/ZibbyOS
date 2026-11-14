import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { PageTitle, PageTitleTestId } from "./PageTitle";

describe("PageTitle", () => {
  it("renders an h1 in the title-l step", () => {
    render(<PageTitle>Bridge</PageTitle>);
    const root = screen.getByTestId(PageTitleTestId.Root);
    expect(root).toHaveRole("heading");
    expect(root).toHaveAccessibleName("Bridge");
    expect(root).toHaveClass("text-title-l");
  });
});
