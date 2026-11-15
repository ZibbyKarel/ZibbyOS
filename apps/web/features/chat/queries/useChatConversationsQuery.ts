import { keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

/** Prefix of every history-list cache entry (all search terms) — what mutations invalidate. */
export function getChatConversationsRootQueryKey() {
  return ["chat", "conversations"] as const;
}

/** Cache key for the chat history list (per search term). */
export function getChatConversationsQueryKey(q?: string) {
  return [...getChatConversationsRootQueryKey(), q ?? ""] as const;
}

/**
 * Past conversations (`GET /api/chat/conversations`), newest first. `q` is the
 * search string: the API then also returns a `snippet` per hit (title-only hits omit it).
 */
export function useChatConversationsQuery(q?: string) {
  return apiClient.chat.listConversations.useQuery({
    queryKey: getChatConversationsQueryKey(q),
    queryData: { query: q ? { q } : {} },
    placeholderData: keepPreviousData,
    select: selectApiResponseBody,
  });
}
