import type { ChatConversationSummary, ChatMessage } from "@zibby/contracts";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../i18n/messages/cs.json";
import { ChatProvider, useChat } from "../../chat/ChatContext";
import {
  SEARCH_DEBOUNCE_MS,
  TOAST_DURATION_MS,
  type UseZibbyConversationsOptions,
  useZibbyConversations,
} from "./useZibbyConversations";

// ---- mocks ---------------------------------------------------------------
const queryArgs: (string | undefined)[] = [];
let listData: ChatConversationSummary[] = [];
let searchData: ChatConversationSummary[] = [];
vi.mock("../../chat/queries", () => ({
  useChatConversationsQuery: (q?: string) => {
    queryArgs.push(q);
    return { data: q ? searchData : listData, isLoading: false };
  },
}));

const clearFn = vi.fn();
const deleteFn = vi.fn();
const renameFn = vi.fn();
const restoreFn = vi.fn();
vi.mock("../../chat/mutations", () => ({
  useClearChatConversationMutation: () => ({ mutateAsync: clearFn }),
  useDeleteChatConversationMutation: () => ({ mutateAsync: deleteFn }),
  useRenameChatConversationMutation: () => ({ mutateAsync: renameFn }),
  useRestoreChatConversationMutation: () => ({ mutateAsync: restoreFn }),
}));

const transcripts = new Map<string, ChatMessage[]>();
const getTranscript = vi.fn(async (args: { query: { conversationId: string } }) => {
  const id = args.query.conversationId;
  return {
    status: 200,
    body: { conversationId: id, sessionId: null, messages: transcripts.get(id) ?? [] },
  };
});
vi.mock("../../../state/api", () => ({
  apiClient: { chat: { getTranscript: { query: (a: never) => getTranscript(a) } } },
}));

// ---- helpers --------------------------------------------------------------
const ok = { status: 200, body: {} };
const msg = (id: string, text = id): ChatMessage => ({
  id,
  role: "user",
  text,
  at: "2026-11-15T10:00:00Z",
});
const summary = (id: string, title: string, updatedAt: string): ChatConversationSummary => ({
  conversationId: id,
  title,
  messageCount: 2,
  updatedAt,
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="cs" messages={messages}>
      <ChatProvider>{children}</ChatProvider>
    </NextIntlClientProvider>
  );
}

function setup(options?: UseZibbyConversationsOptions) {
  return renderHook(
    (props: UseZibbyConversationsOptions | undefined) => ({
      z: useZibbyConversations(props),
      chat: useChat(),
    }),
    { wrapper, initialProps: options },
  );
}

/** Make `id` the active conversation, with the given messages in the thread. */
function activate(
  r: ReturnType<typeof setup>,
  id: string,
  thread: ChatMessage[] = [msg("m1"), msg("m2")],
) {
  act(() => {
    r.result.current.chat.setConversationId(id);
    r.result.current.chat.setMessages(thread);
  });
}

