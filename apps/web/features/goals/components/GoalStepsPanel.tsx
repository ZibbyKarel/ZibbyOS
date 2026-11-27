"use client";

import { useTranslations } from "next-intl";
import type { GoalInstance } from "@zibby/contracts";
import { Stack, StatusBadge, Typography } from "@zibby/design-system";
import { type GoalNames, stepStatusTone } from "../goalView";

export enum GoalStepsTestId {
  List = "goal-steps",
  Group = "goal-steps-group",
  Title = "goal-step-title",
  Status = "goal-step-status",
  Note = "goal-step-note",
}

export interface GoalStepsPanelProps {
  /** Keyed by projectId, or "_" for a goal without a project. */
  instances: Record<string, GoalInstance>;
  names: GoalNames;
}

/**
 * The planner's step list per instance: title and status pill, with the note under a failed or
 * blocked step. Renders nothing when no instance has steps.
 */
export function GoalStepsPanel({ instances, names }: GoalStepsPanelProps) {
  const t = useTranslations("goals.steps");
  const groups = Object.entries(instances).filter(([, i]) => (i.steps?.length ?? 0) > 0);
  if (groups.length === 0) return null;
  return (
    <Stack data-testid={GoalStepsTestId.List} gap="250">
      {groups.map(([key, instance]) => (
        <Stack data-testid={`${GoalStepsTestId.Group}-${key}`} gap="100" key={key}>
          {groups.length > 1 && (
            <Typography size="caption" type="label" variant="tertiary">
              {key === "_" ? t("noProject") : names.projectName(key)}
            </Typography>
          )}
          {(instance.steps ?? []).map((step) => (
            <Stack align="start" gap="25" key={step.id}>
              <Stack align="center" direction="row" gap="100" justify="between">
                <Typography
                  data-testid={`${GoalStepsTestId.Title}-${key}-${step.id}`}
                  size="base"
                  type="note"
                >
                  {step.title}
                </Typography>
                <StatusBadge
                  data-testid={`${GoalStepsTestId.Status}-${key}-${step.id}`}
                  tone={stepStatusTone(step.status)}
                >
                  {t(`status.${step.status}`)}
                </StatusBadge>
              </Stack>
              {step.note && (step.status === "failed" || step.status === "blocked") && (
                <Typography
                  data-testid={`${GoalStepsTestId.Note}-${key}-${step.id}`}
                  leading="snug"
                  size="caption"
                  type="note"
                  variant="secondary"
                >
                  {step.note}
                </Typography>
              )}
            </Stack>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
