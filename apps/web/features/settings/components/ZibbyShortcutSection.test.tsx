import { act, renderWithProviders as render, screen, within } from "../../../test/render";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ZIBBY_SHORTCUT_STORAGE_KEY,
  isShortcutRecording,
  resetZibbyShortcutStoreForTests,
} from "../../zibby/shortcut/useZibbyShortcut";
import { ZibbyShortcutSectionTestId as Id, ZibbyShortcutSection } from "./ZibbyShortcutSection";

function press(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  act(() => void window.dispatchEvent(event));
  return event;
}

function keys(testId: string) {
  return within(screen.getByTestId(testId))
    .getAllByTestId("kbd-root")
    .map((k) => k.textContent);
}

beforeEach(() => {
  window.localStorage.clear();
  resetZibbyShortcutStoreForTests();
  vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetZibbyShortcutStoreForTests();
});

describe("ZibbyShortcutSection", () => {
  it("shows the default shortcut with Kbd tokens and no collision", () => {
    render(<ZibbyShortcutSection />);
    expect(keys(Id.Current)).toEqual(["⌥", "Space"]);
    expect(screen.queryByTestId(Id.Collision)).not.toBeInTheDocument();
    expect(screen.queryByTestId(Id.Alias)).not.toBeInTheDocument();
    expect(screen.getByTestId(Id.Reset)).toBeDisabled();
  });

  it("mentions the Ctrl+Space alias on non-macOS", () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("Win32");
    render(<ZibbyShortcutSection />);
    expect(keys(Id.Alias)).toEqual(["Ctrl", "Space"]);
    expect(screen.queryByTestId(Id.Collision)).not.toBeInTheDocument();
  });

  it("records the next combination, saves it and suspends the hotkey meanwhile", async () => {
    render(<ZibbyShortcutSection />);
    await userEvent.click(screen.getByTestId(Id.Record));
    expect(screen.getByTestId(Id.Recording)).toBeInTheDocument();
    expect(isShortcutRecording()).toBe(true);

    const event = press({ code: "KeyJ", key: "j", altKey: true, shiftKey: true });
    expect(event.defaultPrevented).toBe(true);

    expect(screen.queryByTestId(Id.Recording)).not.toBeInTheDocument();
    expect(isShortcutRecording()).toBe(false);
    expect(keys(Id.Current)).toEqual(["⌥", "⇧", "J"]);
    expect(window.localStorage.getItem(ZIBBY_SHORTCUT_STORAGE_KEY)).toBe("Alt+Shift+KeyJ");
    expect(screen.getByTestId(Id.Reset)).toBeEnabled();
  });

  it("keeps waiting on a modifier-only press and hints on a bare key", async () => {
    render(<ZibbyShortcutSection />);
    await userEvent.click(screen.getByTestId(Id.Record));
    press({ code: "AltLeft", key: "Alt", altKey: true });
    expect(screen.getByTestId(Id.Recording)).toBeInTheDocument();
    press({ code: "KeyN", key: "n" });
    expect(screen.getByTestId(Id.Recording)).toBeInTheDocument();
    expect(screen.getByText(/Přidej Alt, Ctrl nebo Cmd/)).toBeInTheDocument();
    expect(window.localStorage.getItem(ZIBBY_SHORTCUT_STORAGE_KEY)).toBeNull();
  });

  it("Esc cancels recording without changing anything", async () => {
    render(<ZibbyShortcutSection />);
    await userEvent.click(screen.getByTestId(Id.Record));
    press({ code: "Escape", key: "Escape" });
    expect(screen.queryByTestId(Id.Recording)).not.toBeInTheDocument();
    expect(isShortcutRecording()).toBe(false);
    expect(keys(Id.Current)).toEqual(["⌥", "Space"]);
  });

  it("the Record button toggles to Cancel and releases the suspension", async () => {
    render(<ZibbyShortcutSection />);
    await userEvent.click(screen.getByTestId(Id.Record));
    expect(screen.getByTestId(Id.Record)).toHaveTextContent("Zrušit");
    await userEvent.click(screen.getByTestId(Id.Record));
    expect(isShortcutRecording()).toBe(false);
  });

  it("warns on a colliding combination but still saves it", async () => {
    render(<ZibbyShortcutSection />);
    await userEvent.click(screen.getByTestId(Id.Record));
    press({ code: "Space", key: " ", metaKey: true });
    const warning = screen.getByTestId(Id.Collision);
    expect(warning.closest("[role]")).toHaveRole("status");
    expect(warning).toHaveTextContent("Spotlight");
    expect(window.localStorage.getItem(ZIBBY_SHORTCUT_STORAGE_KEY)).toBe("Meta+Space");
  });

  it("Reset to default restores Alt+Space and drops the warning", async () => {
    window.localStorage.setItem(ZIBBY_SHORTCUT_STORAGE_KEY, "Meta+Space");
    render(<ZibbyShortcutSection />);
    expect(screen.getByTestId(Id.Collision)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(Id.Reset));
    expect(keys(Id.Current)).toEqual(["⌥", "Space"]);
    expect(screen.queryByTestId(Id.Collision)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ZIBBY_SHORTCUT_STORAGE_KEY)).toBeNull();
  });
});