/** Let queued promise callbacks (mutation `.then`s) run inside act. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 10, 15, 12, 0, 0) });
  window.localStorage.clear();
  queryArgs.length = 0;
  listData = [
    summary("c1", "Deploy", new Date(2026, 10, 15, 9, 30).toISOString()),
    summary("c2", "Faktura", new Date(2026, 10, 14, 18, 0).toISOString()),
    summary("c3", "Stará věc", new Date(2026, 9, 1, 8, 0).toISOString()),
  ];
  searchData = [];
  transcripts.clear();
  transcripts.set("c2", [msg("p1", "faktura")]);
  clearFn.mockReset().mockResolvedValue(ok);
  deleteFn.mockReset().mockResolvedValue(ok);
  renameFn.mockReset().mockResolvedValue(ok);
  restoreFn.mockReset().mockResolvedValue(ok);
  getTranscript.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---- tests -----------------------------------------------------------------
describe("useZibbyConversations: list", () => {
  it("groups the history, flags the active row and reports the count", () => {
    const r = setup();
    activate(r, "c1");
    const { z } = r.result.current;
    expect(z.groups.map((g) => g.label)).toEqual(["Dnes", "Včera", "Starší"]);
    expect(z.groups[0]?.items).toEqual([
      { id: "c1", title: "Deploy", time: "09:30", active: true },
    ]);
    expect(z.groups[1]?.items[0]).toMatchObject({ id: "c2", active: false });
    expect(z.count).toBe(3);
    expect(z.activeId).toBe("c1");
    expect(z.activeTitle).toBe("Deploy");
  });

  it("falls back to 'Nový rozhovor' for a thread not in history yet", () => {
    const r = setup();
    activate(r, "fresh", []);
    expect(r.result.current.z.activeTitle).toBe("Nový rozhovor");
  });

  it("shows no snippet without a search", () => {
    listData = [
      { ...summary("c1", "Deploy", new Date(2026, 10, 15, 9).toISOString()), snippet: "x" },
    ];
    const r = setup();
    expect(r.result.current.z.groups[0]?.items[0]).not.toHaveProperty("snippet");
  });
});

describe("useZibbyConversations: search", () => {
  it("debounces the API term, returns the raw value at once, and passes snippets through", async () => {
    searchData = [
      {
        ...summary("c2", "Faktura", new Date(2026, 10, 14, 18).toISOString()),
        snippet: "…zaplatit fakturu…",
      },
    ];
    const r = setup();
    act(() => r.result.current.z.setQuery("fak"));
    expect(r.result.current.z.query).toBe("fak");
    expect(queryArgs.every((q) => q === undefined)).toBe(true);
    expect(r.result.current.z.groups.flatMap((g) => g.items)).toHaveLength(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(queryArgs).not.toContain("fak");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(queryArgs).toContain("fak");
    expect(r.result.current.z.groups.flatMap((g) => g.items)).toEqual([
      expect.objectContaining({ id: "c2", snippet: "…zaplatit fakturu…" }),
    ]);
    // The count stays the size of the whole history, not of the hits.
    expect(r.result.current.z.count).toBe(3);
  });

  it("restarts the wait on every keystroke and returns to the full list immediately when cleared", async () => {
    const r = setup();
    act(() => r.result.current.z.setQuery("f"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    act(() => r.result.current.z.setQuery("fa"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(queryArgs).not.toContain("f");
    expect(queryArgs).not.toContain("fa");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(queryArgs).toContain("fa");

    queryArgs.length = 0;
    act(() => r.result.current.z.setQuery(""));
    expect(queryArgs.at(-1)).toBeUndefined();
    expect(r.result.current.z.groups.flatMap((g) => g.items)).toHaveLength(3);
  });
});

describe("useZibbyConversations: open / new", () => {
  it("opens a past conversation: loads its transcript into the chat context and drops 'about'", async () => {
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.chat.setAbout({ kind: "pr", id: "p1", label: "PR" }));
    act(() => r.result.current.z.open("c2"));
    await flush();
    expect(getTranscript).toHaveBeenCalledWith({ query: { conversationId: "c2" } });
    expect(r.result.current.chat.conversationId).toBe("c2");
    expect(r.result.current.chat.messages.map((m) => m.id)).toEqual(["p1"]);
    expect(r.result.current.chat.about).toBeNull();
  });

  it("is a no-op for the active conversation", async () => {
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.open("c1"));
    await flush();
    expect(getTranscript).not.toHaveBeenCalled();
  });

  it("shows an error toast when the transcript cannot be loaded", async () => {
    getTranscript.mockResolvedValueOnce({
      status: 404,
      body: { conversationId: "x", sessionId: null, messages: [] },
    });
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.open("c2"));
    await flush();
    expect(r.result.current.chat.conversationId).toBe("c1");
    expect(r.result.current.z.toast?.message).toBe("Rozhovor se nepodařilo otevřít.");
  });

  it("startNew keeps the old one in history, mints a fresh empty thread and tells the operator", () => {
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.startNew());
    expect(r.result.current.chat.conversationId).not.toBe("c1");
    expect(r.result.current.chat.messages).toEqual([]);
    expect(r.result.current.z.toast).toEqual({
      message: "Předchozí rozhovor je uložený v historii",
    });
  });

  it("startNew on an empty thread shows no toast", () => {
    const r = setup();
    activate(r, "fresh", []);
    act(() => r.result.current.z.startNew());
    expect(r.result.current.z.toast).toBeNull();
  });
});

describe("useZibbyConversations: rename", () => {
  it("sends the trimmed title and ignores blank ones", async () => {
    const r = setup();
    act(() => r.result.current.z.rename("c1", "  Release  "));
    act(() => r.result.current.z.rename("c1", "   "));
    await flush();
    expect(renameFn).toHaveBeenCalledTimes(1);
    expect(renameFn).toHaveBeenCalledWith({
      params: { conversationId: "c1" },
      body: { title: "Release" },
    });
  });

  it("surfaces a failed rename", async () => {
    renameFn.mockResolvedValue({ status: 404, body: {} });
    const r = setup();
    act(() => r.result.current.z.rename("c1", "Release"));
    await flush();
    expect(r.result.current.z.toast?.message).toBe("Rozhovor se nepodařilo přejmenovat.");
  });
});

describe("useZibbyConversations: clear", () => {
  it("empties the thread at once, toasts with undo, and undo restores + reloads the transcript", async () => {
    transcripts.set("c1", [msg("m1"), msg("m2")]);
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.clearActive());
    expect(r.result.current.chat.messages).toEqual([]); // optimistic
    await flush();
    expect(clearFn).toHaveBeenCalledWith({ params: { conversationId: "c1" } });
    expect(r.result.current.z.toast?.message).toBe("Konverzace vyčištěna");

    act(() => r.result.current.z.toast?.undo?.());
    await flush();
    expect(restoreFn).toHaveBeenCalledWith({ params: { conversationId: "c1" } });
    expect(r.result.current.chat.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(r.result.current.chat.conversationId).toBe("c1");
    expect(r.result.current.z.toast).toBeNull();
  });

  it("puts the messages back and shows an error when the call rejects", async () => {
    clearFn.mockRejectedValue(new Error("boom"));
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.clearActive());
    expect(r.result.current.chat.messages).toEqual([]);
    await flush();
    expect(r.result.current.chat.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(r.result.current.z.toast).toEqual({ message: "Konverzaci se nepodařilo vyčistit." });
  });

  it("treats a non-200 answer as a failure", async () => {
    clearFn.mockResolvedValue({ status: 404, body: {} });
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.clearActive());
    await flush();
    expect(r.result.current.chat.messages).toHaveLength(2);
    expect(r.result.current.z.toast?.undo).toBeUndefined();
  });

  it("does nothing on an empty thread", async () => {
    const r = setup();
    activate(r, "fresh", []);
    act(() => r.result.current.z.clearActive());
    await flush();
    expect(clearFn).not.toHaveBeenCalled();
  });
});

describe("useZibbyConversations: delete", () => {
  it("hides a non-active conversation at once and undo brings it back", async () => {
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.remove("c2"));
    expect(r.result.current.z.groups.flatMap((g) => g.items.map((i) => i.id))).toEqual([
      "c1",
      "c3",
    ]);
    expect(r.result.current.z.count).toBe(2);
    await flush();
    expect(deleteFn).toHaveBeenCalledWith({ params: { conversationId: "c2" } });
    expect(r.result.current.z.toast?.message).toBe("Smazáno „Faktura“");
    expect(r.result.current.chat.conversationId).toBe("c1"); // untouched

    act(() => r.result.current.z.toast?.undo?.());
    await flush();
    expect(restoreFn).toHaveBeenCalledWith({ params: { conversationId: "c2" } });
    expect(r.result.current.z.groups.flatMap((g) => g.items.map((i) => i.id))).toContain("c2");
    expect(r.result.current.chat.conversationId).toBe("c1"); // not re-opened
  });

  it("moves to a fresh thread when the active one is deleted, and undo re-opens it", async () => {
    transcripts.set("c1", [msg("m1"), msg("m2")]);
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.remove("c1"));
    expect(r.result.current.chat.conversationId).not.toBe("c1");
    expect(r.result.current.chat.messages).toEqual([]);
    expect(r.result.current.z.groups.flatMap((g) => g.items.map((i) => i.id))).not.toContain("c1");
    await flush();
    expect(r.result.current.z.toast?.message).toBe("Smazáno „Deploy“");

    act(() => r.result.current.z.toast?.undo?.());
    await flush();
    expect(r.result.current.chat.conversationId).toBe("c1");
    expect(r.result.current.chat.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(r.result.current.z.groups.flatMap((g) => g.items.map((i) => i.id))).toContain("c1");
  });

  it("rolls back the list and shows an error when deleting fails", async () => {
    deleteFn.mockRejectedValue(new Error("boom"));
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.remove("c2"));
    await flush();
    expect(r.result.current.z.groups.flatMap((g) => g.items.map((i) => i.id))).toContain("c2");
    expect(r.result.current.z.toast).toEqual({ message: "Rozhovor se nepodařilo smazat." });
  });

  it("rolls the active thread back too when deleting it fails", async () => {
    deleteFn.mockResolvedValue({ status: 404, body: {} });
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.remove("c1"));
    await flush();
    expect(r.result.current.chat.conversationId).toBe("c1");
    expect(r.result.current.chat.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(r.result.current.z.groups.flatMap((g) => g.items.map((i) => i.id))).toContain("c1");
  });

  it("ignores a conversation that is neither stored nor an active thread with messages", async () => {
    const r = setup();
    activate(r, "fresh", []);
    act(() => r.result.current.z.remove("fresh"));
    act(() => r.result.current.z.remove("ghost"));
    await flush();
    expect(deleteFn).not.toHaveBeenCalled();
  });
});

describe("useZibbyConversations: toast", () => {
  it("auto-dismisses after 5 s and a new toast replaces the old one (restarting the timer)", async () => {
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.startNew());
    expect(r.result.current.z.toast?.message).toBe("Předchozí rozhovor je uložený v historii");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOAST_DURATION_MS - 1000);
    });
    // Replace it with a different toast.
    act(() => r.result.current.chat.setConversationId("c1"));
    act(() => r.result.current.chat.setMessages([msg("n1")]));
    act(() => r.result.current.z.clearActive());
    await flush();
    expect(r.result.current.z.toast?.message).toBe("Konverzace vyčištěna");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOAST_DURATION_MS - 1);
    });
    expect(r.result.current.z.toast).not.toBeNull(); // the old timer did not cut the new toast short
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(r.result.current.z.toast).toBeNull();
  });

  it("dismissToast clears it", () => {
    const r = setup();
    activate(r, "c1");
    act(() => r.result.current.z.startNew());
    act(() => r.result.current.z.dismissToast());
    expect(r.result.current.z.toast).toBeNull();
  });

  it("clears its toast timer on unmount", () => {
    // Unmounting frees the same unrelated timers with or without a toast, so the
    // toast case must free exactly one more (the 5 s auto-dismiss).
    const freed = (withToast: boolean) => {
      const r = setup();
      activate(r, "c1");
      if (withToast) act(() => r.result.current.z.startNew());
      const before = vi.getTimerCount();
      r.unmount();
      return before - vi.getTimerCount();
    };
    const without = freed(false);
    expect(freed(true)).toBe(without + 1);
  });
});

describe("useZibbyConversations: busy (a turn is streaming)", () => {
  it("blocks the actions that would swap or empty the streaming thread", async () => {
    const r = setup({ busy: true });
    activate(r, "c1");
    expect(r.result.current.z.busy).toBe(true);
    act(() => r.result.current.z.open("c2"));
    act(() => r.result.current.z.startNew());
    act(() => r.result.current.z.clearActive());
    act(() => r.result.current.z.remove("c1"));
    await flush();
    expect(getTranscript).not.toHaveBeenCalled();
    expect(clearFn).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
    expect(r.result.current.chat.conversationId).toBe("c1");
    expect(r.result.current.chat.messages).toHaveLength(2);
  });

  it("still allows rename and deleting another conversation", async () => {
    const r = setup({ busy: true });
    activate(r, "c1");
    act(() => r.result.current.z.rename("c2", "Nové"));
    act(() => r.result.current.z.remove("c3"));
    await flush();
    expect(renameFn).toHaveBeenCalled();
    expect(deleteFn).toHaveBeenCalledWith({ params: { conversationId: "c3" } });
  });
});

describe("useZibbyConversations: identity", () => {
  it("keeps the public functions stable across renders", () => {
    const r = setup();
    const first = r.result.current.z;
    activate(r, "c1");
    act(() => r.result.current.z.setQuery("a"));
    r.rerender({ busy: true });
    const next = r.result.current.z;
    for (const key of [
      "open",
      "startNew",
      "rename",
      "clearActive",
      "remove",
      "dismissToast",
      "setQuery",
    ] as const) {
      expect(next[key]).toBe(first[key]);
    }
  });
});
