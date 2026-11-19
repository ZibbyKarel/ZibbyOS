"use client";

import { useState } from "react";
import { Grid, KpiTile, Panel, Row, Sparkline, Stack, Typography } from "@zibby/design-system";
import { formatUsd } from "../../companies/components/CompanyCapsPanel";
import { useEntityT } from "../../entity/useEntityT";
import { useRunsQuery } from "../../runs";
import { useBudgetQuery, useProjectPrsQuery } from "../queries";
import { projectRunStats } from "../projectRunStats";

export enum ProjectOverviewKpisTestId {
  Strip = "project-overview-kpis",
  Pulse = "project-run-pulse",
}

export interface ProjectOverviewKpisProps {
  projectId: string;
  /** Connected integrations shown on this page and how many of them are down. */
  integrations: { total: number; down: number };
}

/** KPI strip of the project Overview: runs, success rate, spend vs cap, open PRs, integrations. */
export function ProjectOverviewKpis({ projectId, integrations }: ProjectOverviewKpisProps) {
  const t = useEntityT();
  const { runs } = useRunsQuery();
  const budget = useBudgetQuery().data?.projects.find((p) => p.projectId === projectId);
  const prs = useProjectPrsQuery(projectId, { enabled: Boolean(projectId) }).data ?? [];
  const [now] = useState(() => Date.now());
  const s = projectRunStats(runs, projectId, now);
  const spend = budget?.monthlyCost;
  return (
    <Grid cols={2} data-testid={ProjectOverviewKpisTestId.Strip} gap="150" lg={5}>
      <KpiTile label={t("project.kpi.runs")} trend={s.trend14d} value={String(s.runs30d)} />
      <KpiTile
        label={t("project.kpi.success")}
        trendTone="ok"
        unit={s.successPct === null ? undefined : "%"}
        value={s.successPct === null ? "—" : String(s.successPct)}
      />
      <KpiTile
        label={t("project.kpi.spend")}
        unit={spend?.capUsd ? `/ ${formatUsd(spend.capUsd)}` : undefined}
        value={formatUsd(spend?.spentUsd ?? 0)}
      />
      <KpiTile label={t("project.kpi.prs")} value={String(prs.length)} />
      <KpiTile
        label={t("project.kpi.integrations")}
        unit={
          integrations.down > 0 ? t("project.kpi.down", { count: integrations.down }) : undefined
        }
        value={String(integrations.total)}
      />
    </Grid>
  );
}

export interface ProjectRunPulseProps {
  projectId: string;
}

/** Header aside: runs in the last 24 h as a pulse line. */
export function ProjectRunPulse({ projectId }: ProjectRunPulseProps) {
  const t = useEntityT();
  const { runs } = useRunsQuery();
  const [now] = useState(() => Date.now());
  const s = projectRunStats(runs, projectId, now);
  return (
    <Panel data-testid={ProjectOverviewKpisTestId.Pulse} padding="150">
      <Stack gap="50">
        <Row gap="150" justify="between">
          <Typography size="xs" type="note" variant="tertiary">
            {t("project.pulse.caption")}
          </Typography>
          {s.running > 0 && (
            <Typography size="xs" tone="run" type="note">
              {t("project.pulse.running", { count: s.running })}
            </Typography>
          )}
        </Row>
        <Typography type="metric">{s.runs24h}</Typography>
        <Sparkline aria-label={t("project.pulse.caption")} data={s.pulse24h} />
      </Stack>
    </Panel>
  );
}
