import { fireEvent, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { CanvasPanel, CanvasPanelTestId, type CanvasPanelVersion } from "./CanvasPanel";
import { MenuButtonTestId } from "../MenuButton/MenuButton";

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

  it("wires the iframe from props (ref-as-prop, colorScheme)", () => {
    const ref = createRef<HTMLIFrameElement>();
    render(
      <CanvasPanel
        allow="clipboard-read"
        colorScheme="light"
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
    expect(frame).toHaveStyle({ colorScheme: "light" });
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

  describe("phase 2", () => {
    const versions: CanvasPanelVersion[] = [
      { key: "a", label: "v2", at: "10:00", current: false },
      { key: "b", label: "v2.1", at: "11:00", note: "tweak", current: true },
    ];

    it("lists versions in a menu and views the picked one", () => {
      const onView = vi.fn();
      render(
        <CanvasPanel onViewVersion={onView} src="x" title="T" versions={versions} viewingKey="b" />,
      );
      const trigger = screen.getByTestId(CanvasPanelTestId.Versions);
      expect(trigger).toHaveTextContent("v2.1");
      expect(screen.queryByTestId(CanvasPanelTestId.ViewingStrip)).toBeNull();
      fireEvent.click(trigger);
      expect(screen.getByTestId(`${MenuButtonTestId.Item}-b`)).toHaveTextContent("11:00 · tweak");
      fireEvent.click(screen.getByTestId(`${MenuButtonTestId.Item}-a`));
      expect(onView).toHaveBeenCalledWith("a");
    });

    it("shows a Restore strip when viewing an old version", () => {
      const onView = vi.fn();
      const onRestore = vi.fn();
      render(
        <CanvasPanel
          onRestoreVersion={onRestore}
          onViewVersion={onView}
          src="x"
          title="T"
          versions={versions}
          viewingKey="a"
        />,
      );
      expect(screen.getByTestId(CanvasPanelTestId.Versions)).toHaveTextContent("v2");
      expect(screen.getByTestId(CanvasPanelTestId.ViewingText)).toHaveTextContent("Viewing v2");
      fireEvent.click(screen.getByTestId(CanvasPanelTestId.Restore));
      expect(onRestore).toHaveBeenCalledWith("a");
      fireEvent.click(screen.getByTestId(CanvasPanelTestId.BackToCurrent));
      expect(onView).toHaveBeenCalledWith("b");
    });

    it("renders a banner with full multi-line body and fires confirm/dismiss", () => {
      const onConfirm = vi.fn();
      const onDismiss = vi.fn();
      render(
        <CanvasPanel
          banner={{
            title: "Proposal",
            body: "line1\nline2",
            confirmLabel: "Apply",
            onConfirm,
            onDismiss,
          }}
          src="x"
          title="T"
        />,
      );
      expect(screen.getByTestId(CanvasPanelTestId.BannerTitle)).toHaveTextContent("Proposal");
      const body = screen.getByTestId(CanvasPanelTestId.BannerBody);
      expect(body.textContent).toBe("line1\nline2");
      expect(body).toHaveClass("whitespace-pre-wrap", "overflow-y-auto");
      fireEvent.click(screen.getByTestId(CanvasPanelTestId.BannerConfirm));
      expect(screen.getByTestId(CanvasPanelTestId.BannerConfirm)).toHaveTextContent("Apply");
      expect(screen.getByTestId(CanvasPanelTestId.BannerDismiss)).toHaveTextContent("Dismiss");
      fireEvent.click(screen.getByTestId(CanvasPanelTestId.BannerDismiss));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("constrains the frame width and only shows the control with a callback", () => {
      const onChange = vi.fn();
      const { rerender } = render(<CanvasPanel previewWidth="phone" src="x" title="T" />);
      expect(screen.queryByTestId(CanvasPanelTestId.PreviewWidth)).toBeNull();
      expect(screen.getByTestId(CanvasPanelTestId.FrameWrap)).toHaveClass("max-w-[390px]");
      rerender(
        <CanvasPanel onPreviewWidthChange={onChange} previewWidth="tablet" src="x" title="T" />,
      );
      expect(screen.getByTestId(CanvasPanelTestId.FrameWrap)).toHaveClass("max-w-[820px]");
      fireEvent.click(screen.getByRole("radio", { name: "Phone" }));
      expect(onChange).toHaveBeenCalledWith("phone");
      rerender(<CanvasPanel previewWidth="full" src="x" title="T" />);
      expect(screen.getByTestId(CanvasPanelTestId.FrameWrap)).toHaveClass("max-w-none");
    });

    it("shows Fix it only with errors and a handler; Export fires", () => {
      const onFix = vi.fn();
      const onExport = vi.fn();
      const { rerender } = render(
        <CanvasPanel errorCount={0} onFixErrors={onFix} src="x" title="T" />,
      );
      expect(screen.queryByTestId(CanvasPanelTestId.FixErrors)).toBeNull();
      rerender(
        <CanvasPanel errorCount={1} onExport={onExport} onFixErrors={onFix} src="x" title="T" />,
      );
      fireEvent.click(screen.getByTestId(CanvasPanelTestId.FixErrors));
      expect(onFix).toHaveBeenCalledTimes(1);
      const exp = screen.getByTestId(CanvasPanelTestId.Export);
      expect(exp).toHaveAccessibleName("Export HTML");
      fireEvent.click(exp);
      expect(onExport).toHaveBeenCalledTimes(1);
    });
  });
});
