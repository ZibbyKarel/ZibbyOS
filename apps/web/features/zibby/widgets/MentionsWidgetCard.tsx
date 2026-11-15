"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ChannelItem, ChatWidget, IntegrationKind } from "@zibby/contracts";
import { Tag } from "@zibby/design-system";
import { useNow } from "../../../hooks/useNow";
import { compactAgo } from "../../../utils/time";
import { useChannelItemsQuery } from "../../integrations/queries";
import { mentionItems } from "../../bridge/widgets/MentionsWidget";
import { ChatWidgetFrame, ChatWidgetRow, takeRows, widgetStatus } from "./ChatWidgetFrame";

export enum MentionsWidgetCardTestId {
  Root = "mentions-widget-card",
  Source = "mentions-widget-source",
}

export interface MentionsWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "mentions" }>;
}

/** Channel kinds the card names; anything else falls back to the raw kind. */
const SOURCE_KINDS: readonly IntegrationKind[] = ["jira", "github", "slack", "email"];

/** Items still open for the operator: not ignored (via `mentionItems`) and not yet handled. */
export function openMentions(items: readonly ChannelItem[], projectId?: string): ChannelItem[] {
  return mentionItems(items).filter(
    (i) => i.state !== "handled" && (!projectId || i.projectId === projectId),
  );
}

/** First line, capped — the row's title is a preview, not the message. */
function preview(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}

/**
 * `mentions` — channel items (Jira / GitHub / Slack / e-mail, "mine and mentions" by ingest)
 * still waiting on the operator: source badge, sender, text preview, age. Data:
 * `useChannelItemsQuery` + the dashboard Mentions widget's `mentionItems` filter. Row ->
 * the channel inbox `/activity/channels` (the screen has no per-item deep link yet).
 */
export function MentionsWidgetCard({ widget }: MentionsWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const now = useNow(60_000);
  const query = useChannelItemsQuery();
  const rows = useMemo(
    () => openMentions(query.data ?? [], widget.projectId),
    [query.data, widget.projectId],
  );
  const { shown, hiddenCount } = takeRows(rows, widget.limit);
  const sourceLabel = (kind: IntegrationKind) =>
    (SOURCE_KINDS as readonly string[]).includes(kind) ? t(`mentions.source.${kind}`) : kind;

  return (
    <ChatWidgetFrame
      count={rows.length}
      emptyText={t("mentions.empty")}
      hiddenCount={hiddenCount}
      onRetry={() => void query.refetch()}
      openHref="/activity/channels"
      rootTestId={MentionsWidgetCardTestId.Root}
      status={widgetStatus({
        isPending: query.isPending,
        isError: query.isError,
        count: rows.length,
      })}
      title={widget.title ?? t("mentions.title")}
    >
      {shown.map((i) => (
        <ChatWidgetRow
          href="/activity/channels"
          itemKey={i.id}
          key={i.id}
          linkLabel={t("mentions.openAria", { title: preview(i.text) })}
          meta={[i.from ?? t("mentions.unknownSender"), compactAgo(i.receivedAt, now)].join(" · ")}
          statusLabel={t(`mentions.state.${i.state}`)}
          title={preview(i.text)}
          tone={i.state === "new" || i.state === "needs-draft" ? "wait" : "idle"}
          trailing={
            <Tag data-testid={`${MentionsWidgetCardTestId.Source}-${i.id}`} tone="neutral">
              {sourceLabel(i.kind)}
            </Tag>
          }
        />
      ))}
    </ChatWidgetFrame>
  );
}
