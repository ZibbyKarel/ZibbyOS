import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_ZIBBY_SHORTCUT } from "./shortcut";
import { ZibbyShortcutKbd, ZibbyShortcutKbdTestId } from "./ZibbyShortcutKbd";

describe("ZibbyShortcutKbd", () => {
  it("renders the mac tokens", () => {
    render(<ZibbyShortcutKbd platform="mac" shortcut={DEFAULT_ZIBBY_SHORTCUT} />);
    const root = screen.getByTestId(ZibbyShortcutKbdTestId.Root);
    expect(
      within(root)
        .getAllByTestId("kbd-root")
        .map((k) => k.textContent),
    ).toEqual(["⌥", "Space"]);
  });

  it("renders words elsewhere", () => {
    render(<ZibbyShortcutKbd platform="windows" shortcut={DEFAULT_ZIBBY_SHORTCUT} />);
    const root = screen.getByTestId(ZibbyShortcutKbdTestId.Root);
    expect(
      within(root)
        .getAllByTestId("kbd-root")
        .map((k) => k.textContent),
    ).toEqual(["Alt", "Space"]);
  });

  it("defaults to the stored shortcut", () => {
    render(<ZibbyShortcutKbd platform="linux" />);
    expect(screen.getByTestId(ZibbyShortcutKbdTestId.Root)).toHaveTextContent("AltSpace");
  });
});
