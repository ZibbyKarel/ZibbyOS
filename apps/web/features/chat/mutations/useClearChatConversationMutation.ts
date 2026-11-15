import { apiClient } from "../../../state/api";
import { useInvalidateChatConversations } from "./useInvalidateChatConversations";

/**
 * POST /api/chat/conversations/:conversationId/clear: snapshot to the trash, then empty in place; 200 -> { conversationId }.
 * Call: `.mutate({ params: { conversationId } })`.
 * Refreshes the history list and the cached transcripts on success.
 */
export function useClearChatConversationMutation() {
  const invalidate = useInvalidateChatConversations({ transcript: true });
  return apiClient.chat.clearConversation.useMutation({ onSuccess: invalidate });
}
