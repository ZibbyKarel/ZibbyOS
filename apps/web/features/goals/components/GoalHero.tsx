"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Grid,
  IterationGauge,
  Meter,
  type MeterTone,
  Stack,
  StatePill,
  type StateTone,
  Tag,
  TextAreaField,
  Typography,
} from "@zibby/design-system";
import type { Goal, TaskRun } from "@zibby/contracts";
import { DAY_MS, iterationsSince, monthSpendUsd, percentOf } from "../goal";

export interface GoalHeroProps {
  goal: Goal;
  /** The run shown (selected or latest). */
  run: TaskRun | undefined;
  /** Every run of this goal — the budget windows count across them. */
  goalRuns: readonly TaskRun[];
  nowMs: number;
  tone: StateTone;
  pillLabel: string;
  projectLabel?: string;
  makerLabel: string;
  verifierLabel: string;
  editing: boolean;
  objective: string;
  onObjectiveChange: (value: string) => void;
}

function meterTone(pct: number): MeterTone {
  return pct >= 100 ? "bad" : pct >= 80 ? "hot" : "ok";
}

/** Hero of the goal detail: state, the objective, tags, the iteration gauge and the run-budget meters. */
export function GoalHero({
  goal,
  run,
  goalRuns,
  nowMs,
  tone,
  pillLabel,
  projectLabel,
  makerLabel,
  verifierLabel,
  editing,
  objective,
  onObjectiveChange,
}: GoalHeroProps) {
  const t = useTranslations("goalPage");
  const locale = useLocale();
  const used = run?.iterations?.length ?? 0;
  const max = goal.maxIterations;
  const budget = goal.budget;
  const today = iterationsSince(goalRuns, nowMs, DAY_MS);
  const week = iterationsSince(goalRuns, nowMs, 7 * DAY_MS);
  const month = monthSpendUsd(goalRuns, nowMs);
  const monthPct = month === undefined ? 0 : percentOf(month, budget?.monthlyCostCapUsd);
  const dayPct = percentOf(today, budget?.dailyRuns);
  const weekPct = percentOf(week, budget?.weeklyRuns);
  const runsValue = (n: number, cap: number | undefined) =>
    cap ? t("runsOfCap", { n, cap }) : t("runsCount", { n });

  return (
    <Grid gap="300" sidebar="right">
      <Stack gap="150">
        <Stack align="center" direction="row" gap="100">
          <StatePill label={pillLabel} state={tone} />
          <Typography size="xs" type="note" variant="tertiary">
            {run
              ? t("startedAt", {
                  time: new Date(run.startedAt).toLocaleString(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })
              : t("neverRun")}
          </Typography>
        </Stack>
        {editing ? (
          <TextAreaField
            hint={t("objectiveEditHint")}
            label={t("objective")}
            onChange={(e) => onObjectiveChange(e.target.value)}
            rows={3}
            value={objective}
          />
        ) : (
          <Typography leading="relaxed" size="xl" type="bodyLg">
            {goal.objective}
          </Typography>
        )}
        <Stack wrap direction="row" gap="100">
          {projectLabel ? (
            <Tag icon="stack" tone="neutral">
              {projectLabel}
            </Tag>
          ) : null}
          <Tag icon="user" tone="neutral">
            {makerLabel}
          </Tag>
          <Tag icon="shield" tone="neutral">
            {verifierLabel}
          </Tag>
        </Stack>
      </Stack>
      <Stack wrap align="center" direction="row" gap="250">
        <IterationGauge
          ariaLabel={t("gaugeAria", { used, max })}
          caption={t("leftBeforePark", { n: Math.max(0, max - used) })}
          label={t("iterations")}
          max={max}
          ofLabel={t("ofMax", { max })}
          used={used}
        />
        <Stack grow gap="50">
          <Meter
            barLabel={t("today")}
            label={t("today")}
            pct={dayPct}
            tone={meterTone(dayPct)}
            value={runsValue(today, budget?.dailyRuns)}
          />
          <Meter
            barLabel={t("thisWeek")}
            label={t("thisWeek")}
            pct={weekPct}
            tone={meterTone(weekPct)}
            value={runsValue(week, budget?.weeklyRuns)}
          />
          {month !== undefined ? (
            <Meter
              barLabel={t("thisMonth")}
              label={t("thisMonth")}
              note={
                monthPct >= 80 && budget?.monthlyCostCapUsd
                  ? t("parksAt", { cap: budget.monthlyCostCapUsd })
                  : undefined
              }
              pct={monthPct}
              tone={meterTone(monthPct)}
              value={
                budget?.monthlyCostCapUsd
                  ? `$${month.toFixed(2)} / $${budget.monthlyCostCapUsd}`
                  : `$${month.toFixed(2)}`
              }
            />
          ) : null}
        </Stack>
      </Stack>
    </Grid>
  );
}
