import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsDuration, SettingsDurationTestId } from "./SettingsDuration";

describe("SettingsDuration", () => {
  it("splits minutes and carries overflow into hours", () => {
    const onChange = vi.fn();
    render(
      <SettingsDuration
        hoursLabel="hours"
        label="Task planner"
        minutesLabel="minutes"
        onChange={onChange}
        value={90}
      />,
    );
    expect(screen.getByTestId(SettingsDurationTestId.Hours)).toHaveValue(1);
    expect(screen.getByTestId(SettingsDurationTestId.Minutes)).toHaveValue(30);
    fireEvent.change(screen.getByTestId(SettingsDurationTestId.Minutes), {
      target: { value: "75" },
    });
    expect(onChange).toHaveBeenLastCalledWith(135);
  });
});
