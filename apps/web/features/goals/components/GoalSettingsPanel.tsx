"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Goal } from "@zibby/contracts";
import { Grid, Markdown, Stack, Typography } from "@zibby/design-system";
import { type GoalLabel, type GoalNames, goalScheduleLabel, goalScopeLabel } from "../goalView";

export enum GoalSettingsTestId {
  Outcome = "goal-settings-outcome",
  Predicate = "goal-settings-predicate",
  Scope = "goal-settings-scope",
  Schedule = "goal-settings-schedule",
  Budget = "goal-settings-budget",
  Ceiling = "goal-settings-ceiling",
}

export interface GoalSettingsPanelProps {
  goal: Goal;
  names: GoalNames;
}

function Fact({ label, children, testId }: { label: string; children: string; testId: string }) {
  return (
    <Stack gap="25">
      <Typography size="2xs" type="label" variant="tertiary">
        {label}
      </Typography>
      <Typography data-testid={testId} size="base" type="note">
        {children}
      </Typography>
    </Stack>
  );
}

/** The read-only settings view; the edit button on the detail page swaps it for the form. */
export function GoalSettingsPanel({ goal, names }: GoalSettingsPanelProps) {
  const t = useTranslations("goals");
  const locale = useLocale();
  const label = (l: GoalLabel) => t(l.key, l.values);
  const budget = [
    goal.budget?.maxRunsPerCycle !== undefined &&
      t("settings.maxRuns", { count: goal.budget.maxRunsPerCycle }),
    goal.budget?.maxCostUsdPerCycle !== undefined &&
      t("settings.maxCost", { cost: goal.budget.maxCostUsdPerCycle }),
  ].filter(Boolean);
  const schedule = [
    label(goalScheduleLabel(goal, locale)),
    goal.cycleHours !== undefined && t("settings.cycleHours", { count: goal.cycleHours }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Stack gap="200">
      <Stack data-testid={GoalSettingsTestId.Outcome} gap="50">
        <Typography size="2xs" type="label" variant="tertiary">
          {t("form.outcome")}
        </Typography>
        <Markdown source={goal.outcome} variant="prose" />
      </Stack>
      <Grid cols={1} gap="200" md={2}>
        <Fact label={t("form.predicate")} testId={GoalSettingsTestId.Predicate}>
          {goal.predicate ?? t("settings.noPredicate")}
        </Fact>
        <Fact label={t("form.scope")} testId={GoalSettingsTestId.Scope}>
          {label(goalScopeLabel(goal.scope, names))}
        </Fact>
        <Fact label={t("form.timing")} testId={GoalSettingsTestId.Schedule}>
          {schedule}
        </Fact>
        <Fact label={t("settings.budget")} testId={GoalSettingsTestId.Budget}>
          {budget.length > 0 ? budget.join(" · ") : t("settings.noBudget")}
        </Fact>
        <Fact label={t("form.ceiling")} testId={GoalSettingsTestId.Ceiling}>
          {t(`form.ceilingOption.${goal.ceiling}`)}
        </Fact>
      </Grid>
    </Stack>
  );
}
