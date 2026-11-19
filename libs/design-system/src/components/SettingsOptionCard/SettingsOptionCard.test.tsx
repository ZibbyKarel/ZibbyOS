import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SettingsOptionCard,
  SettingsOptionCardTestId,
  SettingsOptionGroup,
} from "./SettingsOptionCard";

describe("SettingsOptionCard", () => {
  it("is a radio that selects on click unless disabled", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <SettingsOptionGroup ariaLabel="Engine">
        <SettingsOptionCard checked={false} label="Claude" media="Cl" onSelect={onSelect} />
      </SettingsOptionGroup>,
    );
    const card = screen.getByTestId(SettingsOptionCardTestId.Root);
    expect(card).toHaveRole("radio");
    expect(card).toHaveAttribute("aria-checked", "false");
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);
    rerender(
      <SettingsOptionGroup ariaLabel="Engine">
        <SettingsOptionCard checked disabled label="Claude" onSelect={onSelect} />
      </SettingsOptionGroup>,
    );
    fireEvent.click(screen.getByTestId(SettingsOptionCardTestId.Root));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("hides the radio dot when asked", () => {
    render(<SettingsOptionCard checked label="OpenAI" radio={false} />);
    expect(screen.queryByTestId(SettingsOptionCardTestId.Radio)).toBeNull();
  });
});
