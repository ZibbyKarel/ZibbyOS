import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../test/render";
import { TextAreaFieldTestId } from "@zibby/design-system";
import { RunAutomationDialog, RunAutomationDialogTestId } from "./RunAutomationDialog";

const mutate = vi.fn();
vi.mock("../mutations", () => ({
  useTriggerAutomationMutation: () => ({ mutate, isPending: false }),
}));

beforeEach(() => mutate.mockClear());

describe("RunAutomationDialog", () => {
  it("sends the trimmed prompt with the trigger", async () => {
    renderWithProviders(<RunAutomationDialog automationId="digest" onClose={() => {}} />);
    await userEvent.type(
      screen.getByTestId(TextAreaFieldTestId.Control),
      "  chci projít včerejšek ",
    );
    await userEvent.click(screen.getByTestId(RunAutomationDialogTestId.Run));
    expect(mutate.mock.calls[0]![0]).toEqual({
      params: { id: "digest" },
      body: { prompt: "chci projít včerejšek" },
    });
  });

  it("sends an empty body when the prompt is blank", async () => {
    renderWithProviders(<RunAutomationDialog automationId="digest" onClose={() => {}} />);
    await userEvent.type(screen.getByTestId(TextAreaFieldTestId.Control), "   ");
    await userEvent.click(screen.getByTestId(RunAutomationDialogTestId.Run));
    expect(mutate.mock.calls[0]![0]).toEqual({ params: { id: "digest" }, body: {} });
  });
});
