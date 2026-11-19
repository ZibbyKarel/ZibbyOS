import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PortraitCard, PortraitCardTestId } from "./PortraitCard";

describe("PortraitCard", () => {
  it("renders the slots and fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <PortraitCard
        effort={{ level: 3, label: "vysoká" }}
        engine="OC"
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
    expect(screen.getByTestId(PortraitCardTestId.Engine)).toHaveTextContent("OC");
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
});
