import { SystemConfigSchema } from "@zibby/contracts";
import { describe, expect, it, vi } from "vitest";
import { renderSettings as render, screen } from "../testing/renderSettings";
import { RuntimePanels, RuntimePanelsTestId } from "./RuntimePanels";

const config = SystemConfigSchema.parse({});

vi.mock("../../system", () => ({
  useSystemConfigQuery: () => ({ data: config }),
  useSetSystemConfigMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("RuntimePanels", () => {
  it("lists the goal engine heartbeat with the other schedulers", () => {
    render(<RuntimePanels />);
    expect(screen.getByTestId(`${RuntimePanelsTestId.Tick}-goalEngineTickMs`)).toBeInTheDocument();
    expect(screen.getAllByText("Cíle").length).toBeGreaterThan(0);
  });
});
