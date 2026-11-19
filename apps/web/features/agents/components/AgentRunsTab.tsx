"use client";

import { useMemo } from "react";
import { useDetailT } from "../useDetailT";
import { DataTable, Grid, KpiTile, Stack, Tag, Typography } from "@zibby/design-system";
import type { RunView } from "../../runs/run";
import { type AgentRunStats, formatDuration, formatUsd, runDurationMs } from "../agentRunStats";
import { AgentDetailScreenTestId as TestId } from "../agentTestIds";

const RECENT_ROWS = 10;

export interface AgentRunsTabProps {
  stats: AgentRunStats;
  loading?: boolean;
}

/** "Runs & stats": five KPI tiles with sparklines and the latest runs (client-side aggregation). */
export function AgentRunsTab({ stats, loading }: AgentRunsTabProps) {
  const t = useDetailT();
  const when = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }),
    [],
  );
  return (
    <Stack data-testid={TestId.RunsTab} gap="200">
      <Grid cols={2} gap="150" lg={5} md={3}>
        <KpiTile label={t("kpiRuns")} trend={stats.series.runs} value={String(stats.runs)} />
        <KpiTile
          label={t("kpiSuccess")}
          trend={stats.series.successRate}
          trendTone="ok"
          unit={stats.successRate === null ? undefined : "%"}
          value={stats.successRate === null ? "—" : String(Math.round(stats.successRate))}
        />
        <KpiTile
          label={t("kpiCost")}
          trend={stats.series.avgCost}
          value={formatUsd(stats.avgCost)}
        />
        <KpiTile
          label={t("kpiDuration")}
          trend={stats.series.avgDurationMs}
          value={formatDuration(stats.avgDurationMs)}
        />
        <KpiTile label={t("kpiSpend")} trend={stats.series.spend} value={formatUsd(stats.spend)} />
      </Grid>
      <Stack gap="75">
        <DataTable<RunView>
          columns={[
            { key: "run", label: t("colRun"), width: "lg", render: (r) => r.runId.slice(0, 10) },
            {
              key: "task",
              label: t("colTask"),
              width: "flex",
              render: (r) => r.title || r.taskTitle || r.prompt.slice(0, 80),
            },
            {
              key: "verdict",
              label: t("colVerdict"),
              width: "md",
              render: (r) => (
                <Tag tone={r.status === "done" ? "ok" : r.status === "error" ? "bad" : "neutral"}>
                  {r.status}
                </Tag>
              ),
            },
            {
              key: "duration",
              label: t("colDuration"),
              width: "md",
              render: (r) => formatDuration(runDurationMs(r)),
            },
            { key: "cost", label: t("colCost"), width: "sm", render: (r) => formatUsd(r.costUsd) },
            {
              key: "when",
              label: t("colWhen"),
              width: "lg",
              render: (r) => when.format(new Date(r.startedAt)),
            },
          ]}
          empty={t("noRuns")}
          getRowKey={(r) => r.runId}
          loading={loading}
          rowHref={(r) => `/activity/runs/${r.runId}`}
          rows={stats.recent.slice(0, RECENT_ROWS)}
        />
        <Typography size="xs" type="note" variant="tertiary">
          {t("statsNote")}
        </Typography>
      </Stack>
    </Stack>
  );
}
