"use client";

import { useTranslations } from "next-intl";
import { Grid, NumberField } from "@zibby/design-system";
import type { GoalDraft } from "../goalDraft";

export interface GoalLimitsFieldsProps {
  draft: GoalDraft;
  onChange: (patch: Partial<GoalDraft>) => void;
}

/** The limit inputs of a goal: iteration fuse, run-count windows, monthly spend cap. Shared by create and edit. */
export function GoalLimitsFields({ draft, onChange }: GoalLimitsFieldsProps) {
  const t = useTranslations("goalPage");
  return (
    <Grid cols={2} gap="150">
      <NumberField
        label={t("maxIterations")}
        min={1}
        onValueChange={(v) => onChange({ maxIterations: v })}
        value={draft.maxIterations}
      />
      <NumberField
        label={t("monthlySpend")}
        min={0}
        onValueChange={(v) => onChange({ monthlyCostCapUsd: v })}
        value={draft.monthlyCostCapUsd}
      />
      <NumberField
        label={t("runsPerDay")}
        min={1}
        onValueChange={(v) => onChange({ dailyRuns: v })}
        value={draft.dailyRuns}
      />
      <NumberField
        label={t("runsPerWeek")}
        min={1}
        onValueChange={(v) => onChange({ weeklyRuns: v })}
        value={draft.weeklyRuns}
      />
    </Grid>
  );
}
