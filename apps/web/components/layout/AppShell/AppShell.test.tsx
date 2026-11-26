import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_FRAME_MAIN_CONTENT_ID,
  AppFrameTestId,
  AppHeaderTestId,
  HeaderChromeTestId,
  MenuButtonTestId,
  MobileMenuTestId,
  MobileToolbarTestId,
  SectionTrackTestId,
  SubNavTestId,
  ZibbyOverlayTestId,
  ZibbySectionTestId,
} from "@zibby/design-system";
import { renderWithProviders, screen, waitFor, within } from "../../../test/render";
import { AiEngineSwitcherTestId } from "../AiEngineSwitcher/AiEngineSwitcher";
import { ZibbyModeControlTestId } from "../../../features/autopilot";
import { PinPageDialogTestId } from "../../../features/pins";
import { SECTIONS } from "../../../state/config";
import { AppShell, AppShellTestId } from "./AppShell";

const sectionHref = (id: string) => SECTIONS.find((x) => x.id === id)?.href ?? "";
const sectionItem = (id: string) =>
  screen.getByTestId(`${SectionTrackTestId.Item}-${sectionHref(id)}`);
const openMenuOf = async (slot: AppHeaderTestId) =>
  userEvent.click(within(screen.getByTestId(slot)).getByRole("button"));

let mockPath = "/chat";
let mockPaused: boolean | undefined;
vi.mock("../../../features/autopilot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../features/autopilot")>()),
  useAutopilotQuery: () => ({
    data: mockPaused === undefined ? undefined : { paused: mockPaused, pendingApprovals: 0 },
  }),
}));
let mockPhone = false;
vi.mock("../../../features/knowledge/components/NoteDock", () => ({
  NoteDock: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-open={String(open)} data-testid="note-dock-stub">
      <button data-testid="note-dock-close" onClick={onClose} type="button" />
    </div>
  ),
}));
vi.mock("../../../hooks/useIsPhone", () => ({ useIsPhone: () => mockPhone }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(),
}));

