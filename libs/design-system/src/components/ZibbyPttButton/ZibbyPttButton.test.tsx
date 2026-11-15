import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyPttButton, ZibbyPttButtonTestId } from "./ZibbyPttButton";

// jsdom has no PointerEvent: without it fireEvent drops `button` / `pointerId`.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  Object.defineProperty(window, "PointerEvent", { value: PointerEventPolyfill });
}

const root = () => screen.getByTestId(ZibbyPttButtonTestId.Root);

describe("ZibbyPttButton", () => {
  it("exposes label, aria-pressed and content", () => {
    render(<ZibbyPttButton label="Drž a mluv">Drž a mluv</ZibbyPttButton>);
    expect(root()).toHaveRole("button");
    expect(root()).toHaveAccessibleName("Drž a mluv");
    expect(root()).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId(ZibbyPttButtonTestId.Label)).toHaveTextContent("Drž a mluv");
    expect(screen.queryByTestId(ZibbyPttButtonTestId.Wave)).toBeNull();
  });

  it("hold: pointer down starts, up ends, once", () => {
    const start = vi.fn();
    const end = vi.fn();
    render(<ZibbyPttButton label="ptt" onTalkEnd={end} onTalkStart={start} />);
    fireEvent.pointerDown(root(), { button: 0, pointerId: 1 });
    expect(start).toHaveBeenCalledOnce();
    expect(root()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId(ZibbyPttButtonTestId.WaveBar)).toHaveLength(5);
    fireEvent.pointerUp(root(), { pointerId: 1 });
    fireEvent.pointerLeave(root(), { pointerId: 1 });
    expect(end).toHaveBeenCalledOnce();
    expect(root()).toHaveAttribute("aria-pressed", "false");
  });

  it("hold: pointer leave and cancel end the talk", () => {
    const end = vi.fn();
    render(<ZibbyPttButton label="ptt" onTalkEnd={end} />);
    fireEvent.pointerDown(root(), { button: 0, pointerId: 1 });
    fireEvent.pointerLeave(root());
    expect(end).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(root(), { button: 0, pointerId: 1 });
    fireEvent.pointerCancel(root());
    expect(end).toHaveBeenCalledTimes(2);
  });

  it("hold: pointer down is default-prevented", () => {
    render(<ZibbyPttButton label="ptt" />);
    const notPrevented = fireEvent.pointerDown(root(), { button: 0, pointerId: 1 });
    expect(notPrevented).toBe(false);
  });

  it("hold: Enter/Space keydown starts, keyup ends, repeats ignored", async () => {
    const user = userEvent.setup();
    const start = vi.fn();
    const end = vi.fn();
    render(<ZibbyPttButton label="ptt" onTalkEnd={end} onTalkStart={start} />);
    await user.tab();
    await user.keyboard("{ }");
    expect(start).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
    fireEvent.keyDown(root(), { key: "Enter" });
    fireEvent.keyDown(root(), { key: "Enter", repeat: true });
    expect(start).toHaveBeenCalledTimes(2);
    fireEvent.keyUp(root(), { key: "Enter" });
    expect(end).toHaveBeenCalledTimes(2);
  });

  it("tap: click toggles start / end", async () => {
    const user = userEvent.setup();
    const start = vi.fn();
    const end = vi.fn();
    render(<ZibbyPttButton label="ptt" mode="tap" onTalkEnd={end} onTalkStart={start} />);
    await user.click(root());
    expect(start).toHaveBeenCalledOnce();
    expect(root()).toHaveAttribute("aria-pressed", "true");
    await user.click(root());
    expect(end).toHaveBeenCalledOnce();
    expect(root()).toHaveAttribute("aria-pressed", "false");
  });

  it("tap: pointer release does not end the talk", () => {
    const end = vi.fn();
    render(<ZibbyPttButton active label="ptt" mode="tap" onTalkEnd={end} />);
    fireEvent.pointerUp(root());
    expect(end).not.toHaveBeenCalled();
  });

  it("controlled active wins and level drives the bars", () => {
    render(<ZibbyPttButton active label="ptt" level={0.5} />);
    expect(root()).toHaveAttribute("aria-pressed", "true");
    const bars = screen.getAllByTestId(ZibbyPttButtonTestId.WaveBar);
    expect(bars[2]).toHaveStyle({ transform: "scaleY(0.5)" });
    expect(bars[0]).toHaveStyle({ transform: "scaleY(0.3)" });
  });

  it("disabled ignores input", () => {
    const start = vi.fn();
    render(<ZibbyPttButton disabled label="ptt" onTalkStart={start} />);
    expect(root()).toBeDisabled();
    fireEvent.pointerDown(root(), { button: 0 });
    expect(start).not.toHaveBeenCalled();
  });

  it("lg size renders the round phone button without label", () => {
    render(
      <ZibbyPttButton label="Drž a mluv" size="lg">
        hidden
      </ZibbyPttButton>,
    );
    expect(root()).toHaveClass("h-[76px]", "w-[76px]");
    expect(screen.queryByTestId(ZibbyPttButtonTestId.Label)).toBeNull();
    expect(root()).toHaveAccessibleName("Drž a mluv");
  });
});
