import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyIconButton, ZibbyIconButtonTestId } from "./ZibbyIconButton";

describe("ZibbyIconButton", () => {
  it("is a labelled button", () => {
    render(<ZibbyIconButton icon="x" label="Close" />);
    const el = screen.getByTestId(ZibbyIconButtonTestId.Root);
    expect(el).toHaveRole("button");
    expect(el).toHaveAccessibleName("Close");
    expect(el).toHaveAttribute("type", "button");
  });

  it("fires onClick by mouse and keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ZibbyIconButton icon="x" label="Close" onClick={onClick} />);
    await user.click(screen.getByTestId(ZibbyIconButtonTestId.Root));
    await user.tab();
    expect(screen.getByTestId(ZibbyIconButtonTestId.Root)).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("passes aria state through", () => {
    render(<ZibbyIconButton aria-pressed icon="x" label="Pin" />);
    expect(screen.getByTestId(ZibbyIconButtonTestId.Root)).toHaveAttribute("aria-pressed", "true");
  });
});
