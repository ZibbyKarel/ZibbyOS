import { fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpaceToTalk } from "./useSpaceToTalk";

function setup(enabled = true) {
  const onDown = vi.fn();
  const onUp = vi.fn();
  const hook = renderHook((p: { enabled: boolean }) => useSpaceToTalk({ ...p, onDown, onUp }), {
    initialProps: { enabled },
  });
  return { onDown, onUp, ...hook };
}
const down = (target: Element | Window = window, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { code: "Space", key: " ", ...init });
const up = (target: Element | Window = window) =>
  fireEvent.keyUp(target, { code: "Space", key: " " });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useSpaceToTalk", () => {
  it("fires down/up once and prevents scrolling", () => {
    const { onDown, onUp } = setup();
    expect(down()).toBe(false); // default prevented
    down(window, { repeat: true });
    down(window, { repeat: true });
    expect(onDown).toHaveBeenCalledTimes(1);
    up();
    expect(onUp).toHaveBeenCalledTimes(1);
    up();
    expect(onUp).toHaveBeenCalledTimes(1);
  });

  it("ignores modifiers", () => {
    const { onDown } = setup();
    for (const mod of ["altKey", "ctrlKey", "metaKey", "shiftKey"]) down(window, { [mod]: true });
    expect(onDown).not.toHaveBeenCalled();
  });

  it("leaves Space to editable targets and native controls", () => {
    const { onDown } = setup();
    render(
      <div>
        <input data-testid="in" />
        <textarea data-testid="ta" />
        <select data-testid="sel" />
        <div contentEditable suppressContentEditableWarning data-testid="ce">
          <span data-testid="ce-child">x</span>
        </div>
        <button data-testid="btn">
          <span data-testid="btn-child">go</span>
        </button>
        <a data-testid="link" href="/x">
          l
        </a>
        <div aria-checked="false" data-testid="sw" role="switch" />
        <button data-ptt-allow data-testid="ptt">
          mic
        </button>
        <div data-testid="plain" />
      </div>,
    );
    const id = (t: string) => document.querySelector(`[data-testid="${t}"]`) as Element;
    for (const t of ["in", "ta", "sel", "ce", "ce-child", "btn", "btn-child", "link", "sw"]) {
      expect(down(id(t))).toBe(true); // not prevented
    }
    expect(onDown).not.toHaveBeenCalled();
    down(id("ptt"));
    up(id("ptt"));
    down(id("plain"));
    expect(onDown).toHaveBeenCalledTimes(2);
  });

  it("releases on window blur and when disabled mid-hold", () => {
    const { onDown, onUp, rerender } = setup();
    down();
    fireEvent.blur(window);
    expect(onUp).toHaveBeenCalledTimes(1);
    down();
    expect(onDown).toHaveBeenCalledTimes(2);
    rerender({ enabled: false });
    expect(onUp).toHaveBeenCalledTimes(2);
    down();
    expect(onDown).toHaveBeenCalledTimes(2);
  });
});
