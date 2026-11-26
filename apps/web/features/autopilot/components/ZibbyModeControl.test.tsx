import { createEvent, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type AutopilotStatus, NO_AUTOMATION } from "@zibby/contracts";
import {
  Button,
  StepSliderTestId,
  ZibbySectionTestId,
  ZibbyStatusMenuTestId,
} from "@zibby/design-system";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOMATION_KEYS } from "../autonomy";
import { renderAutonomy } from "../test/renderAutonomy";
import { ZibbyModeChange, ZibbyModeControl, ZibbyModeControlTestId } from "./ZibbyModeControl";
import { ZibbyModePanelTestId } from "./ZibbyModePanel";

let status: AutopilotStatus = { paused: false, pendingApprovals: 3 };
const mutate = vi.fn();
const mutateAsync = vi.fn();
const openChat = vi.fn();

vi.mock("../../companies", () => ({
  useCompaniesQuery: () => ({ data: [{ id: "acme", name: "Acme" }] }),
}));
vi.mock("../../teams", () => ({ useTeamsQuery: () => ({ data: [] }) }));
vi.mock("../queries", () => ({ useAutopilotQuery: () => ({ data: status }) }));
vi.mock("../mutations", () => ({
  useSetAutopilotMutation: () => ({ mutate, mutateAsync, isPending: false }),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
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
  mutateAsync.mockReset();
  localStorage.clear();
  openChat.mockReset();
  status = {
    paused: false,
    pendingApprovals: 3,
    automation: {
      global: { ...NO_AUTOMATION },
      companies: { acme: { autoReview: "auto" } },
      teams: {},
      projects: {},
    },
  };
});

const openPanel = () => userEvent.click(screen.getByTestId(ZibbySectionTestId.StatusButton));

describe("ZibbyModeControl", () => {
  it("opens Zibby from the orb and the status popover from the status button", async () => {
    renderAutonomy(<ZibbyModeControl />);
    expect(screen.getByTestId(ZibbySectionTestId.Root)).toHaveAttribute("data-status", "paused");
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toHaveTextContent("Ručně");
    await userEvent.click(screen.getByTestId(ZibbyModeControlTestId.Root));
    expect(openChat).toHaveBeenCalled();
    await openPanel();
    expect(screen.getByTestId(ZibbyStatusMenuTestId.Head)).toHaveTextContent("Ručně");
    expect(screen.getByTestId(ZibbyModePanelTestId.Pending)).toHaveTextContent(
      "3 schválení čekají",
    );
    expect(screen.getByTestId(ZibbyModePanelTestId.Levels)).toHaveTextContent("Výjimky: Acme");
  });

  it("never says Zibby runs: the all-manual default reads Ručně", () => {
    status = { paused: false, pendingApprovals: 0 };
    renderAutonomy(<ZibbyModeControl />);
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toHaveTextContent("Ručně");
    expect(screen.queryByText(/Běží/)).toBeNull();
    expect(screen.getByTestId(ZibbySectionTestId.Root)).toHaveAttribute("data-status", "paused");
  });

  it("shows Poloautomat when every global capability is semi", () => {
    status = {
      paused: false,
      pendingApprovals: 0,
      automation: {
        global: Object.fromEntries(AUTOMATION_KEYS.map((k) => [k, "semi"])) as never,
        companies: {},
        teams: {},
        projects: {},
      },
    };
    renderAutonomy(<ZibbyModeControl />);
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toHaveTextContent("Poloautomat");
  });

  it("shows Smíšené while the global capabilities differ", () => {
    status = {
      paused: false,
      pendingApprovals: 0,
      automation: {
        global: { ...NO_AUTOMATION, autoReview: "auto" },
        companies: {},
        teams: {},
        projects: {},
      },
    };
    renderAutonomy(<ZibbyModeControl />);
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toHaveTextContent("Smíšené");
  });

  it("has no resume button while autonomy is active", async () => {
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    expect(screen.queryByTestId(ZibbyModePanelTestId.Resume)).toBeNull();
  });

  it("paused: reads Autonomie pozastavena, offers Resume (PUT paused:false), no link to the page for it", async () => {
    status = { paused: true, pendingApprovals: 0 };
    renderAutonomy(<ZibbyModeControl />);
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toHaveTextContent(
      "Autonomie pozastavena",
    );
    await openPanel();
    expect(screen.queryByTestId(ZibbyModePanelTestId.Pending)).toBeNull();
    expect(screen.getByTestId(ZibbyModePanelTestId.Levels)).toHaveTextContent("Bez výjimek");
    await userEvent.click(screen.getByTestId(ZibbyModePanelTestId.Resume));
    expect(mutate.mock.calls[0]?.[0]).toEqual({ body: { paused: false } });
    expect(push).not.toHaveBeenCalled();
  });

  it("resume without a stored token: 401 shows the token field, saving it retries the resume", async () => {
    status = { paused: true, pendingApprovals: 0 };
    mutate.mockImplementationOnce((_v, opts) => opts.onError({ status: 401 }));
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    await userEvent.click(screen.getByTestId(ZibbyModePanelTestId.Resume));
    expect(await screen.findByTestId(ZibbyModePanelTestId.ResumeError)).toHaveTextContent(
      "operátorský token",
    );
    await userEvent.type(screen.getByTestId(ZibbyModePanelTestId.TokenInput), "zby_op_x");
    await userEvent.click(screen.getByTestId(ZibbyModePanelTestId.TokenSave));
    expect(localStorage.getItem("zibby.operatorToken")).toBe("zby_op_x");
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[1]?.[0]).toEqual({ body: { paused: false } });
  });

  it("sets every global capability to the clicked step, keeping overrides", async () => {
    mutateAsync.mockResolvedValue({});
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    expect(screen.getByTestId(StepSliderTestId.Thumb)).toHaveAttribute("aria-valuetext", "Ručně");
    await userEvent.click(screen.getByTestId(`${StepSliderTestId.Step}-auto`));
    const body = mutateAsync.mock.calls[0]?.[0].body;
    expect(Object.values(body.automation.global)).toEqual(AUTOMATION_KEYS.map(() => "auto"));
    expect(body.automation.companies).toEqual({ acme: { autoReview: "auto" } });
    expect(body.paused).toBeUndefined();
    await userEvent.click(screen.getByTestId(`${StepSliderTestId.Step}-semi`));
    expect(Object.values(mutateAsync.mock.calls[1]?.[0].body.automation.global)).toEqual(
      AUTOMATION_KEYS.map(() => "semi"),
    );
  });

  it("moves with the keyboard", async () => {
    mutateAsync.mockResolvedValue({});
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    fireEvent.keyDown(screen.getByTestId(StepSliderTestId.Thumb), { key: "ArrowRight" });
    expect(mutateAsync.mock.calls[0]?.[0].body.automation.global.autoReview).toBe("semi");
  });

  it("snaps a dragged thumb to the nearest step on release", async () => {
    mutateAsync.mockResolvedValue({});
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    const track = screen.getByTestId(StepSliderTestId.Track);
    track.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
    // jsdom has no PointerEvent, so clientX must be set on the event by hand.
    const at = (type: "pointerDown" | "pointerUp", clientX: number) => {
      const ev = createEvent[type](track, { pointerId: 1 });
      Object.defineProperty(ev, "clientX", { value: clientX });
      fireEvent(track, ev);
    };
    at("pointerDown", 20);
    at("pointerUp", 290);
    expect(mutateAsync.mock.calls[0]?.[0].body.automation.global.autoReview).toBe("auto");
  });

  it("shows no exact step while the global capabilities are mixed", async () => {
    status = {
      ...status,
      automation: {
        global: { ...NO_AUTOMATION, autoReview: "auto" },
        companies: {},
        teams: {},
        projects: {},
      },
    };
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    expect(screen.getByTestId(StepSliderTestId.Thumb)).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByTestId(StepSliderTestId.Mixed)).toHaveTextContent("Smíšené");
  });

  it("asks for the operator token on 401, stores it and retries the chosen level", async () => {
    mutateAsync.mockRejectedValueOnce({ status: 401 }).mockResolvedValue({});
    renderAutonomy(<ZibbyModeControl />);
    await openPanel();
    await userEvent.click(screen.getByTestId(`${StepSliderTestId.Step}-auto`));
    expect(await screen.findByTestId(ZibbyModePanelTestId.AutoError)).toHaveTextContent(
      "operátorský token",
    );
    await userEvent.type(screen.getByTestId(ZibbyModePanelTestId.TokenInput), "zby_op_x");
    await userEvent.click(screen.getByTestId(ZibbyModePanelTestId.TokenSave));
    expect(localStorage.getItem("zibby.operatorToken")).toBe("zby_op_x");
    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[1]?.[0].body.automation.global.autoReview).toBe("auto");
  });

  it("turns the pill amber in full Automat and grey again when paused", () => {
    status = {
      paused: false,
      pendingApprovals: 0,
      automation: {
        global: Object.fromEntries(AUTOMATION_KEYS.map((k) => [k, "auto"])) as never,
        companies: {},
        teams: {},
        projects: {},
      },
    };
    const { unmount } = renderAutonomy(<ZibbyModeControl />);
    expect(screen.getByTestId(ZibbySectionTestId.Root)).toHaveAttribute("data-status", "auto");
    expect(screen.getByTestId(ZibbySectionTestId.StatusButton)).toHaveTextContent("Automat");
    unmount();
    status = { ...status, paused: true };
    renderAutonomy(<ZibbyModeControl />);
    expect(screen.getByTestId(ZibbySectionTestId.Root)).toHaveAttribute("data-status", "paused");
  });
});

describe("ZibbyModeChange", () => {
  it("opens the same status sheet from its trigger", async () => {
    status = { paused: true, pendingApprovals: 0 };
    renderAutonomy(
      <ZibbyModeChange renderTrigger={(open) => <Button onClick={open}>open</Button>} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByTestId(ZibbyModePanelTestId.Resume)).toBeInTheDocument();
  });
});
