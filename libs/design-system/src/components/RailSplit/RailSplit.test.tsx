import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RailSplit, RailSplitTestId } from "./RailSplit";

describe("RailSplit", () => {
  it("renders all four slots", () => {
    render(
      <RailSplit footer={<span>foot</span>} rail={<span>rail</span>} toolbar={<span>tool</span>}>
        <span>body</span>
      </RailSplit>,
    );
    expect(screen.getByTestId(RailSplitTestId.Rail)).toHaveTextContent("rail");
    expect(screen.getByTestId(RailSplitTestId.Toolbar)).toHaveTextContent("tool");
    expect(screen.getByTestId(RailSplitTestId.Body)).toHaveTextContent("body");
    expect(screen.getByTestId(RailSplitTestId.Footer)).toHaveTextContent("foot");
  });

  it("exposes the scrolling body through bodyRef", () => {
    const bodyRef = createRef<HTMLDivElement>();
    render(
      <RailSplit bodyRef={bodyRef} rail="r">
        b
      </RailSplit>,
    );
    expect(bodyRef.current).toBe(screen.getByTestId(RailSplitTestId.Body));
  });

  it("omits toolbar and footer nodes when not given", () => {
    render(<RailSplit rail="r">b</RailSplit>);
    expect(screen.queryByTestId(RailSplitTestId.Toolbar)).toBeNull();
    expect(screen.queryByTestId(RailSplitTestId.Footer)).toBeNull();
  });

  it("forwards ref to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <RailSplit rail="r" ref={ref}>
        b
      </RailSplit>,
    );
    expect(ref.current).toBe(screen.getByTestId(RailSplitTestId.Root));
  });

  it("stacked + railAbove puts the rail in its own row, not a side column", () => {
    render(
      <RailSplit railAbove stacked rail="r" toolbar="t">
        b
      </RailSplit>,
    );
    expect(screen.getByTestId(RailSplitTestId.Root).className).toContain("grid-cols-1");
    expect(screen.getByTestId(RailSplitTestId.Root).className).not.toContain("220px");
    expect(screen.getByTestId(RailSplitTestId.Rail).className).toContain("border-b");
  });

  it("stacked without railAbove keeps the 220px side rail", () => {
    render(
      <RailSplit stacked rail="r">
        b
      </RailSplit>,
    );
    expect(screen.getByTestId(RailSplitTestId.Root).className).toContain("220px");
  });
});
