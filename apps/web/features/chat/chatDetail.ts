"use client";

import type { MouseEvent } from "react";
import { useIsPhone } from "../../hooks/useIsPhone";
import type { BridgeSelection } from "../bridge/widgets/registry";
import { useOptionalChat } from "./ChatContext";

/** Chat widget kinds that have a Bridge sheet to open in the overlay's side slot. */
export type ChatDetailKind = "issue" | "task" | "pr" | "run" | "approval" | "project";

/** A chat card's target as the selection the matching Bridge sheet takes (`id` = what that sheet's row uses). */
export const chatSelection = (kind: ChatDetailKind, id: string): BridgeSelection => ({
  kind,
  id,
  widgetId: "chat",
  key: `chat:${kind}:${id}`,
});

/**
 * Click handler that opens `detail` in the chat overlay's side slot instead of navigating. A plain
 * click only (modified clicks keep the link's own behaviour); `undefined` when there is no overlay
 * to open it in (outside the chat provider, or on a phone where the overlay has no side slot), so
 * the link navigates as before.
 */
export function useOpenDetail(
  detail: BridgeSelection | undefined,
): ((event: MouseEvent) => void) | undefined {
  const chat = useOptionalChat();
  const phone = useIsPhone();
  if (!detail || !chat || phone) return undefined;
  return (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    chat.openDetail(detail);
  };
}
