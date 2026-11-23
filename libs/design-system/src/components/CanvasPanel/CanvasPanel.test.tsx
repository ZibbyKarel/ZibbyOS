import { fireEvent, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { CanvasPanel, CanvasPanelTestId } from "./CanvasPanel";

describe("CanvasPanel", () => {
  it("is a region labelled by its title with version and status", () => {
    render(<CanvasPanel src="http://c.test/" status="ready" title="Roadmap" version={3} />);
    const root = screen.getByTestId(CanvasPanelTestId.Root);
    expect(root).toHaveRole("region");
    expect(root).toHaveAccessibleName("Roadmap");
    expect(screen.getByTestId(CanvasPanelTestId.Version)).toHaveTextContent("v3");
    expect(screen.getByTestId(CanvasPanelTestId.Status)).toHaveTextContent("Ready");
    expect(screen.queryByTestId(CanvasPanelTestId.Errors)).toBeNull();
    expect(screen.queryByTestId(CanvasPanelTestId.Overlay)).toBeNull();
  });

  it("wires the iframe from props (ref-as-prop, dark scheme)", () => {
    const ref = createRef<HTMLIFrameElement>();
    render(
      <CanvasPanel
        allow="clipboard-read"
        frameRef={ref}
        frameTitle="Canvas frame"
        sandbox="allow-scripts"
        src="http://c.test/a"
        title="T"
      />,
    );
    const frame = screen.getByTestId(CanvasPanelTestId.Frame);
    expect(ref.current).toBe(frame);
    expect(frame).toHaveAttribute("src", "http://c.test/a");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame).toHaveAttribute("allow", "clipboard-read");
    expect(frame).toHaveAccessibleName("Canvas frame");
    expect(frame).toHaveStyle({ colorScheme: "dark" });
  });

  it("labels and fires every action; Full flips to Back", () => {
    const h = { r: vi.fn(), o: vi.fn(), f: vi.fn(), c: vi.fn(), e: vi.fn() };
    const { rerender } = render(
      <CanvasPanel
        errorCount={2}
        onClose={h.c}
        onErrorsClick={h.e}
        onOpenExternal={h.o}
        onReload={h.r}
        onToggleFull={h.f}
        src="x"
        title="T"
      />,
    );
    const errors = screen.getByTestId(CanvasPanelTestId.Errors);
    expect(errors).toHaveRole("button");
    expect(errors).toHaveAccessibleName("2 errors");
    fireEvent.click(errors);
    const reload = screen.getByTestId(CanvasPanelTestId.Reload);
    expect(reload).toHaveAccessibleName("Reload");
    fireEvent.click(reload);
    const open = screen.getByTestId(CanvasPanelTestId.OpenExternal);
    expect(open).toHaveAccessibleName("Open in browser");
    fireEvent.click(open);
    expect(screen.getByTestId(CanvasPanelTestId.Expand)).toHaveAccessibleName("Full screen");
    fireEvent.click(screen.getByTestId(CanvasPanelTestId.Expand));
    const close = screen.getByTestId(CanvasPanelTestId.Close);
    expect(close).toHaveAccessibleName("Close");
    fireEvent.click(close);
    expect(h.r).toHaveBeenCalledTimes(1);
    expect(h.o).toHaveBeenCalledTimes(1);
    expect(h.f).toHaveBeenCalledTimes(1);
    expect(h.c).toHaveBeenCalledTimes(1);
    expect(h.e).toHaveBeenCalledTimes(1);
    rerender(<CanvasPanel full backLabel="Zpět" src="x" title="T" />);
    expect(screen.getByTestId(CanvasPanelTestId.Expand)).toHaveAccessibleName("Zpět");
  });

  it("shows an overlay with message and actions on error and unresponsive", () => {
    const { rerender } = render(
      <CanvasPanel
        actions={<button type="button">Fix it</button>}
        message="Boom"
        src="x"
        status="error"
        title="T"
      />,
    );
    const overlay = screen.getByTestId(CanvasPanelTestId.Overlay);
    expect(overlay).toHaveRole("alert");
    expect(overlay).toHaveTextContent("Boom");
    within(screen.getByTestId(CanvasPanelTestId.OverlayActions)).getByRole("button", {
      name: "Fix it",
    });
    rerender(<CanvasPanel message="Stuck" src="x" status="unresponsive" title="T" />);
    expect(screen.getByTestId(CanvasPanelTestId.Overlay)).toHaveRole("status");
    expect(screen.getByTestId(CanvasPanelTestId.Status)).toHaveTextContent("Not responding");
  });
});
