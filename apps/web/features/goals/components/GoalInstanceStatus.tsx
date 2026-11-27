"use client";

import { useTranslations } from "next-intl";
import type { GoalInstance } from "@zibby/contracts";
import { Stack, StatusBadge, Typography } from "@zibby/design-system";
import { instanceStatusTone } from "../goalView";

export enum GoalInstanceStatusTestId {
  Badge = "goal-instance-status",
  Reason = "goal-instance-reason",
  Held = "goal-instance-held",
}

export interface GoalInstanceStatusProps {
  instance: Pick<GoalInstance, "status" | "parkedReason" | "held">;
  /** Suffix of the test ids (the instance key). */
  instanceKey: string;
}

/**
 * An instance's status pill and why it is parked. The one place that names an instance's
 * state, so a new reason (e.g. held by a manual autonomy level) is added here only.
 */
export function GoalInstanceStatus({ instance, instanceKey }: GoalInstanceStatusProps) {
  const t = useTranslations("goals.instances");
  const tc = useTranslations("goals.card");
  return (
    <Stack align="start" gap="25">
      <StatusBadge
        data-testid={`${GoalInstanceStatusTestId.Badge}-${instanceKey}`}
        tone={instanceStatusTone(instance.status)}
      >
        {t(`state.${instance.status}`)}
      </StatusBadge>
      {instance.parkedReason && (
        <Typography
          data-testid={`${GoalInstanceStatusTestId.Reason}-${instanceKey}`}
          size="caption"
          type="note"
          variant="secondary"
        >
          {t(`parked.${instance.parkedReason}`)}
        </Typography>
      )}
      {instance.held && (
        <Typography
          data-testid={`${GoalInstanceStatusTestId.Held}-${instanceKey}`}
          size="caption"
          type="note"
          variant="secondary"
        >
          {tc("heldReason")}
        </Typography>
      )}
    </Stack>
  );
}
