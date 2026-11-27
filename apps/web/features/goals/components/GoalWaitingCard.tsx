"use client";

import { useTranslations } from "next-intl";
import type { GoalInstance } from "@zibby/contracts";
import { Button, Panel, Stack, Typography } from "@zibby/design-system";
import { GoalInstanceStatus } from "./GoalInstanceStatus";

export enum GoalWaitingCardTestId {
  Root = "goal-waiting",
  Resume = "goal-waiting-resume",
}

export interface GoalWaitingCardProps {
  /** The instance key (projectId, or "_"). */
  instanceKey: string;
  /** Project name; absent for a goal without a project. */
  project?: string;
  instance: GoalInstance;
  resuming: boolean;
  onResume: () => void;
}

/** A parked instance: why it stopped, its summary, and "Pokračovat" (the resume API takes no note). */
export function GoalWaitingCard({
  instanceKey,
  project,
  instance,
  resuming,
  onResume,
}: GoalWaitingCardProps) {
  const t = useTranslations("goals");
  return (
    <Panel
      data-testid={`${GoalWaitingCardTestId.Root}-${instanceKey}`}
      header={t("status.needs-you")}
      headerEnd={project}
      headerRule={false}
      padding="200"
      role="alert"
      tone="warn"
    >
      <Stack gap="150">
        <GoalInstanceStatus instance={instance} instanceKey={instanceKey} />
        {instance.summary && (
          <Typography leading="relaxed" size="base" type="note" variant="secondary">
            {instance.summary}
          </Typography>
        )}
        <div>
          <Button
            data-testid={`${GoalWaitingCardTestId.Resume}-${instanceKey}`}
            icon="play"
            loading={resuming}
            onClick={onResume}
            size="sm"
          >
            {t("instances.resume")}
          </Button>
        </div>
      </Stack>
    </Panel>
  );
}
