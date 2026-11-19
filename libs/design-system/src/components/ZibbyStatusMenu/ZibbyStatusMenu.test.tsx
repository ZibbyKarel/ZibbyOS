import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import {
  ZibbyStatusAction,
  ZibbyStatusLink,
  ZibbyStatusMenu,
  ZibbyStatusMenuTestId,
} from "./ZibbyStatusMenu";

describe("ZibbyStatusMenu", () => {
  it("shows the status head, the action and the links", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onLink = vi.fn();
    render(
      <ZibbyStatusMenu
        description="Does what the levels allow."
        orb={<i>orb</i>}
        orbLabel="Zibby thinks"
        state=" · Zibby thinks"
        status="run"
        title="Running"
      >
        <ZibbyStatusAction hint="Work waits" label="Pause Zibby" onClick={onAction} />
        <ZibbyStatusLink hint="No exceptions" icon="shield" label="Levels" onClick={onLink} />
      </ZibbyStatusMenu>,
    );
    const head = screen.getByTestId(ZibbyStatusMenuTestId.Head);
    expect(head).toHaveTextContent("Running · Zibby thinks");
    expect(head).toHaveTextContent("Does what the levels allow.");
    expect(screen.getByRole("img")).toHaveAccessibleName("Zibby thinks");
    await user.click(screen.getByTestId(ZibbyStatusMenuTestId.Action));
    await user.click(screen.getByTestId(ZibbyStatusMenuTestId.Link));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(ZibbyStatusMenuTestId.Link)).toHaveTextContent("No exceptions");
  });

  it("renders the resume action with its own label", () => {
    render(<ZibbyStatusAction resume hint="Starts again" label="Resume Zibby" />);
    expect(screen.getByTestId(ZibbyStatusMenuTestId.Action)).toHaveTextContent("Resume Zibby");
  });
});
