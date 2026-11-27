"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Goal } from "@zibby/contracts";
import { DetailTable, Typography } from "@zibby/design-system";
import { type GoalLabel, type GoalNames, goalScheduleLabel, goalScopeLabel } from "../goalView";

export enum GoalSettingsTestId {
  Scope = "goal-settings-scope",
  Schedule = "goal-settings-schedule",
  Budget = "goal-settings-budget",
  Ceiling = "goal-settings-ceiling",
  Loop = "goal-settings-loop",
}

export interface GoalSettingsPanelProps {
  goal: Goal;
  names: GoalNames;
}

/**
 * The read-only settings as a key/value list (the side card "Nastavení"); its Edit swaps the
 * left column for the form. The outcome is the hero, the predicate the "Splněno, když" card.
 */
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
  const value = (testId: string, text: string, mono = false) => (
    <Typography data-testid={testId} mono={mono} size="base" type="note">
      {text}
    </Typography>
  );

  return (
    <DetailTable
      rows={[
        {
          cells: [
            t("form.scope"),
            value(GoalSettingsTestId.Scope, label(goalScopeLabel(goal.scope, names))),
          ],
        },
        { cells: [t("form.timing"), value(GoalSettingsTestId.Schedule, schedule)] },
        {
          cells: [
            t("settings.budget"),
            value(
              GoalSettingsTestId.Budget,
              budget.length > 0 ? budget.join(" · ") : t("settings.noBudget"),
              budget.length > 0,
            ),
          ],
        },
        {
          cells: [
            t("form.ceiling"),
            value(GoalSettingsTestId.Ceiling, t(`ceiling.${goal.ceiling}`)),
          ],
        },
        ...(goal.loop
          ? [
              {
                cells: [
                  t("card.role.loop"),
                  value(GoalSettingsTestId.Loop, goal.loop.loopId, true),
                ],
              },
            ]
          : []),
      ]}
    />
  );
}
