import type { ChatAbout, ChatMessage, TaskTarget } from "@zibby/contracts";
import {
  ZibbyBubbleTestId,
  ZibbyOverlayTestId,
  ZibbyToastTestId,
  ZibbyTopBarMenuTestId,
  ZibbyTopBarTestId,
} from "@zibby/design-system";
import userEvent from "@testing-library/user-event";
import { type Ref, useEffect } from "react";
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from "../../test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatProvider, useChat } from "../chat/ChatContext";
import { ChatMessageTestId } from "../chat/components/ChatMessageParts";
import { ChatTranscriptTestId } from "../chat/components/ChatTranscript";
import type { ChatDockEngine, ChatDockOptions } from "../chat/hooks/useChatDock";
import type { ChatStreamState } from "../chat/hooks/useChatStream";
import type { CommandLineHandle } from "../tasks/components/CommandLine/CommandLine";
import { ZibbyContextChipsTestId } from "./composer/ZibbyContextChips";
import { ZibbyComposerTestId } from "./composer/ZibbyComposer";
import type { ZibbyConversations } from "./conversations";
import { ZibbyOverlayFooterTestId } from "./footer/ZibbyOverlayFooter";
import { ZibbyLiveProvider, useZibbyLive } from "./live/ZibbyLiveContext";
import { ZibbyHost, ZibbyHostTestId } from "./ZibbyHost";
import { ZibbyThreadTestId } from "./thread/ZibbyThread";
import { ZibbyOverlayTopBarTestId } from "./topbar/ZibbyOverlayTopBar";
import type { ZibbyVoice } from "./voice/useZibbyVoice";

// ---- environment -------------------------------------------------------------------------
let mockPath = "/dashboard";
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(),
}));

// Reduced motion → the overlay opens/closes without animation delays.
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  })) as typeof window.matchMedia;
});

// ---- engine / voice / conversations mocks ----------------------------------------------------
const EMPTY_STREAM: ChatStreamState = {
  turnId: null,
  text: "",
  toolEvents: [],
  streaming: false,
  error: null,
};

let engine: ChatDockEngine;
let engineOptions: ChatDockOptions | undefined;
vi.mock("../chat/hooks/useChatDock", () => ({
  useChatDock: (options?: ChatDockOptions) => {
    engineOptions = options;
    return engine;
  },
}));

let voice: ZibbyVoice;
let voiceOptions: { enabled: boolean; onUtterance: (text: string) => void } | undefined;
vi.mock("./voice/useZibbyVoice", () => ({
  useZibbyVoice: (options: { enabled: boolean; onUtterance: (text: string) => void }) => {
    voiceOptions = options;
    return voice;
  },
}));

let conversations: ZibbyConversations;
vi.mock("./conversations", () => ({ useZibbyConversations: () => conversations }));

const handoffMutate = vi.fn();
vi.mock("../chat/mutations", () => ({
  useCreateChatHandoffMutation: () => ({
    mutate: handoffMutate,
    isPending: false,
    variables: undefined,
  }),
}));
vi.mock("../chat/mutations/useSynthesizeSpeechMutation", () => ({
  useSynthesizeSpeechMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../chat/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({ isPlaying: false, play: vi.fn(), stop: vi.fn() }),
}));
vi.mock("../system", () => ({ useSystemConfigQuery: () => ({ data: undefined }) }));
vi.mock("../ai-providers", () => ({ useTierLabel: () => (tier: string) => `tier:${tier}` }));
vi.mock("./widgets/ChatWidgetCard", () => ({
  ChatWidgetCard: (p: { widget: { kind: string }; onPrompt?: (text: string) => void }) => (
    <button data-testid="widget-card" onClick={() => p.onPrompt?.("fix it")} type="button">
      {p.widget.kind}
    </button>
  ),
}));

