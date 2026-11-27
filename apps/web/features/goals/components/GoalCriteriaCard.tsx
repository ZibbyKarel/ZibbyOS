"use client";

import { useTranslations } from "next-intl";
import type { Goal } from "@zibby/contracts";
import { DetailTable, Icon, Stack, Typography } from "@zibby/design-system";

export enum GoalCriteriaTestId {
  Predicate = "goal-criteria-predicate",
  Item = "goal-criteria-item",
}

export interface GoalCriteriaCardProps {
  goal: Pick<Goal, "predicate" | "directional">;
}

/** "Splněno, když": the verifiable sentence, and a directional goal's checklist with done ticks. */
export function GoalCriteriaCard({ goal }: GoalCriteriaCardProps) {
  const t = useTranslations("goals");
  const checklist = goal.directional?.checklist;
  return (
    <Stack gap="150">
      <Typography
        data-testid={GoalCriteriaTestId.Predicate}
        size="base"
        type="note"
        variant={goal.predicate ? undefined : "secondary"}
      >
        {goal.predicate ?? t("settings.noPredicate")}
      </Typography>
      {checklist && (
        <Stack gap="50">
          <Typography size="2xs" type="label" variant="tertiary">
            {t("directional.checklist")}
          </Typography>
          {checklist.length === 0 ? (
            <Typography size="base" type="note" variant="secondary">
              {t("directional.noChecklist")}
            </Typography>
          ) : (
            <DetailTable
              rows={checklist.map((c) => ({
                cells: [
                  <Typography
                    data-checked={c.done}
                    data-testid={`${GoalCriteriaTestId.Item}-${c.id}`}
                    key="t"
                    size="base"
                    type="note"
                    variant={c.done ? undefined : "secondary"}
                  >
                    {c.title}
                  </Typography>,
                  <Icon key="i" name={c.done ? "check" : "dots"} size="sm" />,
                ],
              }))}
              variant="check"
            />
          )}
        </Stack>
      )}
    </Stack>
  );
}
