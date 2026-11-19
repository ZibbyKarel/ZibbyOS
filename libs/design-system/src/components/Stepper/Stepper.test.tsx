import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Stepper, StepperTestId } from "./Stepper";

describe("Stepper", () => {
  it("is a labelled group showing the value", () => {
    render(<Stepper aria-label="Max retries" onChange={() => {}} value={3} />);
    const root = screen.getByTestId(StepperTestId.Root);
    expect(root).toHaveRole("group");
    expect(root).toHaveAccessibleName("Max retries");
    expect(screen.getByTestId(StepperTestId.Value)).toHaveTextContent("3");
  });

  it("steps within min/max", async () => {
    const onChange = vi.fn();
    render(<Stepper aria-label="n" max={4} min={2} onChange={onChange} value={3} />);
    await userEvent.click(screen.getByTestId(StepperTestId.Increase));
    await userEvent.click(screen.getByTestId(StepperTestId.Decrease));
    expect(onChange).toHaveBeenNthCalledWith(1, 4);
    expect(onChange).toHaveBeenNthCalledWith(2, 2);
  });

  it("disables the bound buttons at the limits", () => {
    render(<Stepper aria-label="n" max={3} min={3} onChange={() => {}} value={3} />);
    expect(screen.getByTestId(StepperTestId.Decrease)).toBeDisabled();
    expect(screen.getByTestId(StepperTestId.Increase)).toBeDisabled();
  });
});
