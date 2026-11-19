import {
  DensityMenuTestId,
  MenuButtonTestId,
  PageTitleTestId,
  SegmentedControlTestId,
} from "@zibby/design-system";
import { UiSettingsSchema } from "@zibby/contracts";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../../../test/render";
import userEvent from "@testing-library/user-event";
import { BridgeHeader, type BridgeHeaderProps, BridgeHeaderTestId } from "./BridgeHeader";

const setDensity = vi.fn();
vi.mock("../../system", () => ({
  useUiSettings: () => ({ ui: UiSettingsSchema.parse({}), setDensity, setBridge: vi.fn() }),
}));

const props: BridgeHeaderProps = {
  preset: "DEFAULT",
  layouts: { shown: [], hidden: [] },
  onPreset: vi.fn(),
  onManage: vi.fn(),
};
const item = (v: string) => `${SegmentedControlTestId.Item}-${v}`;
const two = { shown: ["A"], hidden: ["B"] };

describe("BridgeHeader", () => {
  it("density select calls setDensity", async () => {
    renderWithProviders(<BridgeHeader {...props} />);
    await userEvent.click(screen.getByTestId(DensityMenuTestId.Trigger));
    await userEvent.click(screen.getByTestId(`${DensityMenuTestId.Option}-compact`));
    expect(setDensity).toHaveBeenCalledWith("compact");
  });

  it("has no clock", () => {
    renderWithProviders(<BridgeHeader {...props} />);
    expect(screen.queryByText(/\d{2}:\d{2}/)).toBeNull();
  });

  it("shows the CUSTOM tab only when the preset is CUSTOM", () => {
    const { rerender } = renderWithProviders(<BridgeHeader {...props} layouts={two} />);
    expect(screen.getByTestId(item("A"))).toBeInTheDocument();
    expect(screen.queryByTestId(item("CUSTOM"))).toBeNull();
    rerender(<BridgeHeader {...props} preset="CUSTOM" />);
    expect(screen.getByTestId(item("CUSTOM"))).toBeInTheDocument();
  });

  it("preset click applies it; clicking CUSTOM does nothing", async () => {
    const onPreset = vi.fn();
    renderWithProviders(
      <BridgeHeader
        {...props}
        layouts={{ shown: ["REVIEW"], hidden: [] }}
        onPreset={onPreset}
        preset="CUSTOM"
      />,
    );
    await userEvent.click(screen.getByTestId(item("REVIEW")));
    expect(onPreset).toHaveBeenCalledWith("REVIEW");
    onPreset.mockClear();
    await userEvent.click(screen.getByTestId(item("CUSTOM")));
    expect(onPreset).not.toHaveBeenCalled();
  });

  it("has no add-widget control (widgets are added from the board's empty cells)", () => {
    renderWithProviders(<BridgeHeader {...props} />);
    expect(screen.queryByTestId(MenuButtonTestId.Trigger)).toBeNull();
  });

  it("always shows manage, never save/cancel; manage calls onManage", async () => {
    const onManage = vi.fn();
    renderWithProviders(<BridgeHeader {...props} onManage={onManage} />);
    await userEvent.click(
      within(screen.getByTestId(BridgeHeaderTestId.Manage)).getByRole("button"),
    );
    expect(onManage).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /save|cancel|uložit|zrušit/i })).toBeNull();
  });

  it("manage is an icon-only button named by its label, with no title or caption", () => {
    renderWithProviders(<BridgeHeader {...props} />);
    const manage = within(screen.getByTestId(BridgeHeaderTestId.Manage)).getByRole("button");
    expect(manage).toHaveAccessibleName("Upravit rozložení");
    expect(manage).not.toHaveTextContent("Upravit rozložení");
    expect(screen.queryByText("Rozložení")).toBeNull();
  });

  it("renders no page title row (the sub-nav names the page)", () => {
    renderWithProviders(<BridgeHeader {...props} />);
    expect(screen.queryByTestId(PageTitleTestId.Root)).toBeNull();
  });

  it("hidden layouts are not offered in the header", () => {
    renderWithProviders(<BridgeHeader {...props} layouts={two} />);
    expect(screen.queryByTestId(item("B"))).toBeNull();
  });

  it("the active hidden layout shows in the segmented control", () => {
    renderWithProviders(<BridgeHeader {...props} layouts={two} preset="B" />);
    expect(screen.getByTestId(item("B"))).toBeInTheDocument();
  });
});
