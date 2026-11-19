import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepSlider, StepSliderTestId } from "./StepSlider";

const steps = [
  { value: "manual", label: "Manual" },
  { value: "semi", label: "Semi" },
  { value: "auto", label: "Auto" },
];

const setup = (value: string | null, onChange = vi.fn()) => {
  render(
    <StepSlider
      ariaLabel="Level"
      mixedLabel="Mixed"
      onChange={onChange}
      steps={steps}
      value={value}
    />,
  );
  return onChange;
};

describe("StepSlider", () => {
  it("exposes the slider role with value, range and text", () => {
    setup("semi");
    const thumb = screen.getByTestId(StepSliderTestId.Thumb);
    expect(thumb).toHaveRole("slider");
    expect(thumb).toHaveAccessibleName("Level");
    expect(thumb).toHaveAttribute("aria-valuemin", "0");
    expect(thumb).toHaveAttribute("aria-valuemax", "2");
    expect(thumb).toHaveAttribute("aria-valuenow", "1");
    expect(thumb).toHaveAttribute("aria-valuetext", "Semi");
  });

  it("selects a step on click", async () => {
    const onChange = setup("manual");
    await userEvent.click(screen.getByTestId(`${StepSliderTestId.Step}-auto`));
    expect(onChange).toHaveBeenCalledWith("auto");
  });

  it("moves with the arrow keys, Home and End, clamped", () => {
    const onChange = setup("semi");
    const thumb = screen.getByTestId(StepSliderTestId.Thumb);
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("auto");
    fireEvent.keyDown(thumb, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("manual");
    fireEvent.keyDown(thumb, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("manual");
    fireEvent.keyDown(thumb, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("auto");
    onChange.mockClear();
    fireEvent.keyDown(thumb, { key: "ArrowLeft" });
    fireEvent.keyDown(thumb, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("snaps to the nearest step on pointer release after a drag", () => {
    const onChange = setup("manual");
    const track = screen.getByTestId(StepSliderTestId.Track);
    track.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
    // jsdom has no PointerEvent, so clientX must be set on the event by hand.
    const at = (type: "pointerDown" | "pointerMove" | "pointerUp", clientX: number) => {
      const ev = createEvent[type](track, { pointerId: 1 });
      Object.defineProperty(ev, "clientX", { value: clientX });
      fireEvent(track, ev);
    };
    at("pointerDown", 50);
    at("pointerMove", 140);
    expect(onChange).not.toHaveBeenCalled();
    at("pointerUp", 260);
    expect(onChange).toHaveBeenCalledWith("auto");
  });

  it("shows no exact step when value is null", () => {
    const onChange = setup(null);
    const thumb = screen.getByTestId(StepSliderTestId.Thumb);
    expect(thumb).not.toHaveAttribute("aria-valuenow");
    expect(thumb).toHaveAttribute("aria-valuetext", "Mixed");
    expect(thumb).toHaveClass("opacity-0");
    expect(screen.getByTestId(StepSliderTestId.Mixed)).toHaveTextContent("Mixed");
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("manual");
  });
});
