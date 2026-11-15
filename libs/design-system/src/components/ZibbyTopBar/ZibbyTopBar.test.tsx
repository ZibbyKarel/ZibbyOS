import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyTopBar, ZibbyTopBarTestId } from "./ZibbyTopBar";

const base = { title: "Fix CI", historyOpen: false, onHistoryToggle: vi.fn() };

describe("ZibbyTopBar", () => {
  it("renders the title and a labelled history toggle", async () => {
    const user = userEvent.setup();
    const onHistoryToggle = vi.fn();
    render(<ZibbyTopBar {...base} historyKbd="⌥ H" onHistoryToggle={onHistoryToggle} />);
    expect(screen.getByTestId(ZibbyTopBarTestId.Title)).toHaveTextContent("Fix CI");
    const btn = screen.getByTestId(ZibbyTopBarTestId.HistoryButton);
    expect(btn).toHaveAccessibleName("History");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveTextContent("⌥ H");
    await user.click(btn);
    expect(onHistoryToggle).toHaveBeenCalledOnce();
  });

  it("reflects historyOpen via aria-expanded", () => {
    render(<ZibbyTopBar {...base} historyOpen />);
    expect(screen.getByTestId(ZibbyTopBarTestId.HistoryButton)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("renders the actions slot", () => {
    render(<ZibbyTopBar {...base} actions={<button type="button">Act</button>} />);
    expect(screen.getByTestId(ZibbyTopBarTestId.Actions)).toHaveTextContent("Act");
  });

  it("is not editable without onRename", () => {
    render(<ZibbyTopBar {...base} />);
    expect(screen.getByTestId(ZibbyTopBarTestId.Title).tagName).toBe("SPAN");
  });

  it("commits a rename on Enter", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<ZibbyTopBar {...base} onRename={onRename} />);
    await user.click(screen.getByTestId(ZibbyTopBarTestId.Title));
    const input = screen.getByTestId(ZibbyTopBarTestId.TitleInput);
    expect(input).toHaveFocus();
    expect(input).toHaveAccessibleName("Conversation title");
    await user.clear(input);
    await user.type(input, "  New name  {Enter}");
    expect(onRename).toHaveBeenCalledOnce();
    expect(onRename).toHaveBeenCalledWith("New name");
    expect(screen.queryByTestId(ZibbyTopBarTestId.TitleInput)).not.toBeInTheDocument();
  });

  it("commits on blur", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(
      <>
        <ZibbyTopBar {...base} onRename={onRename} />
        <button type="button">elsewhere</button>
      </>,
    );
    await user.click(screen.getByTestId(ZibbyTopBarTestId.Title));
    await user.type(screen.getByTestId(ZibbyTopBarTestId.TitleInput), "X");
    await user.tab();
    expect(onRename).toHaveBeenCalledOnce();
    expect(onRename).toHaveBeenCalledWith("Fix CIX");
  });

  it("cancels on Escape without propagating", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const outer = vi.fn();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") outer();
    };
    document.addEventListener("keydown", listener);
    render(<ZibbyTopBar {...base} onRename={onRename} />);
    await user.click(screen.getByTestId(ZibbyTopBarTestId.Title));
    await user.type(screen.getByTestId(ZibbyTopBarTestId.TitleInput), "zzz{Escape}");
    expect(onRename).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
    expect(screen.queryByTestId(ZibbyTopBarTestId.TitleInput)).not.toBeInTheDocument();
    document.removeEventListener("keydown", listener);
  });

  it("is a no-op for unchanged or empty titles", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<ZibbyTopBar {...base} onRename={onRename} />);
    await user.click(screen.getByTestId(ZibbyTopBarTestId.Title));
    await user.type(screen.getByTestId(ZibbyTopBarTestId.TitleInput), "{Enter}");
    await user.click(screen.getByTestId(ZibbyTopBarTestId.Title));
    await user.clear(screen.getByTestId(ZibbyTopBarTestId.TitleInput));
    await user.type(screen.getByTestId(ZibbyTopBarTestId.TitleInput), "   {Enter}");
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId(ZibbyTopBarTestId.TitleInput)).not.toBeInTheDocument();
  });

  it("supports controlled renaming", async () => {
    const user = userEvent.setup();
    const onRenamingChange = vi.fn();
    function Host() {
      const [r, setR] = useState(true);
      return (
        <ZibbyTopBar
          {...base}
          onRename={vi.fn()}
          onRenamingChange={(v) => {
            onRenamingChange(v);
            setR(v);
          }}
          renaming={r}
        />
      );
    }
    render(<Host />);
    expect(screen.getByTestId(ZibbyTopBarTestId.TitleInput)).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onRenamingChange).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId(ZibbyTopBarTestId.TitleInput)).not.toBeInTheDocument();
  });
});
