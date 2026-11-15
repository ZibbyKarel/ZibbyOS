"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ChatWidget, CiStatus } from "@zibby/contracts";
import { Button } from "@zibby/design-system";
import { formatWhen } from "../../project-health/formatWhen";
import { useCiStatusQuery, useProjectsQuery } from "../../projects/queries";
import { ChatWidgetFrame, ChatWidgetRow, takeRows, widgetStatus } from "./ChatWidgetFrame";

export enum CiWidgetCardTestId {
  Root = "ci-widget-card",
  Fix = "ci-widget-fix",
}

export interface CiWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "ci" }>;
  /** Sends a follow-up message to Zibby; without it the "fix it" action is not rendered. */
  onPrompt?: (text: string) => void;
}

const statusKey = (c: CiStatus) => `${c.integrationId}--${c.adapterKind}`;

/** Red first, then the newest streak. */
export function sortCi(list: readonly CiStatus[]): CiStatus[] {
  return [...list].sort((a, b) =>
    a.state !== b.state
      ? a.state === "red"
        ? -1
        : 1
      : Date.parse(b.sinceAt) - Date.parse(a.sinceAt),
  );
}

/**
 * `ci` — the latest CI state of every watched source (`useCiStatusQuery`, optionally one
 * project): pass/fail dot + word, the deciding workflow/branch, since when. A red row offers
 * "Oprav to", which hands Zibby a concrete prompt through `onPrompt`. Row -> the deciding
 * CI run (`status.url`, external) is not an in-app route, so the row links to the project.
 */
export function CiWidgetCard({ widget, onPrompt }: CiWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const query = useCiStatusQuery(widget.projectId);
  const projects = useProjectsQuery();
  const names = new Map((projects.data ?? []).map((p) => [p.id, p.name]));

  const rows = useMemo(() => sortCi(query.data ?? []), [query.data]);
  const { shown, hiddenCount } = takeRows(rows, widget.limit);

  return (
    <ChatWidgetFrame
      count={rows.length}
      emptyText={t("ci.empty")}
      hiddenCount={hiddenCount}
      onRetry={() => void query.refetch()}
      rootTestId={CiWidgetCardTestId.Root}
      status={widgetStatus({
        isPending: query.isPending,
        isError: query.isError,
        count: rows.length,
      })}
      title={widget.title ?? t("ci.title")}
    >
      {shown.map((c) => {
        const red = c.state === "red";
        const project = (c.projectId && names.get(c.projectId)) || c.projectId || "";
        const since = formatWhen(c.sinceAt);
        return (
          <ChatWidgetRow
            href={c.projectId ? `/projects/${c.projectId}` : undefined}
            itemKey={statusKey(c)}
            key={statusKey(c)}
            linkLabel={t("ci.openAria", { name: c.summary })}
            meta={project}
            statusLabel={red ? t("ci.red", { since }) : t("ci.green", { since })}
            title={c.summary}
            tone={red ? "error" : "done"}
            trailing={
              red && onPrompt ? (
                <Button
                  aria-label={t("ci.fixAria", { name: c.summary })}
                  data-testid={`${CiWidgetCardTestId.Fix}-${statusKey(c)}`}
                  intent="primary"
                  onClick={() => onPrompt(t("ci.fixPrompt", { name: c.summary, project }))}
                  size="sm"
                >
                  {t("ci.fix")}
                </Button>
              ) : undefined
            }
          />
        );
      })}
    </ChatWidgetFrame>
  );
}
