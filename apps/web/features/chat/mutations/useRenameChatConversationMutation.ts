import { apiClient } from "../../../state/api";
import { useInvalidateChatConversations } from "./useInvalidateChatConversations";

/**
 * PATCH /api/chat/conversations/:conversationId: body { title }; 200 -> ChatConversationSummary.
 * Call: `.mutate({ params: { conversationId }, body: { title } })`.
 * Refreshes the history list on success.
 */
export function useRenameChatConversationMutation() {
  const invalidate = useInvalidateChatConversations({ transcript: false });
  return apiClient.chat.renameConversation.useMutation({ onSuccess: invalidate });
}
