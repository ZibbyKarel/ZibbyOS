"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../../../state/api";
import { useChat } from "../../chat/ChatContext";
import {
  useClearChatConversationMutation,
  useDeleteChatConversationMutation,
  useRenameChatConversationMutation,
  useRestoreChatConversationMutation,
} from "../../chat/mutations";
import { useChatConversationsQuery } from "../../chat/queries";
import { formatConversationTime, groupConversations } from "./groupConversations";

/** Delay between the last keystroke and the search hitting the API. */
export const SEARCH_DEBOUNCE_MS = 200;
/** How long a toast stays before it dismisses itself. */
export const TOAST_DURATION_MS = 5000;
/** How often "now" is re-read so Today / Yesterday buckets roll over at midnight. */
const NOW_REFRESH_MS = 60_000;

/** One history row, shaped for `ZibbyHistoryPanel`. */
export interface ZibbyConversationItem {
  id: string;
  title: string;
  /** "17:34" / weekday / short date. */
  time: string;
  /** Only while searching; the list API has no snippet otherwise. */
  snippet?: string;
  active: boolean;
}

export interface ZibbyConversationGroup {
  label: string;
  items: ZibbyConversationItem[];
}

/** The single toast the overlay shows; `undo` is present when the action is reversible. */
export interface ZibbyConversationsToast {
  message: string;
  undo?: () => void;
}

export interface UseZibbyConversationsOptions {
  /**
   * A turn is in flight (pass `useChatDock().thinking`). While true, the actions
   * that would swap or empty the streaming thread (`open` of another conversation,
   * `startNew`, `clearActive`, `remove` of the active one) are no-ops — the
   * container should disable the matching controls using the returned `busy`.
   */
  busy?: boolean;
}

export interface ZibbyConversations {
  activeId: string | null;
  /** Title of the active conversation; "Nový chat" while it has none yet. */
  activeTitle: string;
  /** Conversations in history (independent of the search term). */
  count: number;
  /** The raw search input value. */
  query: string;
  setQuery: (q: string) => void;
  groups: ZibbyConversationGroup[];
  loading: boolean;
  /** Mirrors the `busy` option, so the container can read it from one place. */
  busy: boolean;
  open: (id: string) => void;
  startNew: () => void;
  rename: (id: string, title: string) => void;
  clearActive: () => void;
  remove: (id: string) => void;
  toast: ZibbyConversationsToast | null;
  dismissToast: () => void;
}

/**
 * State layer of Zibby's conversation history + top bar: grouped/searchable
 * list, open / new / rename / clear / delete with optimistic updates, rollback
 * on failure and a 5 s undo toast (clear and delete are soft on the server, so
 * `restore` undoes either).
 *
 * Opening a past conversation reuses the old dock's mechanism
 * (`ChatHistorySidebar`): fetch its transcript, then set `conversationId` +
 * `messages` in `ChatContext` and drop the sticky `about`. `useChatStream` is
 * keyed by `conversationId`, so changing it re-opens the SSE stream for the new
 * thread by itself. Must be rendered inside `ChatProvider`.
 */
