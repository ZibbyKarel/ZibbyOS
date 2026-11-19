"use client";

import { useTranslations } from "next-intl";
import { Field, Grid, NumberField, Stack, Stepper } from "@zibby/design-system";
import type { GoalDraft } from "../goalDraft";

export interface GoalLimitsFieldsProps {
  draft: GoalDraft;
  onChange: (patch: Partial<GoalDraft>) => void;
  /** Grid columns: 3 on the wide create page, 2 in the side card (default). */
  columns?: 2 | 3;
}

/** The limit inputs of a goal: iteration fuse, run-count windows, monthly spend cap. Shared by create and edit. */
export function GoalLimitsFields({ draft, onChange, columns = 2 }: GoalLimitsFieldsProps) {
  const t = useTranslations("goalPage");
  return (
    <Grid cols={columns} gap="150">
      <Field label={t("maxIterations")}>
        {() => (
          <Stack align="start">
            <Stepper
              aria-label={t("maxIterations")}
              min={1}
              onChange={(v) => onChange({ maxIterations: v })}
              value={draft.maxIterations ?? 1}
            />
          </Stack>
        )}
      </Field>
      <NumberField
        label={t("runsPerDay")}
        min={1}
        onValueChange={(v) => onChange({ dailyRuns: v })}
        size="sm"
        value={draft.dailyRuns}
      />
      <NumberField
        label={t("runsPerWeek")}
        min={1}
        onValueChange={(v) => onChange({ weeklyRuns: v })}
        size="sm"
        value={draft.weeklyRuns}
      />
      <NumberField
        label={t("monthlySpend")}
        min={0}
        onValueChange={(v) => onChange({ monthlyCostCapUsd: v })}
        size="sm"
        value={draft.monthlyCostCapUsd}
      />
    </Grid>
  );
}
