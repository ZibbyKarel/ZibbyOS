"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ChatWidget } from "@zibby/contracts";
import { useNow } from "../../../hooks/useNow";
import { compactAgo } from "../../../utils/time";
import { visibleItems } from "../../inbox/inbox";
import { useInboxItemsQuery } from "../../inbox/queries";
import { type IssueRowVm, issueRow } from "../../bridge/state/rows";
import { useBridgeInboxFilters } from "../../bridge/state/useBridgeInboxFilters";
import { ChatWidgetFrame, ChatWidgetRow, takeRows, widgetStatus } from "./ChatWidgetFrame";

export enum IssuesWidgetCardTestId {
  Root = "issues-widget-card",
}

export interface IssuesWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "issues" }>;
}

/**
 * `issues` — the open issues the dashboard Issues widget lists (`useInboxItemsQuery`, stored
 * inbox filters, done + hidden off, the screen's own order), flat. Row -> the issue detail
 * `/dashboard/inbox/issues/<projectId>/<itemId>` (`IssueRowVm.id` is that `chainKey`).
 */
export function IssuesWidgetCard({ widget }: IssuesWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const tIssues = useTranslations("bridge.widgets.issues");
  const now = useNow(60_000);
  const filters = useBridgeInboxFilters();
  const query = useInboxItemsQuery();

  const rows = useMemo(() => {
    const items = visibleItems(query.data?.items ?? [], {
      filters,
      search: "",
      showDone: false,
      showHidden: false,
    }).filter((item) => !widget.projectId || item.project.id === widget.projectId);
    return items.map((item) => issueRow("zibby", item, [], (iso) => compactAgo(iso, now)));
  }, [query.data, filters, widget.projectId, now]);

  const { shown, hiddenCount } = takeRows(rows, widget.limit);
  const stateText = (r: IssueRowVm) =>
    r.status === "new" || r.status === "running"
      ? (r.sourceStatus ?? t("issues.open"))
      : tIssues(`state.${r.status}`);

  return (
    <ChatWidgetFrame
      count={rows.length}
      emptyText={t("issues.empty")}
      hiddenCount={hiddenCount}
      onRetry={() => void query.refetch()}
      openHref="/dashboard/inbox"
      rootTestId={IssuesWidgetCardTestId.Root}
      status={widgetStatus({
        isPending: query.isPending,
        isError: query.isError,
        count: rows.length,
      })}
      title={widget.title ?? t("issues.title")}
    >
      {shown.map((r) => (
        <ChatWidgetRow
          href={`/dashboard/inbox/issues/${r.id}`}
          itemKey={r.id.replace("/", "-")}
          key={r.id}
          linkLabel={t("issues.openAria", { title: r.title })}
          meta={[r.code, r.project, ...(r.pr ? [r.pr] : []), r.age].join(" · ")}
          statusLabel={stateText(r)}
          title={r.title}
          tone={r.tone}
        />
      ))}
    </ChatWidgetFrame>
  );
}
