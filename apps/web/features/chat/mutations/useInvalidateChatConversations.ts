import { useQueryClient } from "@tanstack/react-query";
import { getChatConversationsRootQueryKey } from "../queries/useChatConversationsQuery";
import { getChatTranscriptRootQueryKey } from "../queries/useChatTranscriptQuery";

/**
 * Invalidate the history list (every search term) and, when the conversation's
 * content changed, every cached transcript. Shared by the conversation-management mutations.
 */
export function useInvalidateChatConversations(options: { transcript: boolean }) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: getChatConversationsRootQueryKey() });
    if (options.transcript) {
      void queryClient.invalidateQueries({ queryKey: getChatTranscriptRootQueryKey() });
    }
  };
}
