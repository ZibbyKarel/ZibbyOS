import { UsagePanelTestId } from "@zibby/design-system";
import { describe, expect, it } from "vitest";
import { fireEvent, renderWithProviders, screen } from "../../../test/render";
import { HeaderLimits, HeaderLimitsTestId } from "./HeaderLimits";

const items = [
  { label: "5H", value: 40 },
  { label: "TÝDEN", value: 10 },
];

describe("HeaderLimits", () => {
  it("links the usage panel to the Budgets & limits page", () => {
    renderWithProviders(<HeaderLimits items={items} />);
    const trigger = screen.getByTestId(HeaderLimitsTestId.Trigger);
    expect(trigger).toHaveAttribute("href", "/governance/budgets");
    expect(trigger).toHaveAccessibleName("Budgety a limity");
    expect(screen.getByTestId(UsagePanelTestId.Root)).toBeInTheDocument();
  });

  it("opens no hover sheet", () => {
    renderWithProviders(<HeaderLimits items={items} />);
    fireEvent.mouseEnter(screen.getByTestId(HeaderLimitsTestId.Trigger));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("budgets-widget-stub")).not.toBeInTheDocument();
  });
});
