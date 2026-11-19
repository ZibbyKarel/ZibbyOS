import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Splitter, SplitterTestId } from "./Splitter";

/** jsdom has no PointerEvent (clientX would be undefined) — dispatch a MouseEvent of the pointer type. */
const pointer = (el: HTMLElement, type: string, clientX = 0) =>
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX }));
  });

const setup = (props: Partial<React.ComponentProps<typeof Splitter>> = {}) => {
  const onChange = vi.fn();
  render(
    <Splitter label="Resize" max={400} min={100} onChange={onChange} value={200} {...props} />,
  );
  return { onChange, el: screen.getByTestId(SplitterTestId.Root) };
};

describe("Splitter", () => {
  it("is a focusable separator exposing its value and bounds", () => {
    const { el } = setup();
    expect(el).toHaveRole("separator");
    expect(el).toHaveAccessibleName("Resize");
    expect(el).toHaveAttribute("aria-valuenow", "200");
    expect(el).toHaveAttribute("aria-valuemin", "100");
    expect(el).toHaveAttribute("aria-valuemax", "400");
    expect(el).toHaveAttribute("tabindex", "0");
  });

  it("resizes with the arrow keys, clamped, and Shift for a bigger step", () => {
    const { el, onChange } = setup();
    fireEvent.keyDown(el, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(216);
    fireEvent.keyDown(el, { key: "ArrowLeft", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(136);
    fireEvent.keyDown(el, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.keyDown(el, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(400);
  });

  it("inverts the direction when the resized pane is after the handle", () => {
    const { el, onChange } = setup({ pane: "end" });
    fireEvent.keyDown(el, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(184);
  });

  it("follows the pointer while dragging and stops after release", () => {
    const { el, onChange } = setup();
    pointer(el, "pointerdown", 100);
    pointer(el, "pointermove", 150);
    expect(onChange).toHaveBeenLastCalledWith(250);
    pointer(el, "pointermove", 900);
    expect(onChange).toHaveBeenLastCalledWith(400);
    pointer(el, "pointerup");
    onChange.mockClear();
    pointer(el, "pointermove", 120);
    expect(onChange).not.toHaveBeenCalled();
  });
});
