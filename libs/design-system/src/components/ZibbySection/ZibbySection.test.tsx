import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import {
  ZibbySection,
  ZibbySectionModeButton,
  ZibbySectionOrbButton,
  ZibbySectionTestId,
} from "./ZibbySection";

describe("ZibbySection", () => {
  it("is a labelled group with two buttons tinted by the mode", async () => {
    const user = userEvent.setup();
    const onOrb = vi.fn();
    const onMode = vi.fn();
    render(
      <ZibbySection ariaLabel="Zibby" mode="auto">
        <ZibbySectionOrbButton aria-label="Ask Zibby" onClick={onOrb} orb={<i>o</i>}>
          Zibby
        </ZibbySectionOrbButton>
        <ZibbySectionModeButton aria-label="Mode" label="Automat" mode="auto" onClick={onMode} />
      </ZibbySection>,
    );
    const root = screen.getByTestId(ZibbySectionTestId.Root);
    expect(root).toHaveRole("group");
    expect(root).toHaveAccessibleName("Zibby");
    expect(root).toHaveAttribute("data-mode", "auto");
    expect(screen.getByTestId(ZibbySectionTestId.OrbSlot)).toHaveTextContent("o");
    await user.click(screen.getByTestId(ZibbySectionTestId.OrbButton));
    await user.click(screen.getByTestId(ZibbySectionTestId.ModeButton));
    expect(onOrb).toHaveBeenCalledTimes(1);
    expect(onMode).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(ZibbySectionTestId.ModeButton)).toHaveTextContent("Automat");
  });
});
