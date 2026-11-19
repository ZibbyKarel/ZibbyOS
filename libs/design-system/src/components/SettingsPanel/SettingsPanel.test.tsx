import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel, SettingsPanelTestId } from "./SettingsPanel";

describe("SettingsPanel", () => {
  it("is a labelled region with title, description, actions and body", () => {
    render(
      <SettingsPanel
        actions={<button type="button">Save</button>}
        description="How loops wake up"
        id="schedulers"
        title="Schedulers"
      >
        <p>rows</p>
      </SettingsPanel>,
    );
    expect(screen.getByTestId(SettingsPanelTestId.Root)).toHaveAccessibleName("Schedulers");
    expect(screen.getByTestId(SettingsPanelTestId.Root)).toHaveAttribute("id", "schedulers");
    expect(screen.getByTestId(SettingsPanelTestId.Actions)).toHaveTextContent("Save");
    expect(screen.getByTestId(SettingsPanelTestId.Body)).toHaveTextContent("rows");
  });

  it("reflects the dirty tone", () => {
    render(<SettingsPanel title="Limits" tone="dirty" />);
    expect(screen.getByTestId(SettingsPanelTestId.Root)).toHaveAttribute("data-tone", "dirty");
  });

  it("collapses its body when collapsible", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <SettingsPanel collapsible open onOpenChange={onOpenChange} title="Live log">
        <p>matrix</p>
      </SettingsPanel>,
    );
    const toggle = screen.getByTestId(SettingsPanelTestId.Toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(
      <SettingsPanel collapsible onOpenChange={onOpenChange} open={false} title="Live log">
        <p>matrix</p>
      </SettingsPanel>,
    );
    expect(screen.queryByTestId(SettingsPanelTestId.Body)).toBeNull();
  });
});
