import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnsavedBar, UnsavedBarTestId } from "./UnsavedBar";

const base = {
  title: "2 unsaved changes",
  items: ["Instructions", "Tools"],
  discardLabel: "Discard",
  saveLabel: "Save",
  onDiscard: vi.fn(),
  onSave: vi.fn(),
};

describe("UnsavedBar", () => {
  it("names the changed sections and exposes a status role", () => {
    render(<UnsavedBar {...base} />);
    expect(screen.getByTestId(UnsavedBarTestId.Root)).toHaveRole("status");
    expect(screen.getByTestId(UnsavedBarTestId.Title)).toHaveTextContent("2 unsaved changes");
    expect(screen.getByTestId(UnsavedBarTestId.Items)).toHaveTextContent("Instructions, Tools");
  });

  it("fires discard and save", () => {
    const onDiscard = vi.fn();
    const onSave = vi.fn();
    render(<UnsavedBar {...base} onDiscard={onDiscard} onSave={onSave} shortcut="⌘S" />);
    fireEvent.click(screen.getByTestId(UnsavedBarTestId.Discard));
    fireEvent.click(screen.getByTestId(UnsavedBarTestId.Save));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(UnsavedBarTestId.Save)).toHaveTextContent("⌘S");
  });

  it("shows an error alert and disables actions while saving", () => {
    render(<UnsavedBar {...base} saving error="Server said no" />);
    expect(screen.getByTestId(UnsavedBarTestId.Error)).toHaveRole("alert");
    expect(screen.getByTestId(UnsavedBarTestId.Discard)).toBeDisabled();
    expect(screen.getByTestId(UnsavedBarTestId.Save)).toBeDisabled();
  });

  it("omits the items and error when empty", () => {
    render(<UnsavedBar {...base} items={[]} />);
    expect(screen.queryByTestId(UnsavedBarTestId.Items)).toBeNull();
    expect(screen.queryByTestId(UnsavedBarTestId.Error)).toBeNull();
  });
});