export function useZibbyConversations(
  options: UseZibbyConversationsOptions = {},
): ZibbyConversations {
  const busy = options.busy ?? false;
  const t = useTranslations("zibbyConversations");
  const locale = useLocale();
  const { conversationId, setConversationId, messages, setMessages, setAbout, newChat } = useChat();

  // ---- search (debounced) -------------------------------------------------
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const trimmedQuery = query.trim();
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(trimmedQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmedQuery]);
  // Clearing the box shows the full list at once; only a non-empty term waits.
  const searchTerm = trimmedQuery === "" ? "" : debouncedQuery;

  const allQuery = useChatConversationsQuery(undefined);
  const searchQuery = useChatConversationsQuery(searchTerm || undefined);

  // ---- optimistic removal -------------------------------------------------
  // Ids hidden from the list while (or after) their delete is in flight; an id
  // leaves the set when the delete fails or is undone.
  const [hiddenIds, setHiddenIds] = useState<readonly string[]>([]);
  const hide = useCallback((id: string) => setHiddenIds((ids) => [...ids, id]), []);
  const unhide = useCallback(
    (id: string) => setHiddenIds((ids) => ids.filter((x) => x !== id)),
    [],
  );

  // ---- "now" for bucketing ------------------------------------------------
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), NOW_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // ---- derived list -------------------------------------------------------
  const untitled = t("newTitle");
  const allItems = useMemo(
    () => (allQuery.data ?? []).filter((c) => !hiddenIds.includes(c.conversationId)),
    [allQuery.data, hiddenIds],
  );
  const searchItems = useMemo(
    () => (searchQuery.data ?? []).filter((c) => !hiddenIds.includes(c.conversationId)),
    [searchQuery.data, hiddenIds],
  );
  const searching = searchTerm !== "";
  const groups = useMemo<ZibbyConversationGroup[]>(
    () =>
      groupConversations(searchItems, now, {
        today: t("groups.today"),
        yesterday: t("groups.yesterday"),
        thisWeek: t("groups.thisWeek"),
        older: t("groups.older"),
      }).map((group) => ({
        label: group.label,
        items: group.items.map((c) => ({
          id: c.conversationId,
          title: c.title || untitled,
          time: formatConversationTime(c.updatedAt, now, locale),
          ...(searching && c.snippet ? { snippet: c.snippet } : {}),
          active: c.conversationId === conversationId,
        })),
      })),
    [searchItems, now, t, untitled, locale, searching, conversationId],
  );
  const activeTitle = allItems.find((c) => c.conversationId === conversationId)?.title || untitled;

  // ---- toast --------------------------------------------------------------
  const [toast, setToast] = useState<ZibbyConversationsToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearToastTimer = useCallback(() => {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = null;
  }, []);
  const dismissToast = useCallback(() => {
    clearToastTimer();
    setToast(null);
  }, [clearToastTimer]);
  const showToast = useCallback(
    (message: string, undo?: () => void) => {
      clearToastTimer();
      setToast({
        message,
        ...(undo
          ? {
              undo: () => {
                clearToastTimer();
                setToast(null);
                undo();
              },
            }
          : {}),
      });
      toastTimer.current = setTimeout(() => {
        toastTimer.current = null;
        setToast(null);
      }, TOAST_DURATION_MS);
    },
    [clearToastTimer],
  );
  useEffect(() => clearToastTimer, [clearToastTimer]);

  // ---- latest values for identity-stable callbacks -------------------------
  const clearMutation = useClearChatConversationMutation();
  const deleteMutation = useDeleteChatConversationMutation();
  const renameMutation = useRenameChatConversationMutation();
  const restoreMutation = useRestoreChatConversationMutation();
  const latest = useRef({
    conversationId,
    messages,
    busy,
    t,
    allItems,
    clearMutation,
    deleteMutation,
    renameMutation,
    restoreMutation,
  });
  useEffect(() => {
    latest.current = {
      conversationId,
      messages,
      busy,
      t,
      allItems,
      clearMutation,
      deleteMutation,
      renameMutation,
      restoreMutation,
    };
  });

  /** Latest-wins guard: a slow transcript fetch must not overwrite a newer pick. */
  const loadSeq = useRef(0);
  /**
   * Load a conversation's transcript into the thread (the old sidebar's
   * mechanism). `keepAbout` leaves the sticky context alone (used when
   * re-loading the thread that is already active).
   */
  const loadConversation = useCallback(
    async (id: string, keepAbout: boolean): Promise<boolean> => {
      const seq = ++loadSeq.current;
      try {
        const res = await apiClient.chat.getTranscript.query({ query: { conversationId: id } });
        if (seq !== loadSeq.current) return false;
        if (res.status !== 200) return false;
        setConversationId(res.body.conversationId);
        setMessages(res.body.messages);
        if (!keepAbout) setAbout(null);
        return true;
      } catch {
        return false;
      }
    },
    [setConversationId, setMessages, setAbout],
  );

  // ---- actions ------------------------------------------------------------
  const open = useCallback(
    (id: string) => {
      const s = latest.current;
      if (id === s.conversationId || s.busy) return;
      void loadConversation(id, false).then((ok) => {
        if (!ok) showToast(latest.current.t("errors.open"));
      });
    },
    [loadConversation, showToast],
  );

  const startNew = useCallback(() => {
    const s = latest.current;
    if (s.busy) return;
    const hadMessages = s.messages.length > 0;
    loadSeq.current++; // a pending open must not land on top of the fresh thread
    newChat();
    if (hadMessages) showToast(s.t("toast.savedInHistory"));
  }, [newChat, showToast]);

  const rename = useCallback(
    (id: string, title: string) => {
      const next = title.trim();
      if (!next) return;
      void latest.current.renameMutation
        .mutateAsync({ params: { conversationId: id }, body: { title: next } })
        .then(
          (res) => {
            if (res.status !== 200) showToast(latest.current.t("errors.rename"));
          },
          () => showToast(latest.current.t("errors.rename")),
        );
    },
    [showToast],
  );

  /** Undo of clear / delete: bring the snapshot back, then show it in the thread. */
  const restore = useCallback(
    (id: string, then: "reload" | "reopen" | "none") => {
      void latest.current.restoreMutation.mutateAsync({ params: { conversationId: id } }).then(
        async (res) => {
          if (res.status !== 200) {
            showToast(latest.current.t("errors.restore"));
            return;
          }
          unhide(id);
          if (then === "none") return;
          // "reload" refreshes the thread that is already active (keeps its `about`);
          // "reopen" switches back to a deleted-and-restored one.
          const ok = await loadConversation(id, then === "reload");
          if (!ok) showToast(latest.current.t("errors.open"));
        },
        () => showToast(latest.current.t("errors.restore")),
      );
    },
    [loadConversation, showToast, unhide],
  );

  const clearActive = useCallback(() => {
    const s = latest.current;
    const id = s.conversationId;
    if (!id || s.busy || s.messages.length === 0) return;
    const previous = s.messages;
    loadSeq.current++;
    setMessages([]);
    const rollback = () => {
      // Only put the messages back if nothing else filled or replaced the thread meanwhile.
      if (latest.current.conversationId === id) {
        setMessages((current) => (current.length === 0 ? previous : current));
      }
      showToast(latest.current.t("errors.clear"));
    };
    void s.clearMutation.mutateAsync({ params: { conversationId: id } }).then((res) => {
      if (res.status !== 200) {
        rollback();
        return;
      }
      showToast(latest.current.t("toast.cleared"), () => restore(id, "reload"));
    }, rollback);
  }, [setMessages, showToast, restore]);

  const remove = useCallback(
    (id: string) => {
      const s = latest.current;
      const isActive = id === s.conversationId;
      if (isActive && s.busy) return;
      const listed = s.allItems.find((c) => c.conversationId === id);
      // A fresh, empty thread was never stored — nothing to delete.
      if (!listed && !(isActive && s.messages.length > 0)) return;
      const title = listed?.title || s.t("newTitle");
      const previousMessages = s.messages;

      hide(id);
      if (isActive) {
        loadSeq.current++;
        newChat();
      }
      const rollback = () => {
        unhide(id);
        if (isActive && latest.current.conversationId !== id) {
          setConversationId(id);
          setMessages(previousMessages);
        }
        showToast(latest.current.t("errors.delete"));
      };
      void s.deleteMutation.mutateAsync({ params: { conversationId: id } }).then((res) => {
        if (res.status !== 200) {
          rollback();
          return;
        }
        showToast(latest.current.t("toast.deleted", { title }), () =>
          restore(id, isActive ? "reopen" : "none"),
        );
      }, rollback);
    },
    [hide, unhide, newChat, setConversationId, setMessages, showToast, restore],
  );

  return {
    activeId: conversationId,
    activeTitle,
    count: allItems.length,
    query,
    setQuery,
    groups,
    loading: searchQuery.isLoading,
    busy,
    open,
    startNew,
    rename,
    clearActive,
    remove,
    toast,
    dismissToast,
  };
}
