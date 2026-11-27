"use client";

import { useTranslations } from "next-intl";
import type { GoalInstance } from "@zibby/contracts";
import { DetailTable, EmptyState, Stack, Typography } from "@zibby/design-system";
import type { GoalNames } from "../goalView";
import { GoalInstanceStatus } from "./GoalInstanceStatus";

export enum GoalInstancesTestId {
  List = "goal-instances",
  Summary = "goal-instance-summary",
}

export interface GoalInstancesPanelProps {
  /** Keyed by projectId, or "_" for a goal without a project. */
  instances: Record<string, GoalInstance>;
  names: GoalNames;
}

/**
 * Per-project roll-up for the side card: project, status pill (with the parked reason) and the
 * one-line summary. Resume lives on the waiting cards; what comes next in "Co bude".
 */
export function GoalInstancesPanel({ instances, names }: GoalInstancesPanelProps) {
  const t = useTranslations("goals.instances");
  const rows = Object.entries(instances);
  if (rows.length === 0) {
    return <EmptyState body={t("emptyBody")} icon="flow" title={t("emptyTitle")} />;
  }
  return (
    <div data-testid={GoalInstancesTestId.List}>
      <DetailTable
        rows={rows.map(([key, instance]) => ({
          cells: [
            <Typography truncate key="p" size="base" type="note" weight="semibold">
              {key === "_" ? t("noProject") : names.projectName(key)}
            </Typography>,
            <Stack gap="50" key="s">
              <GoalInstanceStatus instance={instance} instanceKey={key} />
              {instance.summary && (
                <Typography
                  data-testid={`${GoalInstancesTestId.Summary}-${key}`}
                  leading="snug"
                  size="caption"
                  type="note"
                  variant="secondary"
                >
                  {instance.summary}
                </Typography>
              )}
            </Stack>,
          ],
        }))}
      />
    </div>
  );
}
