import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InspectorSection, InspectorSectionTestId } from "./InspectorSection";

describe("InspectorSection", () => {
  it("is collapsed by default and toggles its body", async () => {
    render(
      <InspectorSection summary="2 files" title="Files">
        body
      </InspectorSection>,
    );
    const header = screen.getByTestId(InspectorSectionTestId.Header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId(InspectorSectionTestId.Body)).toBeNull();
    expect(screen.getByTestId(InspectorSectionTestId.Summary)).toHaveTextContent("2 files");
    await userEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId(InspectorSectionTestId.Body)).toHaveTextContent("body");
  });

  it("supports defaultOpen and controlled mode", async () => {
    const onOpenChange = vi.fn();
    render(
      <InspectorSection open onOpenChange={onOpenChange} title="Who">
        x
      </InspectorSection>,
    );
    expect(screen.getByTestId(InspectorSectionTestId.Body)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(InspectorSectionTestId.Header));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // controlled: stays open until the parent says otherwise
    expect(screen.getByTestId(InspectorSectionTestId.Body)).toBeInTheDocument();
  });

  it("shows an ordinal and hides the summary while open when asked", async () => {
    render(
      <InspectorSection hideSummaryWhenOpen index={3} summary="1 in" title="Files">
        body
      </InspectorSection>,
    );
    expect(screen.getByTestId(InspectorSectionTestId.Index)).toHaveTextContent("3");
    expect(screen.getByTestId(InspectorSectionTestId.Summary)).toHaveTextContent("1 in");
    await userEvent.click(screen.getByTestId(InspectorSectionTestId.Header));
    expect(screen.queryByTestId(InspectorSectionTestId.Summary)).toBeNull();
  });
});
