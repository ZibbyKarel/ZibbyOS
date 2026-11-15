import { apiClient } from "../../../state/api";
import { useInvalidateChatConversations } from "./useInvalidateChatConversations";

/**
 * POST /api/chat/conversations/:conversationId/restore: bring back the trashed snapshot (the Undo toast); 200 -> ChatConversationSummary.
 * Call: `.mutate({ params: { conversationId } })`.
 * Refreshes the history list and the cached transcripts on success.
 */
export function useRestoreChatConversationMutation() {
  const invalidate = useInvalidateChatConversations({ transcript: true });
  return apiClient.chat.restoreConversation.useMutation({ onSuccess: invalidate });
}
