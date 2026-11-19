import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { RadioCard, RadioCardGroup, RadioCardGroupTestId, RadioCardTestId } from "./RadioCard";

describe("RadioCard", () => {
  it("is a radiogroup of radios; select fires on click, not when disabled", async () => {
    const user = userEvent.setup();
    const a = vi.fn();
    const b = vi.fn();
    render(
      <RadioCardGroup ariaLabel="Mode">
        <RadioCard checked label="One" media={<i>o</i>} onSelect={a} />
        <RadioCard disabled checked={false} label="Two" onSelect={b} />
      </RadioCardGroup>,
    );
    expect(screen.getByTestId(RadioCardGroupTestId.Root)).toHaveRole("radiogroup");
    const [one, two] = screen.getAllByTestId(RadioCardTestId.Root);
    expect(one).toHaveRole("radio");
    expect(one).toHaveAttribute("aria-checked", "true");
    expect(two).toHaveAttribute("aria-disabled", "true");
    await user.click(one as HTMLElement);
    await user.click(two as HTMLElement);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("arrow keys move focus over enabled cards only", async () => {
    const user = userEvent.setup();
    render(
      <RadioCardGroup ariaLabel="Mode">
        <RadioCard checked={false} label="A" />
        <RadioCard disabled checked={false} label="B" />
        <RadioCard checked={false} label="C" />
      </RadioCardGroup>,
    );
    const [a, , c] = screen.getAllByTestId(RadioCardTestId.Root);
    (a as HTMLElement).focus();
    await user.keyboard("{ArrowRight}");
    expect(c).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(a).toHaveFocus();
  });
});
