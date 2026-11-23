import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { CanvasCard, CanvasCardTestId } from "./CanvasCard";

describe("CanvasCard", () => {
  it("renders a button with an inert lazy thumbnail", () => {
    const onOpen = vi.fn();
    render(
      <CanvasCard
        note="Open on the Mac"
        onOpen={onOpen}
        src="http://c.test/a"
        title="Chart"
        version={2}
      />,
    );
    const root = screen.getByTestId(CanvasCardTestId.Root);
    expect(root).toHaveRole("button");
    fireEvent.click(root);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const frame = screen.getByTestId(CanvasCardTestId.Frame);
    expect(frame).toHaveAttribute("src", "http://c.test/a");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame).toHaveAttribute("loading", "lazy");
    expect(frame).toHaveAttribute("tabindex", "-1");
    expect(frame).toHaveAttribute("aria-hidden", "true");
    expect(frame).toHaveClass("pointer-events-none");
    expect(screen.getByTestId(CanvasCardTestId.Title)).toHaveTextContent("Chart");
    expect(screen.getByTestId(CanvasCardTestId.Version)).toHaveTextContent("v2");
    expect(screen.getByTestId(CanvasCardTestId.Note)).toHaveTextContent("Open on the Mac");
  });

  it("renders an external anchor when href is given", () => {
    render(<CanvasCard href="http://c.test/open" src="x" title="Chart" />);
    const root = screen.getByTestId(CanvasCardTestId.Root);
    expect(root).toHaveRole("link");
    expect(root).toHaveAttribute("href", "http://c.test/open");
    expect(root).toHaveAttribute("target", "_blank");
    expect(root).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByTestId(CanvasCardTestId.Note)).toBeNull();
  });

  it("pin size is a thumbnail only, named on the control", () => {
    render(<CanvasCard onOpen={() => {}} size="pin" src="x" title="Chart" version={4} />);
    const root = screen.getByTestId(CanvasCardTestId.Root);
    expect(root).toHaveAccessibleName("Chart v4");
    expect(screen.queryByTestId(CanvasCardTestId.Title)).toBeNull();
    expect(screen.getByTestId(CanvasCardTestId.Frame)).toBeInTheDocument();
  });
});
