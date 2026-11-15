import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyAttachmentChip, ZibbyAttachmentChipTestId } from "./ZibbyAttachmentChip";

describe("ZibbyAttachmentChip", () => {
  it("renders a thumbnail for images with src", () => {
    render(<ZibbyAttachmentChip kind="image" name="a.png" sizeLabel="2 MB" src="/a.png" />);
    expect(screen.getByTestId(ZibbyAttachmentChipTestId.Image)).toHaveAttribute("src", "/a.png");
    expect(screen.queryByTestId(ZibbyAttachmentChipTestId.Tile)).toBeNull();
    expect(screen.getByTestId(ZibbyAttachmentChipTestId.Size)).toHaveTextContent("2 MB");
    expect(screen.queryByTestId(ZibbyAttachmentChipTestId.Remove)).toBeNull();
  });

  it.each([
    ["image", "IMG"],
    ["pdf", "PDF"],
    ["code", "</>"],
    ["sheet", "XLS"],
    ["file", "FILE"],
  ] as const)("shows the %s tile label", (kind, text) => {
    render(<ZibbyAttachmentChip kind={kind} name="f" />);
    expect(screen.getByTestId(ZibbyAttachmentChipTestId.Tile)).toHaveTextContent(text);
  });

  it("removes with a labelled button", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<ZibbyAttachmentChip name="x.log" onRemove={onRemove} removeLabel="Odebrat x.log" />);
    expect(screen.getByTestId(ZibbyAttachmentChipTestId.Name)).toHaveAttribute("title", "x.log");
    const btn = screen.getByTestId(ZibbyAttachmentChipTestId.Remove);
    expect(btn).toHaveAccessibleName("Odebrat x.log");
    await user.click(btn);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("defaults the remove label", () => {
    render(<ZibbyAttachmentChip name="x.log" onRemove={() => {}} />);
    expect(screen.getByTestId(ZibbyAttachmentChipTestId.Remove)).toHaveAccessibleName(
      "Remove x.log",
    );
  });
});
