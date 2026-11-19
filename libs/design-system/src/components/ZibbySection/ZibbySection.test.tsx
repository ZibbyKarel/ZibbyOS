import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import {
  ZibbySection,
  ZibbySectionOrbButton,
  ZibbySectionStatusButton,
  ZibbySectionTestId,
} from "./ZibbySection";

describe("ZibbySection", () => {
  it("is a labelled group with two buttons tinted by the status", async () => {
    const user = userEvent.setup();
    const onOrb = vi.fn();
    const onStatus = vi.fn();
    render(
      <ZibbySection ariaLabel="Zibby" status="paused">
        <ZibbySectionOrbButton aria-label="Ask Zibby" onClick={onOrb} orb={<i>o</i>}>
          Zibby
        </ZibbySectionOrbButton>
        <ZibbySectionStatusButton aria-label="Status" label="Paused" onClick={onStatus} />
      </ZibbySection>,
    );
    const root = screen.getByTestId(ZibbySectionTestId.Root);
    expect(root).toHaveRole("group");
    expect(root).toHaveAccessibleName("Zibby");
    expect(root).toHaveAttribute("data-status", "paused");
    expect(screen.getByTestId(ZibbySectionTestId.OrbSlot)).toHaveTextContent("o");
    await user.click(screen.getByTestId(ZibbySectionTestId.OrbButton));
    await user.click(screen.getByTestId(ZibbySectionTestId.StatusButton));
    expect(onOrb).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toHaveTextContent("Paused");
  });

  it("tints the full-Automat status amber", () => {
    render(
      <ZibbySection ariaLabel="Zibby" status="auto">
        <ZibbySectionStatusButton aria-label="Status" label="Auto" />
      </ZibbySection>,
    );
    const root = screen.getByTestId(ZibbySectionTestId.Root);
    expect(root).toHaveAttribute("data-status", "auto");
    expect(root).toHaveClass("border-accent/55");
  });
});
