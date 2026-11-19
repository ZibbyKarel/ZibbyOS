import { renderWithProviders as render, screen } from "../../../test/render";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketplaceSummary } from "@zibby/contracts";
import { MarketplaceCardTestId } from "@zibby/design-system";
import { ConnectMarketplaceDialogTestId } from "../components/ConnectMarketplaceDialog";
import { MarketplacesListScreen, MarketplacesListScreenTestId } from "./MarketplacesListScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const MARKETPLACES: MarketplaceSummary[] = [
  {
    id: "zibby-skills",
    source: "/repo/skills",
    devMode: true,
    managedClone: false,
    addedAt: "2026-10-26T10:00:00.000Z",
    pluginCount: 3,
    installedCount: 1,
  },
];

const { hooks } = vi.hoisted(() => ({
  hooks: {
    list: { data: [] as unknown, isPending: false, isError: false, refetch: vi.fn() },
    add: vi.fn(),
    addState: { isPending: false, isError: false, error: null as unknown },
  },
}));

vi.mock("../queries", () => ({ useMarketplacesQuery: () => hooks.list }));
vi.mock("../mutations", () => ({
  useAddMarketplaceMutation: () => ({ mutate: hooks.add, ...hooks.addState }),
}));

describe("MarketplacesListScreen", () => {
  beforeEach(() => {
    push.mockClear();
    hooks.add.mockReset();
    hooks.addState = { isPending: false, isError: false, error: null };
    hooks.list = { data: MARKETPLACES, isPending: false, isError: false, refetch: vi.fn() };
  });

  it("renders a card per marketplace and a card click navigates to its detail", async () => {
    render(<MarketplacesListScreen />);
    expect(screen.getByText("zibby-skills")).toBeInTheDocument();
    expect(screen.getByTestId(MarketplaceCardTestId.Name)).toHaveTextContent("zibby-skills");
    expect(screen.getByTestId(MarketplaceCardTestId.Percent)).toHaveTextContent("33");
    await userEvent.click(screen.getByTestId(MarketplaceCardTestId.Open));
    expect(push).toHaveBeenCalledWith("/workforce/marketplaces/zibby-skills");
  });

  it("shows the empty state without marketplaces", () => {
    hooks.list = { data: [], isPending: false, isError: false, refetch: vi.fn() };
    render(<MarketplacesListScreen />);
    expect(screen.getByTestId(MarketplacesListScreenTestId.Empty)).toBeInTheDocument();
  });

  it("the connect dialog submits the trimmed source with the dev-mode switch", async () => {
    render(<MarketplacesListScreen />);
    await userEvent.click(screen.getByTestId(MarketplacesListScreenTestId.Connect));
    await userEvent.type(screen.getByTestId(ConnectMarketplaceDialogTestId.Source), " /repo/x ");
    await userEvent.click(screen.getByTestId(ConnectMarketplaceDialogTestId.DevMode));
    await userEvent.click(screen.getByTestId(ConnectMarketplaceDialogTestId.Submit));
    expect(hooks.add).toHaveBeenCalledWith(
      { body: { source: "/repo/x", devMode: true } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("shows the CLI failure message in the dialog", async () => {
    hooks.addState = {
      isPending: false,
      isError: true,
      error: { status: 502, body: { message: "claude: boom" } },
    };
    render(<MarketplacesListScreen />);
    await userEvent.click(screen.getByTestId(MarketplacesListScreenTestId.Connect));
    expect(screen.getByTestId(ConnectMarketplaceDialogTestId.Error)).toHaveTextContent(
      "claude: boom",
    );
  });
});
