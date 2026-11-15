import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyComposerBar, ZibbyComposerBarTestId, ZibbyComposerInput } from "./ZibbyComposerBar";

describe("ZibbyComposerBar", () => {
  it("renders leading, middle and trailing slots", () => {
    render(
      <ZibbyComposerBar label="Composer" leading="L" trailing="T">
        M
      </ZibbyComposerBar>,
    );
    const root = screen.getByTestId(ZibbyComposerBarTestId.Root);
    expect(root).toHaveRole("group");
    expect(root).toHaveAccessibleName("Composer");
    expect(root).toHaveClass("items-end");
    expect(screen.getByTestId(ZibbyComposerBarTestId.Leading)).toHaveTextContent("L");
    expect(screen.getByTestId(ZibbyComposerBarTestId.Middle)).toHaveClass("flex-1", "min-w-0");
    expect(screen.getByTestId(ZibbyComposerBarTestId.Middle)).toHaveTextContent("M");
    expect(screen.getByTestId(ZibbyComposerBarTestId.Trailing)).toHaveTextContent("T");
  });

  it("omits absent leading/trailing", () => {
    render(<ZibbyComposerBar>M</ZibbyComposerBar>);
    expect(screen.queryByTestId(ZibbyComposerBarTestId.Leading)).toBeNull();
    expect(screen.queryByTestId(ZibbyComposerBarTestId.Trailing)).toBeNull();
  });

  it("ZibbyComposerInput accepts typing", async () => {
    const user = userEvent.setup();
    render(<ZibbyComposerInput aria-label="Napsat" placeholder="nebo napiš…" />);
    const input = screen.getByTestId(ZibbyComposerBarTestId.Input);
    expect(input).toHaveAccessibleName("Napsat");
    await user.type(input, "ahoj");
    expect(input).toHaveValue("ahoj");
  });
});
