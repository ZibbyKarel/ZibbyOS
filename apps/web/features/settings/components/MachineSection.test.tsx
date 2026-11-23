import { renderSettings as render, screen } from "../testing/renderSettings";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MachineConfig } from "@zibby/contracts";
import { MachineSection, MachineSectionTestId } from "./MachineSection";
import { PanelActionsTestId } from "./PanelActions";

const DEFAULTS: MachineConfig = {
  cloneRoot: "/Users/karel/Projects",
  generatedRoot: "/Users/karel/Documents/AI/Generated",
};

let config: MachineConfig = { ...DEFAULTS };
const setConfig = vi.fn();

vi.mock("../../machine", () => ({
  useMachineConfigQuery: () => ({ data: config }),
  useUpdateMachineConfigMutation: () => ({ mutateAsync: setConfig, isPending: false }),
}));

beforeEach(() => {
  setConfig.mockReset();
  setConfig.mockResolvedValue(undefined);
  config = { ...DEFAULTS };
});

describe("MachineSection", () => {
  it("seeds the clone-root field from the loaded config", () => {
    render(<MachineSection />);
    expect(screen.getByTestId(MachineSectionTestId.CloneRoot)).toHaveValue("/Users/karel/Projects");
  });

  it("saves the edited clone root", async () => {
    render(<MachineSection />);
    const input = screen.getByTestId(MachineSectionTestId.CloneRoot);
    await userEvent.clear(input);
    await userEvent.type(input, "/Volumes/data/zibby-clones");
    await userEvent.click(screen.getByTestId(PanelActionsTestId.Save));
    expect(setConfig).toHaveBeenCalledWith({ body: { cloneRoot: "/Volumes/data/zibby-clones" } });
  });

  it("disables Save when the field is cleared", async () => {
    render(<MachineSection />);
    await userEvent.clear(screen.getByTestId(MachineSectionTestId.CloneRoot));
    expect(screen.getByTestId(PanelActionsTestId.Save)).toBeDisabled();
  });

  it("saves only the edited generated root and warns that old files stay put", async () => {
    render(<MachineSection />);
    const input = screen.getByTestId(MachineSectionTestId.GeneratedRoot);
    expect(input).toHaveValue("/Users/karel/Documents/AI/Generated");
    await userEvent.clear(input);
    await userEvent.type(input, "/Volumes/data/generated");
    expect(screen.getByText(/does not move existing files|nepřesune existující/)).toBeVisible();
    await userEvent.click(screen.getByTestId(PanelActionsTestId.Save));
    expect(setConfig).toHaveBeenCalledWith({ body: { generatedRoot: "/Volumes/data/generated" } });
  });
});
