import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyChip, ZibbyChipTestId } from "./ZibbyChip";

describe("ZibbyChip", () => {
  it("is a labelled button with orb, label and kbd", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ZibbyChip kbd="⌥ Space" label="Vyvolat Zibbyho" onClick={onClick} orb={<i>o</i>}>
        Zibby
      </ZibbyChip>,
    );
    const root = screen.getByTestId(ZibbyChipTestId.Root);
    expect(root).toHaveRole("button");
    expect(root).toHaveAccessibleName("Vyvolat Zibbyho");
    expect(root).toHaveAttribute("type", "button");
    expect(screen.getByTestId(ZibbyChipTestId.Orb)).toHaveTextContent("o");
    expect(screen.getByTestId(ZibbyChipTestId.Label)).toHaveTextContent("Zibby");
    expect(screen.getByTestId(ZibbyChipTestId.Kbd)).toHaveTextContent("⌥ Space");
    await user.tab();
    expect(root).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.click(root);
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
