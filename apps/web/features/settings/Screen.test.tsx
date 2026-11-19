import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderSettings as render, screen } from "./testing/renderSettings";
import { AppearanceProvider } from "../../state/appearance";
import { TabsTestId } from "@zibby/design-system";
import { SettingsScreen } from "./Screen";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("../health", () => ({
  useHealthQuery: () => ({
    data: { uptime: 3725, watchers: [] },
    isSuccess: true,
  }),
}));

beforeEach(() => {
  refresh.mockReset();
  localStorage.clear();
  // Expire any cookie a previous test left behind.
  document.cookie = "locale=; path=/; max-age=0";
});

describe("SettingsScreen — /system/settings/[section]", () => {
  it("renders the page title in the layout", () => {
    render(<SettingsScreen section="general" />);
    expect(screen.getByRole("heading", { name: "Obecné" })).toBeInTheDocument();
  });

  it("has no secondary section tab row — sections live in the sub-nav", () => {
    render(<SettingsScreen section="general" />);
    expect(screen.queryByTestId(TabsTestId.List)).toBeNull();
  });

  it("shows the general section's content without its own sub-nav", () => {
    render(<SettingsScreen section="general" />);
    expect(screen.queryByTestId("subnav-root")).toBeNull();
    expect(screen.getByText("Jazyk rozhraní")).toBeInTheDocument();
  });

  it("renders the status section's system panel", () => {
    render(<SettingsScreen section="status" />);
    expect(screen.getByText("Démon")).toBeInTheDocument();
  });

  it("aggregates the appearance theme control on the general section", () => {
    // `AppearanceSection` reads `useAppearance()` — `AppearanceProvider` isn't
    // part of the shared `renderWithProviders` shell, so this one test brings
    // its own (it also happens to supply the real `DesignSystemProvider`).
    render(
      <AppearanceProvider>
        <SettingsScreen section="general" />
      </AppearanceProvider>,
    );
    expect(screen.getByTestId("segmented-control-item-system")).toBeInTheDocument();
  });

  it("writes the locale cookie and refreshes the page on language change", async () => {
    render(<SettingsScreen section="general" />);
    await userEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(document.cookie).toContain("locale=en");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows no butler footer on any section", () => {
    render(<SettingsScreen section="general" />);
    expect(screen.queryByText(/Brainy Butler/)).not.toBeInTheDocument();
  });
});
