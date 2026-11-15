import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { ZibbyToast, ZibbyToastTestId } from "./ZibbyToast";

describe("ZibbyToast", () => {
  it("renders the message as a status", () => {
    render(<ZibbyToast message="Conversation deleted" />);
    const root = screen.getByTestId(ZibbyToastTestId.Root);
    expect(root).toHaveRole("status");
    expect(screen.getByTestId(ZibbyToastTestId.Message)).toHaveTextContent("Conversation deleted");
  });

  it("renders no action without a label", () => {
    render(<ZibbyToast message="Saved" onAction={vi.fn()} />);
    expect(screen.queryByTestId(ZibbyToastTestId.Action)).not.toBeInTheDocument();
  });

  it("fires onAction from the action button, by mouse and keyboard", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<ZibbyToast actionLabel="Undo" message="Deleted" onAction={onAction} />);
    const action = screen.getByTestId(ZibbyToastTestId.Action);
    expect(action).toHaveRole("button");
    expect(action).toHaveAccessibleName("Undo");
    await user.click(action);
    action.focus();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(2);
  });
});