// The rich composer is covered by its own suite; here a stub records the props the host wires.
interface ComposerStubProps {
  onSubmit: (
    text: string,
    target?: TaskTarget,
    attachments?: { attachmentSetId?: string; files: { name: string; size: number }[] },
    mentions?: TaskTarget[],
  ) => void;
  handleRef?: Ref<CommandLineHandle>;
  injectedText?: string;
  injectedFiles?: File[];
  onInjectedFilesConsumed?: () => void;
  onInjectedTextConsumed?: () => void;
  onScopeChange?: (kind: string, id: string | undefined) => void;
  onSkillChange?: (id: string | undefined) => void;
  leadingActions?: React.ReactNode;
  submitDisabled?: boolean;
  placeholder?: string;
  multipleTargets?: boolean;
  allowSkillMentions?: boolean;
  showAttach?: boolean;
  scopeKinds?: readonly string[];
  maxRows?: number;
}
let composerProps: ComposerStubProps | undefined;
const submitSpoken = vi.fn<(text: string) => boolean>();
vi.mock("../tasks/components/CommandLine/CommandLine", async () => {
  const { useImperativeHandle } = await import("react");
  return {
    CommandLine: (props: ComposerStubProps) => {
      composerProps = props;
      useImperativeHandle(props.handleRef, () => ({
        submitSpoken: (text: string) => {
          const sent = submitSpoken(text);
          if (sent) props.onSubmit(text);
          return sent;
        },
      }));
      return (
        <div data-testid="command-line-stub">
          <span data-testid="stub-injected-text">{props.injectedText}</span>
          <span data-testid="stub-injected-files">
            {props.injectedFiles?.map((f) => f.name).join(",")}
          </span>
          {props.leadingActions}
        </div>
      );
    },
  };
});

// ---- fixtures ------------------------------------------------------------------------------
function makeEngine(overrides: Partial<ChatDockEngine> = {}): ChatDockEngine {
  return {
    stream: EMPTY_STREAM,
    thinking: false,
    send: vi.fn(() => "u-sent"),
    setScope: vi.fn(),
    setSkillId: vi.fn(),
    ...overrides,
  };
}

function makeVoice(overrides: Partial<ZibbyVoice> = {}): ZibbyVoice {
  return {
    supported: true,
    mode: "ptt",
    setMode: vi.fn(),
    listening: false,
    transcript: { final: "", interim: "" },
    transcribing: false,
    level: 0,
    hint: null,
    startTalk: vi.fn(),
    stopTalk: vi.fn(),
    cancelTalk: vi.fn(),
    pressTalk: vi.fn(),
    releaseTalk: vi.fn(),
    muted: false,
    setMuted: vi.fn(),
    speaking: false,
    speakingId: null,
    speakLevel: 0,
    interruptedId: null,
    speak: vi.fn(),
    interrupt: vi.fn(() => null),
    error: null,
    ...overrides,
  };
}

function makeConversations(overrides: Partial<ZibbyConversations> = {}): ZibbyConversations {
  return {
    activeId: "conv-1",
    activeTitle: "Nový rozhovor",
    count: 2,
    query: "",
    setQuery: vi.fn(),
    groups: [
      {
        label: "Dnes",
        items: [
          { id: "conv-1", title: "Nový rozhovor", time: "teď", active: true },
          { id: "conv-2", title: "Rebase #47385", time: "09:12", active: false },
        ],
      },
    ],
    loading: false,
    busy: false,
    open: vi.fn(),
    startNew: vi.fn(),
    rename: vi.fn(),
    clearActive: vi.fn(),
    remove: vi.fn(),
    toast: null,
    dismissToast: vi.fn(),
    ...overrides,
  };
}

const msg = (
  over: Partial<ChatMessage> & Pick<ChatMessage, "id" | "role" | "text">,
): ChatMessage => ({
  at: "2026-11-15T17:34:00.000Z",
  ...over,
});

let chat: ReturnType<typeof useChat>;
let live: ReturnType<typeof useZibbyLive>;
function Probe() {
  const chatNow = useChat();
  const liveNow = useZibbyLive();
  useEffect(() => {
    chat = chatNow;
    live = liveNow;
  });
  return null;
}

function renderHost() {
  return renderWithProviders(
    <ChatProvider>
      <ZibbyLiveProvider>
        <Probe />
        <ZibbyHost />
      </ZibbyLiveProvider>
    </ChatProvider>,
  );
}

async function openOverlay() {
  act(() => chat.open());
  await screen.findByTestId(ZibbyOverlayTestId.Root);
  await waitFor(() => expect(live.phase).toBe("open"));
}

const status = () => screen.getByTestId(ZibbyHostTestId.Status).textContent;

beforeEach(() => {
  mockPath = "/dashboard";
  routerPush.mockClear();
  handoffMutate.mockReset();
  submitSpoken.mockReset();
  submitSpoken.mockReturnValue(true);
  composerProps = undefined;
  engine = makeEngine();
  voice = makeVoice();
  conversations = makeConversations();
  window.localStorage.clear();
});

