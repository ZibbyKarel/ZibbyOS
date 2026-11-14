"use client";

import { FeedRow } from "@zibby/design-system";
import type { ChannelItem, IntegrationKind } from "@zibby/contracts";
import { useMemo } from "react";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useNow } from "../../../hooks/useNow";
import { compactAgo } from "../../../utils/time";
import { useChannelItemsQuery } from "../../integrations/queries";
import type { BridgeWidgetProps } from "./registry";
import { useWidgetReport } from "./useWidgetReport";

export const MENTION_KINDS = [
  "jira",
  "github",
  "slack",
  "email",
] as const satisfies readonly IntegrationKind[];
export const MENTIONS_LIMIT = 50;

/** The feed's source glyphs (GH, JI, #, @); the data carries no unread flag, so no row is bold. */
const GLYPH: Partial<Record<IntegrationKind, string>> = {
  github: "GH",
  jira: "JI",
  slack: "#",
  email: "@",
};

/** Conversational channel items, dismissed ones dropped, newest first, capped. */
export function mentionItems(items: readonly ChannelItem[]): ChannelItem[] {
  return items
    .filter(
      (i) =>
        (MENTION_KINDS as readonly IntegrationKind[]).includes(i.kind) && i.state !== "ignored",
    )
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
    .slice(0, MENTIONS_LIMIT);
}

/**
 * Mentions: a read-only list of channel items (already "mine and mentions" by ingest) from Jira,
 * GitHub, Slack and email. List only — a row opens its source in a new tab; reply comes later.
 */
export function MentionsWidget({ widget, onEmptyChange, onCountChange }: BridgeWidgetProps) {
  const now = useNow(60_000);
  const query = useChannelItemsQuery();
  const rows = useMemo(() => mentionItems(query.data ?? []), [query.data]);

  useWidgetReport(
    {
      loading: query.isPending,
      count: query.isPending ? undefined : rows.length,
      you: 0,
      failed: query.isError,
    },
    { onEmptyChange, onCountChange },
  );

  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;

  return (
    <>
      {rows.map((i) => (
        <FeedRow
          age={compactAgo(i.receivedAt, now)}
          glyph={GLYPH[i.kind] ?? "·"}
          glyphLabel={i.kind}
          key={i.id}
          onClick={i.url ? () => window.open(i.url, "_blank", "noopener,noreferrer") : undefined}
          rowKey={`${widget.id}:${i.id}`}
          text={i.text}
          who={i.from}
        />
      ))}
    </>
  );
}
