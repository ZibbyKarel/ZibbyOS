import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsStepper, SettingsStepperTestId } from "./SettingsStepper";

describe("SettingsStepper", () => {
  it("steps and clamps to the range", () => {
    const onChange = vi.fn();
    render(<SettingsStepper label="Runs" max={3} min={1} onChange={onChange} value={3} />);
    expect(screen.getByTestId(SettingsStepperTestId.Inc)).toBeDisabled();
    fireEvent.click(screen.getByTestId(SettingsStepperTestId.Dec));
    expect(onChange).toHaveBeenLastCalledWith(2);
    fireEvent.change(screen.getByTestId(SettingsStepperTestId.Input), { target: { value: "99" } });
    expect(onChange).toHaveBeenLastCalledWith(3);
  });
});
