import { renderSettings as render, screen } from "../testing/renderSettings";
import cs from "../../../i18n/messages/cs.json";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SystemConfig, SystemConfigSchema } from "@zibby/contracts";
import { ChatSection } from "./ChatSection";

let config: SystemConfig = SystemConfigSchema.parse({});
const setConfig = vi.fn();

vi.mock("../../system/queries", () => ({ useSystemConfigQuery: () => ({ data: config }) }));
vi.mock("../../system/mutations", () => ({
  useSetSystemConfigMutation: () => ({ mutate: setConfig, isPending: false }),
}));

beforeEach(() => {
  setConfig.mockReset();
  config = SystemConfigSchema.parse({});
});

describe("ChatSection", () => {
  it("defaults to the jarvis persona selected", () => {
    render(<ChatSection />);
    expect(
      screen.getByRole("radio", { name: new RegExp(cs.settings.chat.persona.jarvis) }),
    ).toBeChecked();
  });

  it("picking a persona PUTs the whole config with only chatPersona changed", async () => {
    render(<ChatSection />);
    await userEvent.click(
      screen.getByRole("radio", { name: new RegExp(cs.settings.chat.persona.concise) }),
    );
    expect(setConfig).toHaveBeenCalledWith({ body: { ...config, chatPersona: "concise" } });
  });
});
