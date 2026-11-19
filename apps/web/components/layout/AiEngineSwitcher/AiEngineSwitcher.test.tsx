import userEvent from "@testing-library/user-event";
import {
  type AiEngineStatus,
  type SystemConfig,
  SystemConfigSchema,
  applyModelFamily,
} from "@zibby/contracts";
import { IconTestId, MenuButtonTestId } from "@zibby/design-system";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders as render, screen, within } from "../../../test/render";
import { AiEngineSwitcher, AiEngineSwitcherTestId } from "./AiEngineSwitcher";
import { EngineLimitsSheetTestId } from "./EngineLimitsSheet";

let config: SystemConfig | undefined;
let engines: AiEngineStatus[];
let setError: unknown = null;
const setConfig = vi.fn();

vi.mock("../../../features/system/queries", () => ({
  useSystemConfigQuery: () => ({ data: config }),
}));
vi.mock("../../../features/system/mutations", () => ({
  useSetSystemConfigMutation: () => ({
    mutate: setConfig,
    isPending: false,
    isError: setError !== null,
    error: setError,
  }),
}));
vi.mock("../../../features/ai-providers/queries", () => ({
  useAiEnginesQuery: () => ({ data: { engines } }),
}));

vi.mock("../../../features/bridge/widgets/BudgetsWidget", () => ({
  BudgetsWidget: () => <div data-testid="budgets-widget-stub" />,
}));

const ids = (...models: string[]) =>
  models.map((id) => ({ id, free: false, subscription: false, variants: [] }));

const CATALOG = ["claude-agent/sonnet", "openai/gpt-5", "opencode/big-pickle"];

beforeEach(() => {
  setConfig.mockReset();
  setError = null;
  config = SystemConfigSchema.parse({});
  engines = [
    { id: "opencode", available: true, version: "1.2.3", providers: [], models: ids(...CATALOG) },
  ];
});

describe("AiEngineSwitcher", () => {
  it("shows the active family's glyph and names it", () => {
    render(<AiEngineSwitcher />);
    const trigger = screen.getByTestId(AiEngineSwitcherTestId.Root);
    expect(trigger).toHaveAccessibleName("AI engine: Claude");
    expect(trigger).toHaveTextContent("Claude");
    expect(within(trigger).getAllByTestId(IconTestId.Root)[0]).toHaveAttribute(
      "data-icon",
      "claude",
    );
  });

  it("lists the other families with glyphs, then Settings last", async () => {
    render(<AiEngineSwitcher />);
    await userEvent.click(screen.getByTestId(AiEngineSwitcherTestId.Root));
    expect(screen.queryByTestId(`${MenuButtonTestId.Item}-claude`)).not.toBeInTheDocument();
    const openai = screen.getByTestId(`${MenuButtonTestId.Item}-openai`);
    expect(within(openai).getByTestId(IconTestId.Root)).toHaveAttribute("data-icon", "openai");
    expect(
      within(screen.getByTestId(`${MenuButtonTestId.Item}-bluecode`)).getByTestId(IconTestId.Root),
    ).toHaveAttribute("data-icon", "code");
    const items = within(screen.getByTestId(MenuButtonTestId.Menu)).getAllByRole("menuitem");
    expect(items.at(-1)).toHaveAttribute("data-testid", `${MenuButtonTestId.Item}-settings`);
    expect(items.at(-1)).toHaveAttribute("href", "/system/settings/ai-engines");
    expect(items.at(-1)).toHaveTextContent("Nastavení");
  });

  it("picking a connected family writes the Settings body", async () => {
    render(<AiEngineSwitcher />);
    await userEvent.click(screen.getByTestId(AiEngineSwitcherTestId.Root));
    await userEvent.click(screen.getByTestId(`${MenuButtonTestId.Item}-openai`));
    expect(setConfig).toHaveBeenCalledWith({
      body: { ...config, ...applyModelFamily("openai", CATALOG) },
    });
  });

  it("a disconnected family is disabled, explained and not written", async () => {
    render(<AiEngineSwitcher />);
    await userEvent.click(screen.getByTestId(AiEngineSwitcherTestId.Root));
    const bluecode = screen.getByTestId(`${MenuButtonTestId.Item}-bluecode`);
    expect(bluecode).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId(`${MenuButtonTestId.Description}-bluecode`)).toHaveTextContent(
      "Nepřipojeno",
    );
    await userEvent.click(bluecode);
    expect(setConfig).not.toHaveBeenCalled();
  });

  it("an unreadable catalog leaves every family selectable", async () => {
    engines = [{ id: "opencode", available: false, models: [], providers: [] }];
    render(<AiEngineSwitcher />);
    await userEvent.click(screen.getByTestId(AiEngineSwitcherTestId.Root));
    expect(screen.getByTestId(`${MenuButtonTestId.Item}-bluecode`)).not.toHaveAttribute(
      "aria-disabled",
    );
  });

  it("a failed save shows the warn mark with the save-failed copy", () => {
    setError = new Error("boom");
    render(<AiEngineSwitcher />);
    expect(screen.getByTestId(AiEngineSwitcherTestId.SaveFailed)).toHaveAccessibleName(
      "Uložení AI enginu selhalo.",
    );
  });

  it("renders nothing until the config loads", () => {
    config = undefined;
    render(<AiEngineSwitcher />);
    expect(screen.queryByTestId(AiEngineSwitcherTestId.Root)).not.toBeInTheDocument();
  });

  it("shows the limits sheet on hover and focus, hides it on leave and Escape", async () => {
    render(<AiEngineSwitcher />);
    const trigger = screen.getByTestId(AiEngineSwitcherTestId.Root);
    expect(screen.queryByTestId(EngineLimitsSheetTestId.Sheet)).not.toBeInTheDocument();
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByTestId("budgets-widget-stub")).toBeInTheDocument();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByTestId(EngineLimitsSheetTestId.Sheet)).not.toBeInTheDocument();
    fireEvent.focus(trigger);
    expect(await screen.findByTestId(EngineLimitsSheetTestId.Sheet)).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByTestId(EngineLimitsSheetTestId.Sheet)).not.toBeInTheDocument();
  });

  it("hides the limits sheet while the click menu is open", async () => {
    render(<AiEngineSwitcher />);
    const trigger = screen.getByTestId(AiEngineSwitcherTestId.Root);
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByTestId(EngineLimitsSheetTestId.Sheet)).toBeInTheDocument();
    await userEvent.click(trigger);
    expect(screen.getByTestId(MenuButtonTestId.Menu)).toBeInTheDocument();
    expect(screen.queryByTestId(EngineLimitsSheetTestId.Sheet)).not.toBeInTheDocument();
  });
});
