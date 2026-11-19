import { renderWithProviders as render, screen } from "../../../test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Company } from "@zibby/contracts";
import { AvatarStackTestId, MiniTreeTestId, SemiGaugeTestId } from "@zibby/design-system";
import { CompanyCard } from "./CompanyCard";

const company: Company = {
  id: "acme",
  name: "Acme Inc",
  desc: "Klient",
  people: [{ name: "Karel", role: "dev" }],
  budget: { dailyCostCapUsd: 40 },
};

describe("CompanyCard", () => {
  it("renders people, tree and gauge when the data exists", () => {
    render(
      <CompanyCard
        company={company}
        summary={{
          teams: [{ id: "t1", name: "Platforma", projectCount: 2 }],
          projectCount: 2,
          gauge: { pct: 31, spentUsd: 12.4, capUsd: 40 },
        }}
      />,
    );
    expect(screen.getByTestId(AvatarStackTestId.Root)).toBeInTheDocument();
    expect(screen.getAllByTestId(MiniTreeTestId.Row)).toHaveLength(1);
    expect(screen.getByTestId(SemiGaugeTestId.Value)).toHaveTextContent("31 %");
  });

  it("omits the tree and gauge when there is nothing to show", () => {
    render(
      <CompanyCard company={{ id: "x", name: "X" }} summary={{ teams: [], projectCount: 0 }} />,
    );
    expect(screen.queryByTestId(MiniTreeTestId.Root)).toBeNull();
    expect(screen.queryByTestId(SemiGaugeTestId.Root)).toBeNull();
  });

  it("opens on click", async () => {
    const onOpen = vi.fn();
    render(
      <CompanyCard company={company} onOpen={onOpen} summary={{ teams: [], projectCount: 0 }} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Otevřít Acme Inc" }));
    expect(onOpen).toHaveBeenCalledWith(company);
  });
});
