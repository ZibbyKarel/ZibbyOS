"use client";

import { useLocale, useTranslations } from "next-intl";
import type { GoalWithRollup } from "@zibby/contracts";
import { Button, Card, Container, Stack, Toggle, Typography } from "@zibby/design-system";
import { type GoalLabel, type GoalNames, goalScheduleLabel, goalScopeLabel } from "../goalView";
import { GoalStatusBadge } from "./GoalStatusBadge";

export enum GoalCardTestId {
  Root = "goal-card",
  Toggle = "goal-card-toggle",
  Open = "goal-card-open",
  Counts = "goal-card-counts",
}

export interface GoalCardProps {
  goal: GoalWithRollup;
  names: GoalNames;
  onToggle: () => void;
  onOpen: () => void;
}

/** One goal in the list: name, scope, schedule, roll-up pill with counts, enable switch. */
export function GoalCard({ goal, names, onToggle, onOpen }: GoalCardProps) {
  const t = useTranslations("goals");
  const locale = useLocale();
  const label = (l: GoalLabel) => t(l.key, l.values);
  const { counts, needsYou } = goal.rollup;

  return (
    <Card background="surface" data-testid={GoalCardTestId.Root}>
      <Container padding="200">
        <Stack gap="150">
          <Stack align="center" direction="row" gap="200" justify="between">
            <Container minW0>
              <Typography truncate size="base" type="note" weight="semibold">
                {goal.name}
              </Typography>
            </Container>
            <Toggle
              checked={goal.enabled}
              data-testid={GoalCardTestId.Toggle}
              label={t("toggleLabel", { name: goal.name })}
              onChange={onToggle}
              size="md"
            />
          </Stack>
          <Typography leading="snug" size="caption" type="note" variant="secondary">
            {label(goalScopeLabel(goal.scope, names))} · {label(goalScheduleLabel(goal, locale))}
          </Typography>
          <Stack wrap align="center" direction="row" gap="150" justify="between">
            <Stack align="center" direction="row" gap="100">
              <GoalStatusBadge status={goal.rollup.status} />
              <Typography
                data-testid={GoalCardTestId.Counts}
                size="caption"
                type="note"
                variant="tertiary"
              >
                {counts.total === 0
                  ? t("counts.none")
                  : needsYou > 0
                    ? t("counts.withNeedsYou", { done: counts.done, total: counts.total, needsYou })
                    : t("counts.progress", { done: counts.done, total: counts.total })}
              </Typography>
            </Stack>
            <Button
              data-testid={GoalCardTestId.Open}
              icon="arrow"
              intent="ghost"
              onClick={onOpen}
              size="sm"
            >
              {t("open")}
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Card>
  );
}
