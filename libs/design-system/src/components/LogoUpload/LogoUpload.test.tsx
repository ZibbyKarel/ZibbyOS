import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LogoUpload, LogoUploadTestId } from "./LogoUpload";

const base = { fallback: "AC", changeLabel: "Change logo", removeLabel: "Remove" };

describe("LogoUpload", () => {
  it("exposes a labelled change button that opens the picker and reports the file", () => {
    const onSelect = vi.fn();
    render(<LogoUpload {...base} onSelect={onSelect} />);
    const change = screen.getByTestId(LogoUploadTestId.Change);
    expect(change).toHaveAccessibleName("Change logo");
    const input = screen.getByTestId(LogoUploadTestId.Input) as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(change);
    expect(click).toHaveBeenCalled();
    const file = new File(["x"], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onSelect).toHaveBeenCalledWith(file);
  });

  it("shows the remove action only when a logo exists", () => {
    const onRemove = vi.fn();
    const { rerender } = render(<LogoUpload {...base} onRemove={onRemove} onSelect={vi.fn()} />);
    expect(screen.queryByTestId(LogoUploadTestId.Remove)).toBeNull();
    rerender(<LogoUpload {...base} onRemove={onRemove} onSelect={vi.fn()} src="/a.png" />);
    fireEvent.click(screen.getByTestId(LogoUploadTestId.Remove));
    expect(onRemove).toHaveBeenCalled();
  });
});
