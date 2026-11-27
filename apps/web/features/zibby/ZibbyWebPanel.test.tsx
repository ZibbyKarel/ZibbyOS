import { fireEvent, renderWithProviders as render, screen } from "../../test/render";
import { describe, expect, it, vi } from "vitest";
import type { DesktopWebBridge, DesktopWebState } from "../web/desktopWeb";
import { ZibbyWebPanel, ZibbyWebPanelTestId } from "./ZibbyWebPanel";

function makeBridge() {
  let push: (s: DesktopWebState) => void = () => undefined;
  const bridge = {
    open: vi.fn(),
    setBounds: vi.fn(),
    hide: vi.fn(),
    back: vi.fn(),
    reload: vi.fn(),
    go: vi.fn(),
    openExternal: vi.fn(),
    onState: vi.fn((cb: (s: DesktopWebState) => void) => {
      push = cb;
      return () => undefined;
    }),
  } satisfies DesktopWebBridge;
  return { bridge, push: (s: DesktopWebState) => push(s) };
}

const props = (bridge: DesktopWebBridge) => ({
  page: { url: "https://example.com/" },
  desktop: bridge,
  full: false,
  onToggleFull: vi.fn(),
  onClose: vi.fn(),
});

describe("ZibbyWebPanel", () => {
  it("opens the page, and hides the view when the slot unmounts", () => {
    const { bridge } = makeBridge();
    const { unmount } = render(<ZibbyWebPanel {...props(bridge)} />);
    expect(bridge.open).toHaveBeenCalledWith("https://example.com/");
    unmount();
    expect(bridge.hide).toHaveBeenCalled();
  });

  it("enter in the address field navigates, normalising bare domains; junk is refused", () => {
    const { bridge } = makeBridge();
    render(<ZibbyWebPanel {...props(bridge)} />);
    const input = screen.getByTestId(ZibbyWebPanelTestId.Address);
    fireEvent.change(input, { target: { value: "example.org/x" } });
    fireEvent.submit(input);
    expect(bridge.go).toHaveBeenCalledWith("https://example.org/x");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.submit(input);
    expect(bridge.go).toHaveBeenCalledTimes(1);
  });

  it("back follows canGoBack from the pushed state; reload and external call the bridge", () => {
    const { bridge, push } = makeBridge();
    render(<ZibbyWebPanel {...props(bridge)} />);
    expect(screen.getByTestId(ZibbyWebPanelTestId.Back)).toBeDisabled();
    push({ url: "https://example.com/b", title: "B", canGoBack: true, loading: false });
    // state arrives outside act in this helper; flush through a click-free re-query
    return vi.waitFor(() => {
      const back = screen.getByTestId(ZibbyWebPanelTestId.Back);
      expect(back).toBeEnabled();
      fireEvent.click(back);
      fireEvent.click(screen.getByTestId(ZibbyWebPanelTestId.Reload));
      fireEvent.click(screen.getByTestId(ZibbyWebPanelTestId.OpenExternal));
      expect(bridge.back).toHaveBeenCalled();
      expect(bridge.reload).toHaveBeenCalled();
      expect(bridge.openExternal).toHaveBeenCalled();
    });
  });
});
