import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyAttachmentRow, ZibbyAttachmentRowTestId } from "./ZibbyAttachmentRow";

describe("ZibbyAttachmentRow", () => {
  it("aligns to start by default and to end on request", () => {
    const { rerender } = render(<ZibbyAttachmentRow>a</ZibbyAttachmentRow>);
    const el = screen.getByTestId(ZibbyAttachmentRowTestId.Root);
    expect(el).toHaveClass("flex-wrap");
    expect(el).not.toHaveClass("justify-end");
    rerender(<ZibbyAttachmentRow align="end">a</ZibbyAttachmentRow>);
    expect(screen.getByTestId(ZibbyAttachmentRowTestId.Root)).toHaveClass("justify-end");
  });
  it("is a labelled group when label is given", () => {
    render(<ZibbyAttachmentRow label="Přílohy">a</ZibbyAttachmentRow>);
    const el = screen.getByTestId(ZibbyAttachmentRowTestId.Root);
    expect(el).toHaveRole("group");
    expect(el).toHaveAccessibleName("Přílohy");
  });
});
