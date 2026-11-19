import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type AutopilotStatus, NO_AUTOMATION } from "@zibby/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_TOKEN_STORAGE_KEY } from "../../../state/operatorToken";
import { renderAutonomy } from "../test/renderAutonomy";
import { AutomatConfirmTestId } from "./AutomatConfirmDialog";
import { ZibbyModeControl } from "./ZibbyModeControl";
import { ZibbyModePanelTestId } from "./ZibbyModePanel";

let status: AutopilotStatus = { level: "off", pendingApprovals: 3 };
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
  localStorage.setItem(OPERATOR_TOKEN_STORAGE_KEY, "zby_op_x");
  status = {
    level: "off",
    pendingApprovals: 3,
    automation: {
      global: { ...NO_AUTOMATION },
      companies: { acme: { autoReview: true } },
      teams: {},
    },
  };
});

const openPanel = () => userEvent.click(screen.getByRole("button", { name: /Režim Zibbyho: / }));

describe("ZibbyModeControl", () => {
  it("opens Zibby from the orb and the mode popover from the mode button", async () => {
    renderAutonomy(<ZibbyModeControl />);
    await userEvent.click(screen.getByRole("button", { name: /Vyvolat Zibbyho/ }));
    expect(openChat).toHaveBeenCalled();
    await openPanel();
    expect(screen.getByTestId(ZibbyModePanelTestId.Pending)).toHaveTextContent(
      "3 schválení čekají",
    );
    expect(screen.getByTestId(ZibbyModePanelTestId.Levels)).toHaveTextContent("Acme");
  });

  it("switching down sends only the level and closes; Manuál does nothing", async () => {
    status = { ...status, level: "full" };
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    await userEvent.click(screen.getByTestId("zibby-mode-card-manual"));
    expect(mutate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("zibby-mode-card-semi"));
    expect(mutate).toHaveBeenCalledWith({ body: { level: "off" } }, expect.anything());
    await waitFor(() => expect(screen.queryByTestId(ZibbyModePanelTestId.Root)).toBeNull());
  });

  it("switching to Automat asks first, then sends the tree with global all-off", async () => {
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    await userEvent.click(screen.getByTestId("zibby-mode-card-auto"));
    expect(mutate).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByTestId(AutomatConfirmTestId.Confirm));
    expect(mutate).toHaveBeenCalledWith(
      {
        body: {
          level: "full",
          automation: {
            global: { ...NO_AUTOMATION },
            companies: { acme: { autoReview: true } },
            teams: {},
          },
        },
      },
      expect.anything(),
    );
  });
});
