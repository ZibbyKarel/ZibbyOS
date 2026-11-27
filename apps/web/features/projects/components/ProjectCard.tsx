import type { Project, ProjectBudgetStatus } from "@zibby/contracts";
import {
  BudgetBars,
  CountGrid,
  IconTile,
  ListCard,
  SegmentedBar,
  Stack,
  Tag,
  Typography,
} from "@zibby/design-system";
import type { SegmentedBarTone, SubNavLinkComponent } from "@zibby/design-system";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { groupFilterParam } from "../../runs/statusGroups";
import type { RunStatusGroupKey } from "../../runs/statusGroups";
import { budgetWindowBars } from "../projectListStats";
import { useProjectTaskStats } from "../queries";

export interface ProjectCardProps {
  project: Project;
  /** Live budget status for this engagement (Phase 8.1) — usage bars + held count. */
  budget?: ProjectBudgetStatus;
  /** Runs blocked on the operator (approval / park / pause / held); shown as the amber chip. */
  needsYou?: number;
  onOpen?: (project: Project) => void;
  /** The project's company is not armed on this machine — shown, never run here. */
  otherMachine?: boolean;
}

const GROUP_TONE: Record<RunStatusGroupKey, SegmentedBarTone> = {
  running: "run",
  waiting: "warn",
  done: "ok",
  error: "bad",
  parked: "idle",
};

/**
 * Catalog card for a project (design Seznamy "Projekty"): name + mono path + category tag,
 * live chips, a status ratio bar over a 3x2 count grid whose cells deep-link into the runs
 * feed pre-filtered to this project, and day/week/month budget bars (only with a budget).
 *
 * Phase 78: deliberately no open-PR badge — it needs one GitHub round trip per project
 * (see `ProjectPullRequestsPanel`); the 14-day spend sparkline of the design is deferred.
 */
export function ProjectCard({
  project,
  budget,
  needsYou = 0,
  onOpen,
  otherMachine = false,
}: ProjectCardProps) {
  const t = useTranslations("projects");
  const tr = useTranslations("runs");
  const { total, groups } = useProjectTaskStats(project.id);
  const running = groups.find((g) => g.group.key === "running")?.count ?? 0;
  const bars = budgetWindowBars(budget, project.budget);
  const held = budget?.held ?? 0;

  return (
    <ListCard onOpen={() => onOpen?.(project)} openLabel={t("openAria", { name: project.name })}>
      <Stack align="start" direction="row" gap="150">
        {project.logo && <IconTile alt={project.name} glyph="code" size="sm" src={project.logo} />}
        <Stack grow gap="25">
          <Typography truncate size="md" type="note" weight="semibold">
            {project.name}
          </Typography>
          <Typography mono truncate size="caption" type="note" variant="tertiary">
            {project.path}
          </Typography>
          {(running > 0 || needsYou > 0 || held > 0) && (
            <Stack wrap direction="row" gap="150">
              {running > 0 && (
                <Typography size="caption" tone="run" type="note" weight="medium">
                  {t("runningCount", { count: running })}
                </Typography>
              )}
              {needsYou > 0 && (
                <Typography size="caption" tone="warn" type="note" weight="medium">
                  {t("needsYouCount", { count: needsYou })}
                </Typography>
              )}
              {held > 0 && (
                <Typography size="caption" tone="warn" type="note" weight="medium">
                  {t("budgetHeld")} {held}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
        {otherMachine && <Tag tone="warn">{t("otherMachine")}</Tag>}
        {project.category && <Tag tone="neutral">{project.category}</Tag>}
      </Stack>

      <SegmentedBar
        ariaLabel={t("statusRatioAria", { name: project.name })}
        segments={groups.map(({ group, count }) => ({
          id: group.key,
          value: count,
          tone: GROUP_TONE[group.key],
        }))}
      />

      {/* Typed routes can't infer a query-string template, so each href is cast `as Route`. */}
      <CountGrid
        items={[
          {
            id: "total",
            label: tr("group.total"),
            value: total,
            href: `/activity/runs?project=${project.id}` as Route,
            testId: "project-card-stat-total",
          },
          ...groups.map(({ group, count }) => ({
            id: group.key,
            label: tr(`group.${group.key}`),
            value: count,
            tone: GROUP_TONE[group.key],
            href: `/activity/runs?project=${project.id}&filter=${groupFilterParam(group)}` as Route,
            testId: `project-card-stat-${group.key}`,
          })),
        ]}
        linkComponent={Link as SubNavLinkComponent}
      />

      {bars.length > 0 && (
        <BudgetBars
          items={bars.map((b) => ({
            id: b.id,
            label: t(`budgetWindow.${b.id}`),
            pct: b.pct,
            detail: b.detail,
          }))}
        />
      )}
    </ListCard>
  );
}
