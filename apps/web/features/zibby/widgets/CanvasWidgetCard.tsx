"use client";

import type { ChatWidget } from "@zibby/contracts";
import { CanvasCard } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { canvasUrls } from "../../canvas/canvasUrl";
import { useOptionalChat } from "../../chat/ChatContext";

export interface CanvasWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "canvas" }>;
}

/**
 * `canvas` — a page the agent published. Desktop: opens the side panel; phone: no split, the card
 * is a link that opens the page in the system browser (when the canvas origin is reachable).
 */
export function CanvasWidgetCard({ widget }: CanvasWidgetCardProps) {
  const t = useTranslations("zibby.canvas");
  const phone = useIsPhone();
  const chat = useOptionalChat();
  const { id, version, title } = widget;
  const urls = canvasUrls(id, version);
  const thumb = urls.frame ?? urls.external;
  const open = chat ? () => chat.openCanvas({ id, version, title }) : undefined;
  return (
    <CanvasCard
      href={phone ? (urls.external ?? undefined) : undefined}
      note={thumb ? undefined : t("card.openOnMac")}
      onOpen={phone ? undefined : open}
      // No canvas origin → nothing to preview; a blank page keeps the card shape.
      src={thumb ?? "about:blank"}
      title={title}
      version={version}
    />
  );
}
