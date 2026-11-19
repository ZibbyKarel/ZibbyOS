import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsNote, SettingsNoteTestId } from "./SettingsNote";

describe("SettingsNote", () => {
  it("renders copy and actions; errors are alerts", () => {
    render(
      <SettingsNote actions={<button type="button">Retry</button>} tone="err">
        <b>Failed.</b> Try again.
      </SettingsNote>,
    );
    expect(screen.getByTestId(SettingsNoteTestId.Root)).toHaveRole("alert");
    expect(screen.getByTestId(SettingsNoteTestId.Actions)).toHaveTextContent("Retry");
  });

  it("is a status for non-error tones and omits empty actions", () => {
    render(<SettingsNote tone="wait">Careful</SettingsNote>);
    expect(screen.getByTestId(SettingsNoteTestId.Root)).toHaveRole("status");
    expect(screen.queryByTestId(SettingsNoteTestId.Actions)).toBeNull();
  });
});
