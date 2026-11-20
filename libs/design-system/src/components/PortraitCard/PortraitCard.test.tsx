import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconTestId } from "../Icon/Icon";
import { MonogramTestId } from "../Monogram/Monogram";
import { PortraitCard, PortraitCardTestId } from "./PortraitCard";

describe("PortraitCard", () => {
  it("renders the slots and fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <PortraitCard
        effort={{ level: 3, label: "vysoká" }}
        engine="opencode"
        model="opus-5.5"
        name="Architekt"
        now={{ text: "Právě: Plán", tone: "run" }}
        onClick={onClick}
        role="Návrh"
        stats={[
          { value: "42", label: "Běhy" },
          { value: "96 %", label: "Úspěšnost" },
          { value: "$18", label: "Cena" },
        ]}
        tag="ENG"
      />,
    );
    expect(screen.getByTestId(PortraitCardTestId.Name)).toHaveTextContent("Architekt");
    expect(
      screen.getByTestId(PortraitCardTestId.Engine).querySelector("[data-icon='opencode']"),
    ).not.toBeNull();
    expect(screen.getByTestId(PortraitCardTestId.Now)).toHaveTextContent("Právě: Plán");
    expect(screen.getAllByTestId(PortraitCardTestId.Stat)).toHaveLength(3);
    expect(screen.getByTestId(PortraitCardTestId.Effort)).toHaveAttribute("data-level", "3");
    await userEvent.click(screen.getByTestId(PortraitCardTestId.Root));
    expect(onClick).toHaveBeenCalled();
  });

  it("omits the stats strip and now line when absent", () => {
    render(<PortraitCard name="Kodér" />);
    expect(screen.queryByTestId(PortraitCardTestId.Stats)).toBeNull();
    expect(screen.queryByTestId(PortraitCardTestId.Now)).toBeNull();
  });

  it("shows an icon tile instead of the monogram when a glyph is set", () => {
    render(<PortraitCard glyph="bot" name="Kodér" />);
    const avatar = screen.getByTestId(PortraitCardTestId.Avatar);
    expect(within(avatar).getByTestId(IconTestId.Root)).toHaveAttribute("data-icon", "bot");
    expect(within(avatar).queryByTestId(MonogramTestId.Root)).toBeNull();
  });

  it("shows the monogram without a glyph", () => {
    render(<PortraitCard name="Kodér" />);
    const avatar = screen.getByTestId(PortraitCardTestId.Avatar);
    expect(within(avatar).getByTestId(MonogramTestId.Root)).toBeInTheDocument();
    expect(within(avatar).queryByTestId(IconTestId.Root)).toBeNull();
  });

  it("keeps the whole avatar inside the band", () => {
    render(<PortraitCard name="Kodér" />);
    const avatar = screen.getByTestId(PortraitCardTestId.Avatar);
    expect(screen.getByTestId(PortraitCardTestId.Band)).toContainElement(avatar);
    expect(avatar.className).not.toContain("bottom-[-38px]");
  });
});