// ZB-01: `AppShell` is rebuilt over the ZibbyOS DS `AppFrame` — a header
// (section nav, limits), the PINNED/"NEEDS YOU"/RUNNING rails and the
// page content, plus the same provider stack (catalog/new-task/chat) as
// before. `usePathname`/`useRouter`/`useSearchParams` come from the global
// `next/navigation` mock in `vitest.setup.tsx` (`usePathname` → `/chat`,
// `useSearchParams` → empty), which `sectionForPath` maps to the `org`
// section. Every data-backed slot (approvals/runs/limits/pins/system-config
// queries) never resolves in this harness (no fetch mock, `retry: false`),
// so it renders its honest pending/empty state — that state is exactly what
// these tests assert. `AppHeader`'s `operator`/`activeCount` slots are
// optional and `AppShellChrome` never fills them (there is no operator-
// identity/active-run-count source wired up yet) — they're asserted absent,
// not with stale placeholder text. (The top chrome is now the two-row redesign: zone A
// `SectionTrack`, zone B search/"+ New"/Zibby, zone C status/mode/bell/preferences.)
describe("AppShell", () => {
  it("mounts and renders its children inside the AppFrame main landmark", () => {
    renderWithProviders(
      <AppShell>
        <div>obsah stránky</div>
      </AppShell>,
    );
    expect(screen.getByTestId(AppFrameTestId.Root)).toBeInTheDocument();
    expect(screen.getByText("obsah stránky")).toBeInTheDocument();
  });

  it("mounts the skip link once, pointed at the AppFrame main-content id", () => {
    renderWithProviders(
      <AppShell>
        <div>obsah stránky</div>
      </AppShell>,
    );
    const link = screen.getByTestId(AppFrameTestId.SkipLink);
    expect(link).toHaveRole("link");
    expect(link).toHaveAttribute("href", `#${APP_FRAME_MAIN_CONTENT_ID}`);
  });

  it("renders the header's section track with the seven top-bar sections (Settings lives only in the preferences menu)", () => {
    renderWithProviders(
      <AppShell>
        <div>obsah stránky</div>
      </AppShell>,
    );
    expect(screen.getByTestId(AppHeaderTestId.Nav)).toBeInTheDocument();
    for (const id of [
      "dashboard",
      "work",
      "companies",
      "workforce",
      "activity",
      "knowledge",
      "governance",
    ]) {
      expect(sectionItem(id)).toBeInTheDocument();
    }
    expect(screen.queryByTestId(`${SectionTrackTestId.Item}-${sectionHref("system")}`)).toBeNull();
  });

  it("labels the AI section", () => {
    renderWithProviders(
      <AppShell>
        <div>obsah stránky</div>
      </AppShell>,
    );
    expect(sectionItem("workforce")).toHaveTextContent("AI");
  });

  it("offers the light/dark switch and a Settings link in the preferences menu", async () => {
    renderWithProviders(
      <AppShell>
        <div>obsah stránky</div>
      </AppShell>,
    );
    expect(screen.queryByTestId(`${MenuButtonTestId.Item}-theme`)).toBeNull();
    await openMenuOf(AppHeaderTestId.Preferences);
    expect(screen.getByTestId(`${MenuButtonTestId.Item}-theme`)).toBeInTheDocument();
    expect(screen.getByTestId(`${MenuButtonTestId.Item}-settings`)).toHaveAttribute(
      "href",
      sectionHref("system"),
    );
    expect(screen.getByTestId(`${MenuButtonTestId.Item}-about`)).toHaveAttribute(
      "href",
      "/system/settings/status",
    );
    expect(screen.getByTestId(`${MenuButtonTestId.Item}-about`)).toHaveTextContent("O systému");
  });

  it("shows the mode group and bell in zone C, no engine switcher before config loads", () => {
    renderWithProviders(
      <AppShell>
        <div>obsah stránky</div>
      </AppShell>,
    );
    expect(screen.getByTestId(HeaderChromeTestId.ModeGroup)).toHaveAccessibleName("Provozní režim");
    expect(screen.getByTestId(AppHeaderTestId.Notifications)).toBeInTheDocument();
    expect(screen.queryByTestId(AiEngineSwitcherTestId.Root)).toBeNull();
  });

  it("shows the Zibby status button and a plain, never amber, header", () => {
    renderWithProviders(
      <AppShell>
        <div />
      </AppShell>,
    );
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toBeInTheDocument();
    expect(screen.getByTestId(AppHeaderTestId.Root)).not.toHaveAttribute("data-autopilot");
  });

  it("opens the pin dialog for the current page from the sub-nav pin button", async () => {
    renderWithProviders(
      <AppShell>
        <div>obsah stránky</div>
      </AppShell>,
    );
    expect(screen.queryByTestId(PinPageDialogTestId.Name)).toBeNull();
    await userEvent.click(screen.getByTestId(AppShellTestId.PinToggle));
    expect(screen.getByTestId(PinPageDialogTestId.Name)).toBeInTheDocument();
  });

  it("offers no pin button on the Bridge (/dashboard)", () => {
    mockPath = "/dashboard";
    try {
      renderWithProviders(
        <AppShell>
          <div />
        </AppShell>,
      );
      expect(screen.queryByTestId(AppShellTestId.PinToggle)).toBeNull();
    } finally {
      mockPath = "/chat";
    }
  });

  it("has no left rail or activity dock", () => {
    renderWithProviders(
      <AppShell>
        <div>obsah stránky</div>
      </AppShell>,
    );
    expect(screen.queryByTestId(AppFrameTestId.Rail)).toBeNull();
  });

  it.each([
    ["/projects/cms4/integrations", "/projects"],
    ["/work/workflows", "/work/workflows"],
  ])("marks the owning sub-nav tab current on %s", (path, href) => {
    mockPath = path;
    try {
      renderWithProviders(
        <AppShell>
          <div>obsah stránky</div>
        </AppShell>,
      );
      expect(screen.getByTestId(`${SubNavTestId.Item}-${href}`)).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(
        screen
          .getAllByTestId(new RegExp(`^${SubNavTestId.Item}-`))
          .filter((el) => el.getAttribute("aria-current") === "page"),
      ).toHaveLength(1);
    } finally {
      mockPath = "/chat";
    }
  });

  it.each([
    ["/system/registries/hooks/foo", "/system/registries/hooks"],
    ["/system/registries/mcp/x", "/system/registries/mcp"],
  ])("highlights the owning sub-tab for %s", (path, tabHref) => {
    mockPath = path;
    try {
      renderWithProviders(
        <AppShell>
          <div />
        </AppShell>,
      );
      expect(screen.getByTestId(`${SubNavTestId.Item}-${tabHref}`)).toHaveAttribute(
        "aria-current",
        "page",
      );
    } finally {
      mockPath = "/chat";
    }
  });

  it("offers New task in the + New menu except on the new-task page itself", async () => {
    const { unmount } = renderWithProviders(
      <AppShell>
        <div />
      </AppShell>,
    );
    await openMenuOf(AppHeaderTestId.Create);
    expect(screen.getByTestId(`${MenuButtonTestId.Item}-new-task`)).toHaveTextContent("Nový úkol");
    unmount();
    mockPath = "/work/tasks/new";
    try {
      renderWithProviders(
        <AppShell>
          <div />
        </AppShell>,
      );
      await openMenuOf(AppHeaderTestId.Create);
      expect(screen.queryByTestId(`${MenuButtonTestId.Item}-new-task`)).toBeNull();
      expect(screen.getByTestId(`${MenuButtonTestId.Item}-new-note`)).toBeInTheDocument();
    } finally {
      mockPath = "/chat";
    }
  });

  it("keeps New task / New note out of the sub-nav row", () => {
    renderWithProviders(
      <AppShell>
        <div />
      </AppShell>,
    );
    const actions = screen.getByTestId(SubNavTestId.Actions);
    expect(actions).toContainElement(screen.getByTestId(AppShellTestId.PinToggle));
    expect(within(actions).queryByTestId(HeaderChromeTestId.NewButton)).toBeNull();
  });
});