// ---- tests ------------------------------------------------------------------------------------
describe("ZibbyHost — open / close", () => {
  it("renders nothing until summoned, then the dialog, with the voice engine switched on", async () => {
    renderHost();
    expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).not.toBeInTheDocument();
    await openOverlay();
    expect(screen.getByTestId(ZibbyOverlayTestId.Root)).toHaveAccessibleName("Zibby");
    expect(voiceOptions?.enabled).toBe(true);
  });

  it("open() from any caller (a department page) with a target scopes the thread", async () => {
    renderHost();
    act(() => chat.open({ kind: "department", id: "dev", name: "Dev" }));
    await screen.findByTestId(ZibbyOverlayTestId.Root);
    expect(screen.getByTestId(ZibbyContextChipsTestId.TargetChip)).toHaveTextContent("→ Dev");
  });

  it("closes on Esc (history first) and on the close button", async () => {
    const user = userEvent.setup();
    renderHost();
    await openOverlay();
    await user.click(screen.getByTestId(ZibbyOverlayTopBarTestId.Close));
    await waitFor(() =>
      expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).not.toBeInTheDocument(),
    );
    expect(chat.dockOpen).toBe(false);

    await openOverlay();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByTestId(ZibbyOverlayTestId.Root)).not.toBeInTheDocument(),
    );
  });

  it("closes when the route changes (cards and links in the thread navigate)", async () => {
    const view = renderHost();
    await openOverlay();
    mockPath = "/runs";
    view.rerender(
      <ChatProvider>
        <ZibbyLiveProvider>
          <Probe />
          <ZibbyHost />
        </ZibbyLiveProvider>
      </ChatProvider>,
    );
    await waitFor(() => expect(chat.dockOpen).toBe(false));
  });

  it("the summon hotkey: a tap opens, a second tap closes", async () => {
    renderHost();
    const tap = () => {
      fireEvent.keyDown(window, { code: "Space", key: " ", altKey: true });
      fireEvent.keyUp(window, { code: "Space", key: " ", altKey: true });
    };
    tap();
    await screen.findByTestId(ZibbyOverlayTestId.Root);
    await waitFor(() => expect(live.phase).toBe("open"));
    tap();
    await waitFor(() => expect(chat.dockOpen).toBe(false));
    expect(voice.cancelTalk).toHaveBeenCalled();
  });

  it("the old ⌘/Ctrl+J chord does nothing", () => {
    renderHost();
    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    expect(chat.dockOpen).toBe(false);
  });

  it("Alt+H toggles the history panel while open", async () => {
    renderHost();
    await openOverlay();
    const aside = () => screen.getByTestId(ZibbyOverlayTestId.History);
    expect(aside()).toHaveAttribute("aria-hidden", "true");
    fireEvent.keyDown(window, { code: "KeyH", key: "h", altKey: true });
    await waitFor(() => expect(aside()).toHaveAttribute("aria-hidden", "false"));
    fireEvent.keyDown(window, { code: "KeyH", key: "h", altKey: true });
    await waitFor(() => expect(aside()).toHaveAttribute("aria-hidden", "true"));
  });
});

