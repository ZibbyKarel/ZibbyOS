"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ChatWidget, CiStatus, Project, ProjectHealthStatus } from "@zibby/contracts";
import type { DotTone } from "@zibby/design-system";
import { formatWhen } from "../../project-health/formatWhen";
import { useProjectHealthQuery } from "../../project-health/queries";
import { useCiStatusQuery, useProjectsQuery } from "../../projects/queries";
import { chatSelection } from "../../chat/chatDetail";
import { ChatWidgetFrame, ChatWidgetRow, takeRows, widgetStatus } from "./ChatWidgetFrame";

export enum ProjectStatusWidgetCardTestId {
  Root = "project-status-widget-card",
}

export interface ProjectStatusWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "project-status" }>;
}

export interface ProjectStatusVm {
  project: Project;
  ci: CiStatus | undefined;
  health: ProjectHealthStatus | undefined;
  /** CI red or site down. */
  attention: boolean;
}

/** Joins projects with their CI + health state; projects that need attention come first. */
export function projectStatusRows(
  projects: readonly Project[],
  ci: readonly CiStatus[],
  health: readonly ProjectHealthStatus[],
  projectId?: string,
): ProjectStatusVm[] {
  return projects
    .filter((p) => !projectId || p.id === projectId)
    .map((project) => {
      const reds = ci.filter((c) => c.projectId === project.id && c.state === "red");
      const any = ci.find((c) => c.projectId === project.id);
      const h = health.find((x) => x.projectId === project.id);
      const red = reds[0];
      return {
        project,
        ci: red ?? any,
        health: h,
        attention: red !== undefined || h?.state === "down",
      };
    })
    .sort((a, b) => Number(b.attention) - Number(a.attention));
}

/**
 * `project-status` — project health at a glance: one row per project (or the one given by
 * `projectId`), those needing attention first. Data: `useProjectsQuery`, the watched-CI
 * statuses (`useCiStatusQuery()` — all sources in one request) and `useProjectHealthQuery`
 * (site up/down). Row -> `/projects/<id>`.
 */
export function ProjectStatusWidgetCard({ widget }: ProjectStatusWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const projects = useProjectsQuery();
  const ci = useCiStatusQuery();
  const health = useProjectHealthQuery();

  const rows = useMemo(
    () =>
      projectStatusRows(projects.data ?? [], ci.data ?? [], health.data ?? [], widget.projectId),
    [projects.data, ci.data, health.data, widget.projectId],
  );
  const { shown, hiddenCount } = takeRows(rows, widget.limit);

  return (
    <ChatWidgetFrame
      count={rows.length}
      emptyText={t("projectStatus.empty")}
      hiddenCount={hiddenCount}
      onRetry={() => void projects.refetch()}
      openHref="/projects"
      rootTestId={ProjectStatusWidgetCardTestId.Root}
      status={widgetStatus({
        isPending: projects.isPending,
        isError: projects.isError,
        count: rows.length,
      })}
      title={widget.title ?? t("projectStatus.title")}
    >
      {shown.map((r) => {
        const ciText =
          r.ci?.state === "red"
            ? t("projectStatus.ciRed", { since: formatWhen(r.ci.sinceAt) })
            : r.ci
              ? t("projectStatus.ciGreen")
              : t("projectStatus.ciUnknown");
        const healthText = r.health
          ? r.health.state === "down"
            ? t("projectStatus.healthDown", { since: formatWhen(r.health.sinceAt) })
            : t("projectStatus.healthUp")
          : null;
        const tone: DotTone = r.attention ? "error" : r.ci || r.health ? "done" : "idle";
        return (
          <ChatWidgetRow
            detail={chatSelection("project", r.project.id)}
            href={`/projects/${r.project.id}`}
            itemKey={r.project.id}
            key={r.project.id}
            linkLabel={t("projectStatus.openAria", { name: r.project.name })}
            meta={[ciText, healthText].filter(Boolean).join(" · ")}
            statusLabel={r.attention ? t("projectStatus.attention") : t("projectStatus.ok")}
            title={r.project.name}
            tone={tone}
          />
        );
      })}
    </ChatWidgetFrame>
  );
}
