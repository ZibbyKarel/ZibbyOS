import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import {
  ZIBBY_OVERLAY_AUTOFOCUS_ATTR,
  ZibbyOverlay,
  type ZibbyOverlayPhase,
  type ZibbyOverlayProps,
  ZibbyOverlayTestId,
} from "./ZibbyOverlay";

function base(over: Partial<ZibbyOverlayProps> = {}): ZibbyOverlayProps {
  return {
    open: true,
    onOpenChange: () => {},
    orb: <div>orb</div>,
    label: "Zibby",
    thread: <div>thread</div>,
    composer: <input aria-label="Message" />,
    ...over,
  };
}

function setMatchMedia(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("ZibbyOverlay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("goes summoning -> open -> leaving -> closed and unmounts", () => {
    const phases: ZibbyOverlayPhase[] = [];
    const props = base({ onPhaseChange: (p) => phases.push(p), origin: { x: 30, y: 20 } });
    const { rerender } = render(<ZibbyOverlay {...props} open={false} />);
    expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).toBeNull();
    rerender(<ZibbyOverlay {...props} open />);
    expect(phases).toEqual(["summoning"]);
    expect(screen.getByTestId(ZibbyOverlayTestId.Root)).toBeInTheDocument();
    advance(849);
    expect(phases).toEqual(["summoning"]);
    advance(1);
    expect(phases).toEqual(["summoning", "open"]);
    expect(screen.getByTestId(ZibbyOverlayTestId.Shock)).toBeInTheDocument();
    rerender(<ZibbyOverlay {...props} open={false} />);
    expect(phases.at(-1)).toBe("leaving");
    expect(screen.getByTestId(ZibbyOverlayTestId.Root)).toBeInTheDocument();
    advance(500);
    expect(phases).toEqual(["summoning", "open", "leaving", "closed"]);
    expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).toBeNull();
  });

  it("survives rapid toggling without stuck timers", () => {
    const props = base({ origin: { x: 30, y: 20 } });
    const { rerender } = render(<ZibbyOverlay {...props} open />);
    advance(300);
    rerender(<ZibbyOverlay {...props} open={false} />);
    advance(100);
    rerender(<ZibbyOverlay {...props} open />);
    advance(850);
    expect(screen.getByTestId(ZibbyOverlayTestId.Column)).toHaveClass("opacity-100");
    rerender(<ZibbyOverlay {...props} open={false} />);
    advance(500);
    expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).toBeNull();
  });

  it("exposes dialog semantics and flight vars derived from origin", () => {
    render(<ZibbyOverlay {...base({ origin: { x: 100, y: 50 } })} />);
    const root = screen.getByTestId(ZibbyOverlayTestId.Root);
    expect(root).toHaveRole("dialog");
    expect(root).toHaveAccessibleName("Zibby");
    expect(root).toHaveAttribute("aria-modal", "true");
    const cy = Number.parseInt(root.style.getPropertyValue("--zo-cy"), 10);
    expect(root.style.getPropertyValue("--zo-dx")).toBe(`${100 - window.innerWidth / 2}px`);
    expect(root.style.getPropertyValue("--zo-dy")).toBe(`${50 - cy}px`);
    expect(screen.getByTestId(ZibbyOverlayTestId.Flyer)).toBeInTheDocument();
  });

  it("Esc closes the history first, then the overlay; ignores handled Esc", () => {
    const onOpenChange = vi.fn();
    const onHistoryOpenChange = vi.fn();
    const props = base({
      onOpenChange,
      onHistoryOpenChange,
      history: <div>h</div>,
      historyOpen: true,
    });
    const { rerender } = render(<ZibbyOverlay {...props} />);
    advance(850);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onHistoryOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenChange).not.toHaveBeenCalled();
    rerender(<ZibbyOverlay {...props} historyOpen={false} />);
    const handled = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    handled.preventDefault();
    document.dispatchEvent(handled);
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("backdrop click closes the history first, then the overlay", () => {
    const onOpenChange = vi.fn();
    const onHistoryOpenChange = vi.fn();
    const props = base({ onOpenChange, onHistoryOpenChange, history: "h", historyOpen: true });
    const { rerender } = render(<ZibbyOverlay {...props} />);
    advance(850);
    fireEvent.click(screen.getByTestId(ZibbyOverlayTestId.Backdrop));
    expect(onHistoryOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenChange).not.toHaveBeenCalled();
    rerender(<ZibbyOverlay {...props} historyOpen={false} />);
    fireEvent.click(screen.getByTestId(ZibbyOverlayTestId.Backdrop));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("history aside is hidden + inert when closed", () => {
    const { rerender } = render(
      <ZibbyOverlay {...base({ history: <button>x</button>, historyLabel: "Historie" })} />,
    );
    const aside = screen.getByTestId(ZibbyOverlayTestId.History);
    expect(aside).toHaveRole("complementary");
    expect(aside).toHaveAttribute("aria-hidden", "true");
    expect(aside).toHaveAttribute("inert");
    expect(aside).toHaveAttribute("aria-label", "Historie");
    rerender(<ZibbyOverlay {...base({ history: <button>x</button>, historyOpen: true })} />);
    expect(screen.getByTestId(ZibbyOverlayTestId.History)).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByTestId(ZibbyOverlayTestId.History)).not.toHaveAttribute("inert");
  });

  it("reacts to drags only when they carry files", () => {
    const onFilesDrop = vi.fn();
    const onDragActiveChange = vi.fn();
    render(<ZibbyOverlay {...base({ onFilesDrop, onDragActiveChange })} />);
    const root = screen.getByTestId(ZibbyOverlayTestId.Root);
    fireEvent.dragEnter(root, { dataTransfer: { types: ["text/plain"], files: [] } });
    fireEvent.drop(root, { dataTransfer: { types: ["text/plain"], files: [] } });
    expect(onDragActiveChange).not.toHaveBeenCalled();
    expect(onFilesDrop).not.toHaveBeenCalled();
    const file = new File(["a"], "a.txt");
    fireEvent.dragEnter(root, { dataTransfer: { types: ["Files"], files: [file] } });
    expect(onDragActiveChange).toHaveBeenCalledWith(true);
    fireEvent.drop(root, { dataTransfer: { types: ["Files"], files: [file] } });
    expect(onFilesDrop).toHaveBeenCalledWith([file]);
    expect(onDragActiveChange).toHaveBeenLastCalledWith(false);
  });

  it("renders the drop zone only when active", () => {
    const { rerender } = render(
      <ZibbyOverlay {...base({ dropTitle: "Drop", dropHint: "files" })} />,
    );
    expect(screen.queryByTestId(ZibbyOverlayTestId.Drop)).toBeNull();
    rerender(
      <ZibbyOverlay {...base({ dropActive: true, dropTitle: "Drop", dropHint: "files" })} />,
    );
    expect(screen.getByTestId(ZibbyOverlayTestId.Drop)).toHaveTextContent("Drop");
  });

  it("renders every slot into its part", () => {
    render(
      <ZibbyOverlay
        {...base({
          topBar: "tb",
          status: "st",
          live: "lv",
          hint: "hn",
          suggestions: "sg",
          attachments: "at",
          footer: "ft",
          toast: "ts",
        })}
      />,
    );
    const pairs: [ZibbyOverlayTestId, string][] = [
      [ZibbyOverlayTestId.TopBar, "tb"],
      [ZibbyOverlayTestId.Status, "st"],
      [ZibbyOverlayTestId.Live, "lv"],
      [ZibbyOverlayTestId.Hint, "hn"],
      [ZibbyOverlayTestId.Suggestions, "sg"],
      [ZibbyOverlayTestId.Attachments, "at"],
      [ZibbyOverlayTestId.Footer, "ft"],
      [ZibbyOverlayTestId.Toast, "ts"],
      [ZibbyOverlayTestId.Thread, "thread"],
      [ZibbyOverlayTestId.Orb, "orb"],
    ];
    for (const [id, text] of pairs) expect(screen.getByTestId(id)).toHaveTextContent(text);
    expect(screen.getByTestId(ZibbyOverlayTestId.Status)).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId(ZibbyOverlayTestId.Live)).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId(ZibbyOverlayTestId.Composer)).toContainElement(
      screen.getByLabelText("Message"),
    );
  });

  it("scrolls the thread to the bottom when scrollKey changes", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 480,
    });
    try {
      const { rerender } = render(<ZibbyOverlay {...base({ scrollKey: 1 })} />);
      const thread = screen.getByTestId(ZibbyOverlayTestId.Thread);
      thread.scrollTop = 0;
      rerender(<ZibbyOverlay {...base({ scrollKey: 2 })} />);
      expect(thread.scrollTop).toBe(480);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    }
  });

  it("moves focus in (composer by default, marked element first) and restores it", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const props = base();
    const { rerender } = render(<ZibbyOverlay {...props} />);
    expect(screen.getByLabelText("Message")).toHaveFocus();
    rerender(<ZibbyOverlay {...props} open={false} />);
    expect(opener).toHaveFocus();
    advance(500);
    opener.remove();

    const marked = base({
      topBar: <button {...{ [ZIBBY_OVERLAY_AUTOFOCUS_ATTR]: "" }}>go</button>,
    });
    render(<ZibbyOverlay {...marked} />);
    expect(screen.getByRole("button", { name: "go" })).toHaveFocus();
  });

  it("traps Tab inside the dialog and locks body scroll", () => {
    const { unmount } = render(<ZibbyOverlay {...base({ topBar: <button>first</button> })} />);
    expect(document.body.style.overflow).toBe("hidden");
    const first = screen.getByRole("button", { name: "first" });
    const input = screen.getByLabelText("Message");
    input.focus();
    fireEvent.keyDown(input, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(input).toHaveFocus();
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("skips the flight under reduced motion", () => {
    setMatchMedia(true);
    const phases: ZibbyOverlayPhase[] = [];
    const props = base({ onPhaseChange: (p) => phases.push(p), origin: { x: 10, y: 10 } });
    const { rerender } = render(<ZibbyOverlay {...props} />);
    expect(phases).toEqual(["open"]);
    expect(screen.queryByTestId(ZibbyOverlayTestId.Shock)).toBeNull();
    expect(screen.getByTestId(ZibbyOverlayTestId.Flyer).innerHTML).not.toContain("animate-zo-fx");
    rerender(<ZibbyOverlay {...props} open={false} />);
    advance(150);
    expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).toBeNull();
  });

  it("compact is a full-screen opaque layer without backdrop or flight", () => {
    render(<ZibbyOverlay {...base({ compact: true, origin: { x: 1, y: 1 }, topBar: "tb" })} />);
    expect(screen.getByTestId(ZibbyOverlayTestId.Root)).toHaveClass("bg-background");
    expect(screen.queryByTestId(ZibbyOverlayTestId.Backdrop)).toBeNull();
    expect(screen.getByTestId(ZibbyOverlayTestId.TopBar)).toHaveTextContent("tb");
  });
});
