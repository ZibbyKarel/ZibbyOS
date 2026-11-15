import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyTopBarMenu, ZibbyTopBarMenuTestId } from "./ZibbyTopBarMenu";

const item = (id: string) => `${ZibbyTopBarMenuTestId.Item}-${id}`;

function setup(onRename = vi.fn(), onDelete = vi.fn()) {
  render(
    <ZibbyTopBarMenu
      items={[
        { id: "rename", label: "Rename", icon: "pen", onSelect: onRename },
        { id: "clear", label: "Clear", disabled: true, onSelect: vi.fn() },
        { id: "delete", label: "Delete", icon: "trash", danger: true, onSelect: onDelete },
      ]}
      label="More"
    />,
  );
}

describe("ZibbyTopBarMenu", () => {
  it("has a labelled menu trigger and opens on click", async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByTestId(ZibbyTopBarMenuTestId.Trigger);
    expect(trigger).toHaveAccessibleName("More");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId(ZibbyTopBarMenuTestId.Menu)).not.toBeInTheDocument();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId(ZibbyTopBarMenuTestId.Menu)).toHaveRole("menu");
    expect(screen.getByTestId(item("rename"))).toHaveRole("menuitem");
    expect(screen.getByTestId(item("rename"))).toHaveFocus();
  });

  it("selects an item, closes and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    setup(onRename);
    await user.click(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger));
    await user.click(screen.getByTestId(item("rename")));
    expect(onRename).toHaveBeenCalledOnce();
    expect(screen.queryByTestId(ZibbyTopBarMenuTestId.Menu)).not.toBeInTheDocument();
    expect(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger)).toHaveFocus();
  });

  it("does not fire a disabled item", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger));
    const disabled = screen.getByTestId(item("clear"));
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(screen.getByTestId(ZibbyTopBarMenuTestId.Menu)).toBeInTheDocument();
  });

  it("marks the danger item", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    setup(vi.fn(), onDelete);
    await user.click(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger));
    expect(screen.getByTestId(item("delete")).className).toContain("text-bad");
    await user.click(screen.getByTestId(item("delete")));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("roves focus with arrows, skipping disabled items", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId(item("delete"))).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId(item("rename"))).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByTestId(item("delete"))).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByTestId(item("rename"))).toHaveFocus();
  });

  it("opens with ArrowDown on the trigger", async () => {
    const user = userEvent.setup();
    setup();
    screen.getByTestId(ZibbyTopBarMenuTestId.Trigger).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId(ZibbyTopBarMenuTestId.Menu)).toBeInTheDocument();
  });

  it("closes on Escape without letting it propagate", async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    setup();
    await user.click(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger));
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId(ZibbyTopBarMenuTestId.Menu)).not.toBeInTheDocument();
    expect(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger)).toHaveFocus();
    expect(outer).not.toHaveBeenCalled();
    // Closed menu: Escape is left alone so the overlay can close.
    await user.keyboard("{Escape}");
    expect(outer).toHaveBeenCalledOnce();
    document.removeEventListener("keydown", outer);
  });

  it("closes on an outside press", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger));
    await user.click(document.body);
    expect(screen.queryByTestId(ZibbyTopBarMenuTestId.Menu)).not.toBeInTheDocument();
  });
});
