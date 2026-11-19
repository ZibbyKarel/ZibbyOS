import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketplaceCard, MarketplaceCardTestId } from "./MarketplaceCard";

const props = {
  name: "zibby-dev",
  kind: "dev" as const,
  kindLabel: "dev",
  source: "github.com/zibby/plugins",
  installed: 7,
  total: 12,
  installedText: ["Installed ", " of 12 plugins"] as [string, string],
};

describe("MarketplaceCard", () => {
  it("shows name, source, count line and percentage", () => {
    render(<MarketplaceCard {...props} footer={<button type="button">Browse</button>} />);
    expect(screen.getByTestId(MarketplaceCardTestId.Name)).toHaveTextContent("zibby-dev");
    expect(screen.getByTestId(MarketplaceCardTestId.Source)).toHaveTextContent(
      "github.com/zibby/plugins",
    );
    expect(screen.getByTestId(MarketplaceCardTestId.Installed)).toHaveTextContent(
      "Installed 7 of 12 plugins",
    );
    expect(screen.getByTestId(MarketplaceCardTestId.Percent)).toHaveTextContent("58 %");
    expect(screen.getByTestId(MarketplaceCardTestId.Footer)).toHaveTextContent("Browse");
  });

  it("handles an empty catalog and opens via the cover", () => {
    const onOpen = vi.fn();
    render(<MarketplaceCard {...props} installed={0} onOpen={onOpen} total={0} />);
    expect(screen.getByTestId(MarketplaceCardTestId.Percent)).toHaveTextContent("0 %");
    fireEvent.click(screen.getByTestId(MarketplaceCardTestId.Open));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