describe("AppShell header: create menu and Zibby", () => {
  const renderShell = () =>
    renderWithProviders(
      <AppShell>
        <div />
      </AppShell>,
    );

  it("shows the Zibby summon chip in the header's trailing cluster", () => {
    renderShell();
    const slot = screen.getByTestId(AppHeaderTestId.Zibby);
    expect(screen.getAllByTestId(ZibbyModeControlTestId.Root)).toHaveLength(1);
    expect(slot).toContainElement(screen.getByTestId(ZibbyModeControlTestId.Root));
    expect(screen.getByTestId(ZibbyModeControlTestId.Root)).toHaveTextContent("Zibby");
    expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).not.toBeInTheDocument();
  });

  it("summons the overlay from the chip (and the chip toggles it closed)", async () => {
    renderShell();
    await userEvent.click(screen.getByTestId(ZibbyModeControlTestId.Root));
    expect(screen.getByTestId(ZibbyOverlayTestId.Root)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(ZibbyModeControlTestId.Root));
    await waitFor(() =>
      expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).not.toBeInTheDocument(),
    );
  });

  it("opens the note window and closes the Zibby overlay", async () => {
    renderShell();
    expect(screen.getByTestId("note-dock-stub")).toHaveAttribute("data-open", "false");
    await userEvent.click(screen.getByTestId(ZibbyModeControlTestId.Root));
    expect(screen.getByTestId(ZibbyOverlayTestId.Root)).toBeInTheDocument();
    await openMenuOf(AppHeaderTestId.Create);
    await userEvent.click(screen.getByTestId(`${MenuButtonTestId.Item}-new-note`));
    expect(screen.getByTestId("note-dock-stub")).toHaveAttribute("data-open", "true");
    await waitFor(() =>
      expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).not.toBeInTheDocument(),
    );
  });
});

