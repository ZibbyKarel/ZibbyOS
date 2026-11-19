import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type AutopilotStatus, NO_AUTOMATION } from "@zibby/contracts";
import { Button, ZibbySectionTestId, ZibbyStatusMenuTestId } from "@zibby/design-system";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAutonomy } from "../test/renderAutonomy";
import { ZibbyModeChange, ZibbyModeControl, ZibbyModeControlTestId } from "./ZibbyModeControl";
import { ZibbyModePanelTestId } from "./ZibbyModePanel";

let status: AutopilotStatus = { paused: false, pendingApprovals: 3 };
const mutate = vi.fn();
const openChat = vi.fn();

vi.mock("../../companies", () => ({
  useCompaniesQuery: () => ({ data: [{ id: "acme", name: "Acme" }] }),
}));
vi.mock("../../teams", () => ({ useTeamsQuery: () => ({ data: [] }) }));
vi.mock("../queries", () => ({ useAutopilotQuery: () => ({ data: status }) }));
vi.mock("../mutations", () => ({
  useSetAutopilotMutation: () => ({ mutate, isPending: false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../chat/ChatContext", () => ({
  useChat: () => ({ dockOpen: false, open: openChat, setDockOpen: vi.fn() }),
}));
vi.mock("../../zibby/live/ZibbyLiveContext", () => ({
  useZibbyLive: () => ({ phase: "closed", orbState: "ready" }),
}));
vi.mock("../../zibby/shortcut/useZibbyShortcut", () => ({
  useZibbyShortcut: () => ({ shortcut: {} }),
  useShortcutPlatform: () => "mac",
}));
vi.mock("../../zibby/shortcut/shortcut", () => ({ formatShortcut: () => ["⌥", "Space"] }));

beforeEach(() => {
  mutate.mockReset();
  openChat.mockReset();
  status = {
    paused: false,
    pendingApprovals: 3,
    automation: {
      global: { ...NO_AUTOMATION },
      companies: { acme: { autoReview: "auto" } },
      teams: {},
    },
  };
});

const openPanel = () => userEvent.click(screen.getByTestId(ZibbySectionTestId.StatusButton));

describe("ZibbyModeControl", () => {
  it("opens Zibby from the orb and the status popover from the status button", async () => {
    renderAutonomy(<ZibbyModeControl />);
    expect(screen.getByTestId(ZibbySectionTestId.Root)).toHaveAttribute("data-status", "run");
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toHaveTextContent("Běží");
    await userEvent.click(screen.getByTestId(ZibbyModeControlTestId.Root));
    expect(openChat).toHaveBeenCalled();
    await openPanel();
    expect(screen.getByTestId(ZibbyStatusMenuTestId.Head)).toHaveTextContent(
      "Běží · Zibby přemýšlí",
    );
    expect(screen.getByTestId(ZibbyModePanelTestId.Pending)).toHaveTextContent(
      "3 schválení čekají",
    );
    expect(screen.getByTestId(ZibbyModePanelTestId.Levels)).toHaveTextContent("Výjimky: Acme");
  });

  it("pauses with one click and no confirmation", async () => {
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    await userEvent.click(screen.getByTestId(ZibbyStatusMenuTestId.Action));
    expect(mutate).toHaveBeenCalledWith({ body: { paused: true } }, expect.anything());
  });

  it("shows Pozastaveno and offers to resume; no pending link without approvals", async () => {
    status = { paused: true, pendingApprovals: 0 };
    renderAutonomy(<ZibbyModeControl />);
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toHaveTextContent("Pozastaveno");
    await openPanel();
    expect(screen.getByTestId(ZibbyStatusMenuTestId.Action)).toHaveTextContent("Pustit Zibbyho");
    expect(screen.queryByTestId(ZibbyModePanelTestId.Pending)).toBeNull();
    expect(screen.getByTestId(ZibbyModePanelTestId.Levels)).toHaveTextContent("Bez výjimek");
    await userEvent.click(screen.getByTestId(ZibbyStatusMenuTestId.Action));
    expect(mutate).toHaveBeenCalledWith({ body: { paused: false } }, expect.anything());
  });

  it("surfaces a missing operator token on resume with an unlock link", async () => {
    status = { paused: true, pendingApprovals: 0 };
    mutate.mockImplementation((_vars, opts: { onError: (e: unknown) => void }) =>
      opts.onError({ status: 401 }),
    );
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    await userEvent.click(screen.getByTestId(ZibbyStatusMenuTestId.Action));
    expect(screen.getByTestId(ZibbyModePanelTestId.Error)).toHaveTextContent("operátorský token");
    expect(screen.getByTestId(ZibbyModePanelTestId.Unlock)).toBeInTheDocument();
  });
});

describe("ZibbyModeChange", () => {
  it("opens the same status sheet from its trigger", async () => {
    status = { paused: true, pendingApprovals: 0 };
    renderAutonomy(
      <ZibbyModeChange renderTrigger={(open) => <Button onClick={open}>open</Button>} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByTestId(ZibbyStatusMenuTestId.Action)).toHaveTextContent("Pustit Zibbyho");
  });
});
