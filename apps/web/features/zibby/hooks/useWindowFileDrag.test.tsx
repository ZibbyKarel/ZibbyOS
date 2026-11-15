import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWindowFileDrag } from "./useWindowFileDrag";

function dragEnter(types: string[]) {
  const event = new Event("dragenter", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { types } });
  window.dispatchEvent(event);
  return event;
}

describe("useWindowFileDrag", () => {
  it("reports a drag that carries files and takes over the drop", () => {
    const onEnter = vi.fn();
    renderHook(() => useWindowFileDrag(true, onEnter));
    const event = dragEnter(["Files"]);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores drags without files (text, links)", () => {
    const onEnter = vi.fn();
    renderHook(() => useWindowFileDrag(true, onEnter));
    dragEnter(["text/plain"]);
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("listens only while enabled", () => {
    const onEnter = vi.fn();
    const { rerender } = renderHook(({ on }) => useWindowFileDrag(on, onEnter), {
      initialProps: { on: false },
    });
    dragEnter(["Files"]);
    expect(onEnter).not.toHaveBeenCalled();
    rerender({ on: true });
    dragEnter(["Files"]);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
