"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ChatWidget, InboxPr, Project } from "@zibby/contracts";
import type { DotTone } from "@zibby/design-system";
import { useNow } from "../../../hooks/useNow";
import { compactAgo } from "../../../utils/time";
import { passesFilters, prListHref } from "../../inbox/inbox";
import { useInboxPrsQuery } from "../../inbox/queries";
import { type PrRowVm, prRow } from "../../bridge/state/rows";
import { useBridgeInboxFilters } from "../../bridge/state/useBridgeInboxFilters";
import { useProjectsQuery } from "../../projects/queries";
import { ChatWidgetFrame, ChatWidgetRow, takeRows, widgetStatus } from "./ChatWidgetFrame";

export enum PrsWidgetCardTestId {
  Root = "prs-widget-card",
}

export interface PrsWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "prs" }>;
}

/** A PR carries no project id — only `org/repo`. A project owns it when its git remote ends in that repo. */
export function projectOwnsRepo(project: Pick<Project, "gitRemote"> | undefined, repo: string) {
  const remote = project?.gitRemote
    ?.replace(/\.git$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
  return remote !== undefined && remote.endsWith(repo.toLowerCase());
}

const rowTone = (tone: PrRowVm["tone"]): DotTone => (tone === "neutral" ? "idle" : tone);

/** What waits on me first, then the newest change. */
function byUrgency(a: { row: PrRowVm; at: number }, b: { row: PrRowVm; at: number }) {
  if (a.row.needsYou !== b.row.needsYou) return a.row.needsYou ? -1 : 1;
  return b.at - a.at;
}

/**
 * `prs` — open pull requests (the operator's own + review requests), the same set the
 * dashboard PR widget lists (`useInboxPrsQuery` + the stored inbox filters), flattened and
 * ordered by what waits on the operator, then by last change. Row -> the PR detail on
 * `/dashboard/inbox/pull-requests?pr=<url>`. `projectId` narrows by the project's git remote.
 */
export function PrsWidgetCard({ widget }: PrsWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const tPrs = useTranslations("bridge.widgets.prs");
  const now = useNow(60_000);
  const filters = useBridgeInboxFilters();
  const query = useInboxPrsQuery();
  const { data: projects } = useProjectsQuery();

  const rows = useMemo(() => {
    const project = widget.projectId
      ? (projects ?? []).find((p) => p.id === widget.projectId)
      : undefined;
    const prs: InboxPr[] = (query.data?.prs ?? []).filter(
      (p) => passesFilters(filters, p) && (!widget.projectId || projectOwnsRepo(project, p.repo)),
    );
    return prs
      .map((p) => ({
        row: prRow("zibby", p, (iso) => compactAgo(iso, now)),
        at: Date.parse(p.updatedAt ?? p.createdAt),
      }))
      .sort(byUrgency)
      .map((x) => x.row);
  }, [query.data, projects, filters, widget.projectId, now]);

  const { shown, hiddenCount } = takeRows(rows, widget.limit);

  return (
    <ChatWidgetFrame
      count={rows.length}
      emptyText={t("prs.empty")}
      hiddenCount={hiddenCount}
      onRetry={() => void query.refetch()}
      openHref="/dashboard/inbox/pull-requests"
      rootTestId={PrsWidgetCardTestId.Root}
      status={widgetStatus({
        isPending: query.isPending,
        isError: query.isError,
        count: rows.length,
      })}
      title={widget.title ?? t("prs.title")}
    >
      {shown.map((r) => (
        <ChatWidgetRow
          dim={r.muted}
          href={prListHref(r.id)}
          itemKey={`${r.project}${r.number}`}
          key={r.id}
          linkLabel={t("prs.openAria", { title: r.title })}
          meta={[
            r.needsYou ? tPrs("pill.you") : tPrs(`pill.${r.review}`),
            ...(r.draft ? [tPrs("pill.draft")] : []),
            `${r.project} ${r.number}`,
            r.age,
          ].join(" · ")}
          statusLabel={tPrs(`ci.${r.ci}`)}
          title={r.title}
          tone={rowTone(r.tone)}
        />
      ))}
    </ChatWidgetFrame>
  );
}
