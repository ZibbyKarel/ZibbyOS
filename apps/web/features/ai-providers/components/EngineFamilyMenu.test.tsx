import userEvent from "@testing-library/user-event";
import {
  type AiEngineStatus,
  type SystemConfig,
  SystemConfigSchema,
  applyModelFamily,
} from "@zibby/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../../../test/render";
import { EngineFamilyMenu, EngineFamilyMenuTestId } from "./EngineFamilyMenu";

let config: SystemConfig | undefined;
let engines: AiEngineStatus[];
let setError = false;
const setConfig = vi.fn();
const push = vi.fn();
const onNavigate = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../system/queries", () => ({ useSystemConfigQuery: () => ({ data: config }) }));
vi.mock("../../system/mutations", () => ({
  useSetSystemConfigMutation: () => ({ mutate: setConfig, isError: setError }),
}));
vi.mock("../queries", () => ({ useAiEnginesQuery: () => ({ data: { engines } }) }));

const CATALOG = ["claude-agent/sonnet", "openai/gpt-5", "opencode/big-pickle"];

beforeEach(() => {
  setConfig.mockReset();
  push.mockReset();
  onNavigate.mockReset();
  setError = false;
  config = SystemConfigSchema.parse({});
  engines = [
    {
      id: "opencode",
      available: true,
      version: "1.2.3",
      providers: [],
      models: CATALOG.map((id) => ({ id, free: false, subscription: false, variants: [] })),
    },
  ];
});

const open = () => userEvent.click(screen.getByTestId(EngineFamilyMenuTestId.Toggle));

describe("EngineFamilyMenu", () => {
  it("names the current family and lists no families until opened", () => {
    render(<EngineFamilyMenu onNavigate={onNavigate} />);
    expect(screen.getByTestId(EngineFamilyMenuTestId.Toggle)).toHaveTextContent("Claude");
    expect(screen.queryByTestId(`${EngineFamilyMenuTestId.Family}-openai`)).toBeNull();
  });

  it("lists every family with the current one selected, Settings last", async () => {
    render(<EngineFamilyMenu onNavigate={onNavigate} />);
    await open();
    expect(screen.getByTestId(`${EngineFamilyMenuTestId.Family}-claude`)).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByTestId(`${EngineFamilyMenuTestId.Family}-openai`)).not.toHaveAttribute(
      "aria-current",
    );
    const rows = screen.getAllByRole("button");
    expect(rows.at(-1)).toBe(screen.getByTestId(EngineFamilyMenuTestId.Settings));
    expect(rows.at(-1)).toHaveTextContent("Nastavení");
  });

  it("Settings navigates to the AI engines page and closes the menu", async () => {
    render(<EngineFamilyMenu onNavigate={onNavigate} />);
    await open();
    await userEvent.click(screen.getByTestId(EngineFamilyMenuTestId.Settings));
    expect(push).toHaveBeenCalledWith("/system/settings/ai-engines");
    expect(onNavigate).toHaveBeenCalled();
  });

  it("picking a connected family writes the Settings body", async () => {
    render(<EngineFamilyMenu onNavigate={onNavigate} />);
    await open();
    await userEvent.click(screen.getByTestId(`${EngineFamilyMenuTestId.Family}-openai`));
    expect(setConfig).toHaveBeenCalledWith({
      body: { ...config, ...applyModelFamily("openai", CATALOG) },
    });
  });

  it("a disconnected family is disabled, explained and not written", async () => {
    render(<EngineFamilyMenu onNavigate={onNavigate} />);
    await open();
    const bluecode = screen.getByTestId(`${EngineFamilyMenuTestId.Family}-bluecode`);
    expect(bluecode).toBeDisabled();
    expect(bluecode).toHaveTextContent("Nepřipojeno");
    await userEvent.click(bluecode);
    expect(setConfig).not.toHaveBeenCalled();
  });

  it("shows the save-failed copy after a failed save", async () => {
    setError = true;
    render(<EngineFamilyMenu onNavigate={onNavigate} />);
    await open();
    expect(screen.getByTestId(EngineFamilyMenuTestId.SaveFailed)).toHaveTextContent(
      "Uložení AI enginu selhalo.",
    );
  });

  it("renders nothing until the config loads", () => {
    config = undefined;
    render(<EngineFamilyMenu onNavigate={onNavigate} />);
    expect(screen.queryByTestId(EngineFamilyMenuTestId.Toggle)).toBeNull();
  });
});