describe("AppShell top menu sections", () => {
  it.each([
    ["/work/automations", "work"],
    ["/system/registries/skills", "workforce"],
    ["/workforce/agents/writer", "workforce"],
    ["/governance/spend", "governance"],
  ])("highlights the %s top tab", (path, id) => {
    mockPath = path;
    try {
      renderWithProviders(
        <AppShell>
          <div />
        </AppShell>,
      );
      expect(sectionItem(id)).toHaveAttribute("aria-current", "page");
    } finally {
      mockPath = "/chat";
    }
  });
});

describe("AppShell phone layout", () => {
  const renderPhone = (path = "/work/workflows") => {
    mockPhone = true;
    mockPath = path;
    return renderWithProviders(
      <AppShell>
        <div>obsah stránky</div>
      </AppShell>,
    );
  };
  afterEach(() => {
    mockPhone = false;
    mockPath = "/chat";
  });

  it("replaces the header with a toolbar: menu, brand, section title and icon actions", () => {
    renderPhone();
    expect(screen.getByTestId(MobileToolbarTestId.Root)).toBeInTheDocument();
    expect(screen.getByTestId(MobileMenuTestId.Trigger)).toHaveAccessibleName("Menu");
    expect(screen.queryByTestId(AppHeaderTestId.Root)).toBeNull();
    expect(screen.queryByTestId(AppFrameTestId.Rail)).toBeNull();
    expect(screen.getByTestId(MobileToolbarTestId.Brand)).toBeInTheDocument();
    expect(screen.getByTestId(MobileToolbarTestId.Title)).toHaveTextContent("Práce");
    const actions = screen.getByTestId(MobileToolbarTestId.Actions);
    expect(actions).toContainElement(screen.getByTestId(HeaderChromeTestId.NewButton));
    expect(screen.getByTestId(HeaderChromeTestId.NewButton)).toHaveTextContent("");
    expect(actions).toContainElement(screen.getByTestId(ZibbySectionTestId.StatusButton));
    // Phone: no keyboard — the Zibby orb button is icon-only.
    expect(actions).toContainElement(screen.getByTestId(ZibbyModeControlTestId.Root));
    expect(screen.getByTestId(ZibbyModeControlTestId.Root)).toHaveTextContent("");
    expect(screen.queryByTestId(MobileToolbarTestId.Banner)).toBeNull();
  });

  it("renders the sub-nav row with the pin and page actions", () => {
    renderPhone();
    const subnav = screen.getByTestId(AppFrameTestId.SubNav);
    expect(subnav).toContainElement(screen.getByTestId(`${SubNavTestId.Item}-/work/workflows`));
    expect(subnav).toContainElement(screen.getByTestId(AppShellTestId.PinToggle));
    expect(subnav).toContainElement(screen.getByTestId(AppShellTestId.PageActions));
  });

  it("shows no paused band while running", () => {
    renderPhone();
    expect(screen.queryByTestId(MobileToolbarTestId.Banner)).toBeNull();
  });

  it("shows the grey paused band with a Resume action while paused", () => {
    mockPaused = true;
    try {
      renderPhone();
      expect(screen.getByTestId(MobileToolbarTestId.Banner)).toHaveTextContent(
        "Autonomie pozastavena",
      );
      expect(screen.getByTestId(MobileToolbarTestId.BannerAction)).toHaveTextContent("Pustit");
    } finally {
      mockPaused = undefined;
    }
  });

  it("opens the section tree with the active section expanded", async () => {
    renderPhone();
    await userEvent.click(screen.getByTestId(MobileMenuTestId.Trigger));
    expect(screen.getByTestId(`${MobileMenuTestId.Item}-/work/workflows`)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("hides New task in the + menu on the new-task page", async () => {
    renderPhone("/work/tasks/new");
    await userEvent.click(screen.getByTestId(HeaderChromeTestId.NewButton));
    expect(screen.queryByTestId(`${MenuButtonTestId.Item}-new-task`)).toBeNull();
    expect(screen.getByTestId(`${MenuButtonTestId.Item}-new-note`)).toBeInTheDocument();
  });
});