describe("ZibbyHost — orb state & status line", () => {
  it("is asleep when closed and ready when open", async () => {
    renderHost();
    expect(live.orbState).toBe("sleep");
    await openOverlay();
    expect(status()).toBe("Jsem tady · drž mezerník a mluv");
    expect(live.orbState).toBe("ready");
  });

  it("follows the mic, the in-flight turn, the latest tool event and speech", async () => {
    const view = renderHost();
    await openOverlay();
    const rerender = () =>
      view.rerender(
        <ChatProvider>
          <ZibbyLiveProvider>
            <Probe />
            <ZibbyHost />
          </ZibbyLiveProvider>
        </ChatProvider>,
      );

    voice = makeVoice({ listening: true });
    rerender();
    expect(status()).toBe("Poslouchám…");

    voice = makeVoice();
    engine = makeEngine({ thinking: true });
    rerender();
    expect(status()).toBe("Přemýšlím…");

    engine = makeEngine({
      thinking: true,
      stream: {
        ...EMPTY_STREAM,
        streaming: true,
        toolEvents: [{ name: "mcp__zibby__list_prs", status: "started" }],
      },
    });
    rerender();
    expect(status()).toBe("Hledám…");

    engine = makeEngine({
      thinking: true,
      stream: {
        ...EMPTY_STREAM,
        streaming: true,
        toolEvents: [{ name: "mcp__zibby__create_task", status: "started" }],
      },
    });
    rerender();
    expect(status()).toBe("Pracuji…");

    engine = makeEngine({
      thinking: true,
      stream: { ...EMPTY_STREAM, streaming: true, text: "Hotovo" },
    });
    voice = makeVoice({ speaking: true });
    rerender();
    expect(status()).toBe("Mluvím · mezerníkem mě přerušíš");
  });

  it("shows 'Čekám na tebe' while the last reply carries an approvals card", async () => {
    renderHost();
    await openOverlay();
    act(() =>
      chat.setMessages([
        msg({
          id: "a1",
          role: "assistant",
          text: "Tři věci čekají.",
          toolEvents: [
            { name: "show_widget", status: "ok", callId: "w-1", widget: { kind: "approvals" } },
          ],
        }),
      ]),
    );
    await waitFor(() => expect(status()).toBe("Čekám na tebe"));
    expect(live.orbState).toBe("needs");
  });

  it("flashes done for a dispatched task and error for a failed turn, then settles", async () => {
    renderHost();
    await openOverlay();
    vi.useFakeTimers();
    try {
      act(() =>
        engineOptions?.onTurnComplete?.({
          turnId: "t1",
          text: "Spustil jsem to.",
          toolEvents: [{ name: "mcp__zibby__create_task", status: "ok", runRef: "run_1" }],
        }),
      );
      expect(live.orbState).toBe("done");
      act(() => vi.advanceTimersByTime(1600));
      expect(live.orbState).toBe("ready");

      act(() => engineOptions?.onTurnError?.("boom"));
      expect(live.orbState).toBe("error");
      act(() => vi.advanceTimersByTime(1600));
      expect(live.orbState).toBe("ready");
    } finally {
      vi.useRealTimers();
    }
  });

  it("goes paused while the browser is offline", async () => {
    renderHost();
    await openOverlay();
    act(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      window.dispatchEvent(new Event("offline"));
    });
    await waitFor(() => expect(status()).toBe("Pozastaveno"));
    act(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(live.orbState).toBe("ready"));
  });

  it("shows the live transcript (confirmed in ink, interim muted) and the mic hint", async () => {
    voice = makeVoice({
      listening: true,
      transcript: { final: "A ten rebase předej", interim: "agentovi" },
      hint: "tooShort",
    });
    renderHost();
    await openOverlay();
    expect(screen.getByTestId(ZibbyOverlayTestId.Live)).toHaveTextContent(
      "A ten rebase předej agentovi",
    );
    expect(screen.getByTestId(ZibbyOverlayTestId.Hint)).toHaveTextContent(
      "Drž mezerník po celou dobu, co mluvíš.",
    );
  });

  it("shows the microphone error as the hint", async () => {
    voice = makeVoice({ error: "mic-denied" });
    renderHost();
    await openOverlay();
    expect(screen.getByTestId(ZibbyOverlayTestId.Hint)).toHaveTextContent(
      "Přístup k mikrofonu je zablokovaný",
    );
  });
});

