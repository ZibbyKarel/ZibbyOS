import { apiClient } from "../../../state/api";
import { useInvalidateChatConversations } from "./useInvalidateChatConversations";

/**
 * DELETE /api/chat/conversations/:conversationId: soft delete (moved to the chat trash); 200 -> { conversationId }.
 * Call: `.mutate({ params: { conversationId } })`.
 * Refreshes the history list and the cached transcripts on success.
 */
export function useDeleteChatConversationMutation() {
  const invalidate = useInvalidateChatConversations({ transcript: true });
  return apiClient.chat.deleteConversation.useMutation({ onSuccess: invalidate });
}
