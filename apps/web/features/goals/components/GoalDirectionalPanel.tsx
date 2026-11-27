"use client";

import { useTranslations } from "next-intl";
import type { GoalInstance } from "@zibby/contracts";
import { Stack, Typography } from "@zibby/design-system";
import type { GoalNames } from "../goalView";

export enum GoalDirectionalTestId {
  Autonomy = "goal-directional-autonomy",
}

export interface GoalDirectionalPanelProps {
  instances: Record<string, GoalInstance>;
  names: GoalNames;
}

/**
 * Directional goal: each instance's effective autonomy. The checklist lives in the "Splněno,
 * když" card and this month's decisions in the hero meter.
 */
export function GoalDirectionalPanel({ instances, names }: GoalDirectionalPanelProps) {
  const t = useTranslations("goals.directional");
  const tc = useTranslations("goals.card");
  const entries = Object.entries(instances);
  return (
    <Stack gap="25">
      <Typography size="2xs" type="label" variant="tertiary">
        {t("autonomy")}
      </Typography>
      {entries.length === 0 && (
        <Typography size="base" type="note" variant="secondary">
          {t("why.unknown")}
        </Typography>
      )}
      {entries.map(([key, instance]) => {
        const a = instance.autoDecide;
        // A held instance does not plan: its last plan's level is history, the hold is now.
        const line = instance.held
          ? tc("heldReason")
          : a?.level === "auto"
            ? t("line.auto")
            : t("line.proposes", {
                why: t(`why.${a ? (a.reason === "level" ? a.level : a.reason) : "unknown"}`),
              });
        return (
          <Typography
            data-testid={`${GoalDirectionalTestId.Autonomy}-${key}`}
            key={key}
            size="base"
            type="note"
          >
            {key === "_" ? line : `${names.projectName(key)}: ${line}`}
          </Typography>
        );
      })}
    </Stack>
  );
}
