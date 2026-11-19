import { apiClient } from "../../../state/api";

/**
 * Rewrite one drafted review reply shorter / longer (`POST /api/inbox/prs/rewrite-reply`).
 * Stateless — nothing to invalidate; the caller puts the returned body into its draft.
 */
export function useRewriteInboxPrReplyMutation() {
  return apiClient.inbox.rewriteInboxPrReply.useMutation();
}