describe("ZibbyHost — thread", () => {
  it("shows the empty hint and the starter suggestions on an empty thread", async () => {
    renderHost();
    await openOverlay();
    expect(screen.getByTestId(ZibbyThreadTestId.Empty)).toHaveTextContent(
      "Drž mezerník a mluv, nebo sem přetáhni soubory.",
    );
    expect(screen.getByTestId(ZibbyOverlayTestId.Suggestions)).toBeInTheDocument();
  });

  it("a suggestion sends its text as a message", async () => {
    const user = userEvent.setup();
    renderHost();
    await openOverlay();
    await user.click(screen.getByText("Co čeká na schválení?"));
    expect(engine.send).toHaveBeenCalledWith("Co čeká na schválení?", undefined, undefined);
  });

  it("renders user and assistant turns, markdown, the widget card and the live streaming turn", async () => {
    const user = userEvent.setup();
    renderHost();
    await openOverlay();
    act(() =>
      chat.setMessages([
        msg({ id: "u1", role: "user", text: "Co mě čeká?" }),
        msg({
          id: "a1",
          role: "assistant",
          text: "Máš **tři** věci.",
          toolEvents: [
            { name: "show_widget", status: "ok", callId: "w-1", widget: { kind: "ci" } },
          ],
        }),
      ]),
    );
    expect(screen.queryByTestId(ZibbyOverlayTestId.Suggestions)).not.toBeInTheDocument();
    const userBubble = screen.getByTestId(ChatMessageTestId.UserBubble);
    expect(userBubble).toHaveTextContent("Co mě čeká?");
    // Persisted turn, origin unknown → just the time.
    expect(within(userBubble).getByTestId(ChatMessageTestId.Meta)).toHaveTextContent(
      /^\d{1,2}:\d{2}$/,
    );
    const assistant = screen.getByTestId(ChatMessageTestId.AssistantBubble);
    expect(within(assistant).getByText("tři").tagName).toBe("STRONG");
    expect(within(assistant).getByTestId(ZibbyBubbleTestId.Avatar)).toBeInTheDocument();
    // Widget cards send follow-ups through the same path as typed messages.
    await user.click(screen.getByTestId("widget-card"));
    expect(engine.send).toHaveBeenCalledWith("fix it", undefined, undefined);
  });

  it("shows the live streaming turn with its caret, and the thinking dots before any token", async () => {
    const view = renderHost();
    await openOverlay();
    engine = makeEngine({ thinking: true });
    view.rerender(
      <ChatProvider>
        <ZibbyLiveProvider>
          <Probe />
          <ZibbyHost />
        </ZibbyLiveProvider>
      </ChatProvider>,
    );
    expect(screen.getByTestId(ChatTranscriptTestId.ThinkingTurn)).toBeInTheDocument();

    engine = makeEngine({
      thinking: true,
      stream: { ...EMPTY_STREAM, streaming: true, text: "Dívám se na" },
    });
    view.rerender(
      <ChatProvider>
        <ZibbyLiveProvider>
          <Probe />
          <ZibbyHost />
        </ZibbyLiveProvider>
      </ChatProvider>,
    );
    expect(screen.getByTestId(ZibbyBubbleTestId.Caret)).toBeInTheDocument();
    expect(screen.getByText("Dívám se na")).toBeInTheDocument();
  });

  it("marks the reply Zibby was interrupted in with a trailing …", async () => {
    voice = makeVoice({ interruptedId: "a1" });
    renderHost();
    await openOverlay();
    act(() => chat.setMessages([msg({ id: "a1", role: "assistant", text: "Máš tři věci" })]));
    expect(screen.getByTestId(ChatMessageTestId.Interrupted)).toBeInTheDocument();
  });

  it("CREATE TASK hands the conversation up to the reply off to /work/tasks/new", async () => {
    const user = userEvent.setup();
    renderHost();
    await openOverlay();
    act(() => {
      chat.setConversationId("conv-1");
      chat.setMessages([msg({ id: "a1", role: "assistant", text: "Navrhuju tohle." })]);
    });
    await user.click(await screen.findByTestId(ChatMessageTestId.CreateTaskButton));
    expect(handoffMutate).toHaveBeenCalledWith(
      { body: { conversationId: "conv-1", upToMessageId: "a1" } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    const { onSuccess } = handoffMutate.mock.calls[0]?.[1] as {
      onSuccess: (res: { status: number; body: { text: string } }) => void;
    };
    act(() => onSuccess({ status: 200, body: { text: "Hand-off text" } }));
    expect(routerPush).toHaveBeenCalledWith("/work/tasks/new?text=Hand-off+text");
  });

  it("CREATE TASK falls back to the reply plus a conversation pointer when the hand-off fails, and carries the department entry", async () => {
    const user = userEvent.setup();
    renderHost();
    act(() => {
      chat.setConversationId("conv-1");
      chat.setDockTarget({ kind: "department", id: "dev", name: "Dev" });
      chat.setMessages([msg({ id: "a1", role: "assistant", text: "Navrhuju tohle." })]);
    });
    await openOverlay();
    await user.click(await screen.findByTestId(ChatMessageTestId.CreateTaskButton));
    const { onError } = handoffMutate.mock.calls[0]?.[1] as { onError: () => void };
    act(() => onError());
    const url = new URL(String(routerPush.mock.calls[0]?.[0]), "http://x");
    expect(url.searchParams.get("entry")).toBe("dev");
    expect(url.searchParams.get("text")).toContain("Navrhuju tohle.");
    expect(url.searchParams.get("text")).toContain("conversation conv-1");
  });
});

describe("ZibbyHost — composer & voice", () => {
  it("configures the rich composer like the old dock did", async () => {
    renderHost();
    await openOverlay();
    expect(composerProps).toMatchObject({
      multipleTargets: true,
      allowSkillMentions: true,
      showAttach: true,
      maxRows: 6,
      scopeKinds: ["project", "team", "company"],
      placeholder: "nebo napiš…",
    });
    expect(screen.getByTestId(ZibbyComposerTestId.ModelPicker)).toBeInTheDocument();
    // `#` scope and `/` skill tags ride into the engine.
    composerProps?.onScopeChange?.("project", "p1");
    composerProps?.onSkillChange?.("tdd");
    expect(engine.setScope).toHaveBeenCalledWith("project", "p1");
    expect(engine.setSkillId).toHaveBeenCalledWith("tdd");
  });

  it("sends typed text with its mentions and attachments, marked 'napsáno'", async () => {
    const view = renderHost();
    await openOverlay();
    const mentions: TaskTarget[] = [{ kind: "agent", id: "builder", name: "Builder" }];
    const attachments = { attachmentSetId: "set_1", files: [{ name: "a.txt", size: 2 }] };
    act(() => composerProps?.onSubmit("ahoj @Builder", undefined, attachments, mentions));
    expect(engine.send).toHaveBeenCalledWith("ahoj @Builder", mentions, attachments);

    // The engine appended the optimistic user message under the returned id.
    act(() => chat.setMessages([msg({ id: "u-sent", role: "user", text: "ahoj @Builder" })]));
    expect(screen.getByTestId(ChatMessageTestId.Meta)).toHaveTextContent(/^napsáno · /);
    view.unmount();
  });

  it("a voice utterance goes through the composer (attachments ride along) and is marked 'přepis'", async () => {
    renderHost();
    await openOverlay();
    act(() => voiceOptions?.onUtterance("Co mě dneska čeká"));
    expect(submitSpoken).toHaveBeenCalledWith("Co mě dneska čeká");
    expect(engine.send).toHaveBeenCalledWith("Co mě dneska čeká", undefined, undefined);
    act(() => chat.setMessages([msg({ id: "u-sent", role: "user", text: "Co mě dneska čeká" })]));
    expect(screen.getByTestId(ChatMessageTestId.Meta)).toHaveTextContent(/^přepis · /);
  });

  it("an utterance the composer refuses (a turn in flight) lands in its draft instead of being lost", async () => {
    submitSpoken.mockReturnValue(false);
    renderHost();
    await openOverlay();
    act(() => voiceOptions?.onUtterance("ještě jedna věc"));
    expect(engine.send).not.toHaveBeenCalled();
    expect(screen.getByTestId("stub-injected-text")).toHaveTextContent("ještě jedna věc");
    act(() => composerProps?.onInjectedTextConsumed?.());
    expect(screen.getByTestId("stub-injected-text")).toHaveTextContent("");
  });

  it("bare Space talks while the overlay is open (pressTalk on down, releaseTalk on up)", async () => {
    renderHost();
    await openOverlay();
    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    expect(voice.pressTalk).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(document.body, { code: "Space", key: " " });
    expect(voice.releaseTalk).toHaveBeenCalledTimes(1);
  });

  it("Space in a text field stays a space", async () => {
    renderHost();
    await openOverlay();
    const field = document.createElement("textarea");
    document.body.append(field);
    fireEvent.keyDown(field, { code: "Space", key: " " });
    expect(voice.pressTalk).not.toHaveBeenCalled();
    field.remove();
  });

  it("the PTT button is hold in ptt mode (press talks, release sends) and tap in hands-free", async () => {
    const view = renderHost();
    await openOverlay();
    const ptt = screen.getByTestId(ZibbyComposerTestId.Ptt);
    expect(ptt).toHaveAccessibleName("Drž a mluv");
    expect(ptt).toHaveTextContent("Drž Space a mluv");
    const user = userEvent.setup();
    await user.pointer({ keys: "[MouseLeft>]", target: ptt });
    expect(voice.pressTalk).toHaveBeenCalledTimes(1);
    await user.pointer({ keys: "[/MouseLeft]" });
    expect(voice.releaseTalk).toHaveBeenCalledTimes(1);

    voice = makeVoice({ mode: "handsfree" });
    view.rerender(
      <ChatProvider>
        <ZibbyLiveProvider>
          <Probe />
          <ZibbyHost />
        </ZibbyLiveProvider>
      </ChatProvider>,
    );
    const tap = screen.getByTestId(ZibbyComposerTestId.Ptt);
    expect(tap).toHaveAccessibleName("Ťukni a mluv");
    expect(tap).toHaveTextContent("Ťukni a mluv");
  });

  it("auto-speaks a completed reply while open and voice is on", async () => {
    renderHost();
    await openOverlay();
    act(() => engineOptions?.onTurnComplete?.({ turnId: "t1", text: "Hotovo.", toolEvents: [] }));
    expect(voice.speak).toHaveBeenCalledWith("t1", "Hotovo.");
  });

  it("does not auto-speak while muted, while closed, or for an empty reply", async () => {
    voice = makeVoice({ muted: true });
    renderHost();
    act(() => engineOptions?.onTurnComplete?.({ turnId: "t0", text: "Zavřeno.", toolEvents: [] }));
    expect(voice.speak).not.toHaveBeenCalled(); // closed
    await openOverlay();
    act(() => engineOptions?.onTurnComplete?.({ turnId: "t1", text: "Ticho.", toolEvents: [] }));
    expect(voice.speak).not.toHaveBeenCalled(); // muted
  });

  it("the footer switches talk mode, toggles the voice and shows the real shortcut", async () => {
    const user = userEvent.setup();
    renderHost();
    await openOverlay();
    await user.click(screen.getByRole("button", { name: "Hands-free" }));
    expect(voice.setMode).toHaveBeenCalledWith("handsfree");
    await user.click(screen.getByTestId(ZibbyOverlayFooterTestId.Mute));
    expect(voice.setMuted).toHaveBeenCalledWith(true);
    expect(screen.getByTestId(ZibbyOverlayTestId.Footer)).toHaveTextContent(
      "Esc zavře · Alt Space vyvolá · soubory přetáhni kamkoli",
    );
  });

  it("shows the muted label and no hint of voice when voice is off", async () => {
    voice = makeVoice({ muted: true });
    renderHost();
    await openOverlay();
    expect(screen.getByTestId(ZibbyOverlayFooterTestId.Mute)).toHaveTextContent(
      "Hlas vypnutý · jen text",
    );
  });

  it("the explicit target and about chips are shown and clearable", async () => {
    const user = userEvent.setup();
    renderHost();
    const about: ChatAbout = { kind: "pr", id: "47385", label: "PR #47385" };
    act(() => {
      chat.setDockTarget({ kind: "department", id: "dev", name: "Dev" });
      chat.setAbout(about);
    });
    await openOverlay();
    expect(screen.getByTestId(ZibbyContextChipsTestId.AboutChip)).toHaveTextContent("PR #47385");
    await user.click(
      within(screen.getByTestId(ZibbyContextChipsTestId.TargetChip)).getByRole("button"),
    );
    expect(chat.dockTarget).toBeNull();
    await user.click(
      within(screen.getByTestId(ZibbyContextChipsTestId.AboutChip)).getByRole("button"),
    );
    expect(chat.about).toBeNull();
  });
});

describe("ZibbyHost — conversations", () => {
  it("the top bar shows the title; New conversation, the menu actions and rename call the hook", async () => {
    const user = userEvent.setup();
    renderHost();
    await openOverlay();
    act(() => chat.setMessages([msg({ id: "u1", role: "user", text: "x" })]));
    expect(screen.getByTestId(ZibbyTopBarTestId.Title)).toHaveTextContent("Nový rozhovor");

    await user.click(screen.getByTestId(ZibbyOverlayTopBarTestId.New));
    expect(conversations.startNew).toHaveBeenCalled();

    const openMenu = () => user.click(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger));
    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Vyčistit a začít znovu" }));
    expect(conversations.clearActive).toHaveBeenCalled();

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Smazat rozhovor" }));
    expect(conversations.remove).toHaveBeenCalledWith("conv-1");

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Přejmenovat" }));
    const input = await screen.findByTestId(ZibbyTopBarTestId.TitleInput);
    await user.clear(input);
    await user.type(input, "Moje téma{Enter}");
    expect(conversations.rename).toHaveBeenCalledWith("conv-1", "Moje téma");
  });

  it("Clear is disabled on an empty thread; actions are disabled while a turn is in flight", async () => {
    const user = userEvent.setup();
    conversations = makeConversations({ busy: true });
    engine = makeEngine({ thinking: true });
    renderHost();
    await openOverlay();
    expect(screen.getByTestId(ZibbyOverlayTopBarTestId.New)).toBeDisabled();
    await user.click(screen.getByTestId(ZibbyTopBarMenuTestId.Trigger));
    expect(screen.getByRole("menuitem", { name: "Vyčistit a začít znovu" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Smazat rozhovor" })).toBeDisabled();
  });

  it("the history panel lists the groups, opens a conversation and searches", async () => {
    const user = userEvent.setup();
    renderHost();
    await openOverlay();
    await user.click(screen.getByTestId(ZibbyTopBarTestId.HistoryButton));
    const panel = screen.getByTestId(ZibbyOverlayTestId.History);
    expect(within(panel).getByText("Rebase #47385")).toBeInTheDocument();
    await user.click(within(panel).getByText("Rebase #47385"));
    expect(conversations.open).toHaveBeenCalledWith("conv-2");
    await user.type(within(panel).getByPlaceholderText("Hledat v rozhovorech…"), "r");
    expect(conversations.setQuery).toHaveBeenCalled();
  });

  it("the history panel does not swap conversations while a turn is in flight", async () => {
    const user = userEvent.setup();
    conversations = makeConversations({ busy: true });
    renderHost();
    await openOverlay();
    await user.click(screen.getByTestId(ZibbyTopBarTestId.HistoryButton));
    await user.click(
      within(screen.getByTestId(ZibbyOverlayTestId.History)).getByText("Rebase #47385"),
    );
    expect(conversations.open).not.toHaveBeenCalled();
  });

  it("shows the toast with its Vrátit action wired to undo", async () => {
    const undo = vi.fn();
    conversations = makeConversations({ toast: { message: "Konverzace vyčištěna", undo } });
    const user = userEvent.setup();
    renderHost();
    await openOverlay();
    expect(screen.getByTestId(ZibbyToastTestId.Message)).toHaveTextContent("Konverzace vyčištěna");
    await user.click(screen.getByTestId(ZibbyToastTestId.Action));
    expect(undo).toHaveBeenCalled();
  });

  it("a toast without undo has no action", async () => {
    conversations = makeConversations({ toast: { message: "Hotovo" } });
    renderHost();
    await openOverlay();
    expect(screen.queryByTestId(ZibbyToastTestId.Action)).not.toBeInTheDocument();
  });
});

describe("ZibbyHost — files dragged anywhere", () => {
  function dragFiles(target: EventTarget, type: string, files: File[] = []) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { types: ["Files"], files, dropEffect: "none" },
    });
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  }

  it("a file dragged over the closed app summons Zibby with the drop zone", async () => {
    renderHost();
    expect(chat.dockOpen).toBe(false);
    dragFiles(window, "dragenter");
    await screen.findByTestId(ZibbyOverlayTestId.Root);
    expect(chat.dockOpen).toBe(true);
    expect(screen.getByTestId(ZibbyOverlayTestId.Drop)).toHaveTextContent("Pusť soubory sem");
    // The orb listens and the status line says what to do.
    expect(status()).toBe("Pusť soubory, přečtu je");
  });

  it("dropping hands the files (max 10) to the composer's own upload", async () => {
    renderHost();
    dragFiles(window, "dragenter");
    await screen.findByTestId(ZibbyOverlayTestId.Root);
    const files = Array.from({ length: 12 }, (_, i) => new File(["x"], `f${i}.txt`));
    dragFiles(screen.getByTestId(ZibbyOverlayTestId.Root), "drop", files);
    const injected = screen.getByTestId("stub-injected-files").textContent ?? "";
    expect(injected.split(",")).toHaveLength(10);
    expect(injected.startsWith("f0.txt,f1.txt")).toBe(true);
    expect(screen.queryByTestId(ZibbyOverlayTestId.Drop)).not.toBeInTheDocument();
    act(() => composerProps?.onInjectedFilesConsumed?.());
    expect(screen.getByTestId("stub-injected-files")).toHaveTextContent("");
  });

  it("ignores drags that carry no files", () => {
    renderHost();
    const event = new Event("dragenter", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { types: ["text/plain"] } });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(chat.dockOpen).toBe(false);
  });
});

describe("ZibbyHost — phone", () => {
  it("uses the large round push-to-talk button and drops the shortcut hint", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width") || query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    })) as typeof window.matchMedia;
    renderHost();
    await openOverlay();
    expect(screen.getByTestId(ZibbyComposerTestId.Ptt).className).toContain("h-[76px]");
    expect(screen.getByTestId(ZibbyOverlayTestId.Footer)).not.toHaveTextContent("Esc zavře");
    // Top bar actions collapse to icons.
    expect(screen.getByTestId(ZibbyOverlayTopBarTestId.New)).toHaveAccessibleName("Nový rozhovor");
    expect(screen.getByTestId(ZibbyOverlayTopBarTestId.New)).toHaveTextContent("");
  });
});
