import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsRow, SettingsRowTestId } from "./SettingsRow";

describe("SettingsRow", () => {
  it("renders label, hint and control", () => {
    render(
      <SettingsRow hint="Hint text" label="Task planner">
        <button type="button">Go</button>
      </SettingsRow>,
    );
    expect(screen.getByTestId(SettingsRowTestId.Label)).toHaveTextContent("Task planner");
    expect(screen.getByText("Hint text")).toBeInTheDocument();
    expect(screen.getByTestId(SettingsRowTestId.Control)).toHaveTextContent("Go");
    expect(screen.queryByTestId(SettingsRowTestId.Changed)).toBeNull();
  });

  it("marks an unsaved edit with the ink dot and the previous value", () => {
    render(<SettingsRow changed label="Task planner" was="5 min" />);
    expect(screen.getByTestId(SettingsRowTestId.Changed)).toBeInTheDocument();
    expect(screen.getByTestId(SettingsRowTestId.Was)).toHaveTextContent("was 5 min");
  });

  it("dims a disabled row", () => {
    render(<SettingsRow disabled label="Locked" />);
    expect(screen.getByTestId(SettingsRowTestId.Root)).toHaveAttribute("aria-disabled", "true");
  });
});
