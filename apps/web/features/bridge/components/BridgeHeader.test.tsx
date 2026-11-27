import { MenuButtonTestId, PageTitleTestId, SegmentedControlTestId } from "@zibby/design-system";
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
  it("one view-options dropdown: density options under a heading call setDensity", async () => {
    renderWithProviders(<BridgeHeader {...props} />);
    await userEvent.click(screen.getByTestId(MenuButtonTestId.Trigger));
    expect(screen.getByTestId(`${MenuButtonTestId.Heading}-density`)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(`${MenuButtonTestId.Item}-density-compact`));
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

  it("layout settings sits below density in the dropdown and calls onManage", async () => {
    const onManage = vi.fn();
    renderWithProviders(<BridgeHeader {...props} onManage={onManage} />);
    const trigger = screen.getByTestId(MenuButtonTestId.Trigger);
    expect(trigger).toHaveAccessibleName("Zobrazení");
    await userEvent.click(trigger);
    await userEvent.click(screen.getByTestId(`${MenuButtonTestId.Item}-layouts`));
    expect(onManage).toHaveBeenCalled();
  });

  it("compact toolbar keeps only the manage-layouts button", async () => {
    const onManage = vi.fn();
    renderWithProviders(<BridgeHeader {...props} compact onManage={onManage} />);
    const manage = within(screen.getByTestId(BridgeHeaderTestId.Manage)).getByRole("button");
    expect(manage).toHaveAccessibleName("Upravit rozložení");
    await userEvent.click(manage);
    expect(onManage).toHaveBeenCalled();
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
