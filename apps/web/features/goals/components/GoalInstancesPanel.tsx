"use client";

import { useTranslations } from "next-intl";
import type { GoalInstance } from "@zibby/contracts";
import {
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Stack,
  StatusBadge,
  Typography,
} from "@zibby/design-system";
import { type GoalNames, instanceStatusTone } from "../goalView";

export enum GoalInstancesTestId {
  Table = "goal-instances",
  Resume = "goal-instance-resume",
}

export interface GoalInstancesPanelProps {
  /** Keyed by projectId, or "_" for a goal without a project. */
  instances: Record<string, GoalInstance>;
  names: GoalNames;
  /** The instance key currently being resumed. */
  resuming?: string | null;
  onResume: (instance: string) => void;
}

interface Row {
  key: string;
  instance: GoalInstance;
}

/** Per-project roll-up: each instance's status and summary, with resume on parked rows. */
export function GoalInstancesPanel({
  instances,
  names,
  resuming,
  onResume,
}: GoalInstancesPanelProps) {
  const t = useTranslations("goals.instances");
  const rows: Row[] = Object.entries(instances).map(([key, instance]) => ({ key, instance }));

  const columns: DataTableColumn<Row>[] = [
    {
      key: "project",
      label: t("project"),
      width: "lg",
      render: (r) => (
        <Typography truncate size="base" type="note" weight="semibold">
          {r.key === "_" ? t("noProject") : names.projectName(r.key)}
        </Typography>
      ),
    },
    {
      key: "status",
      label: t("status"),
      width: "xl",
      render: ({ instance }) => (
        <Stack gap="25">
          <StatusBadge tone={instanceStatusTone(instance.status)}>
            {t(`state.${instance.status}`)}
          </StatusBadge>
          {instance.parkedReason && (
            <Typography size="caption" type="note" variant="secondary">
              {t(`parked.${instance.parkedReason}`)}
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      key: "summary",
      label: t("summary"),
      width: "flex",
      render: ({ instance }) => (
        <Typography leading="snug" size="caption" type="note" variant="secondary">
          {instance.summary ?? "—"}
        </Typography>
      ),
    },
    {
      key: "actions",
      label: "",
      width: "lg",
      align: "right",
      render: ({ key, instance }) =>
        instance.status === "parked" ? (
          <Button
            data-testid={`${GoalInstancesTestId.Resume}-${key}`}
            icon="play"
            intent="secondary"
            loading={resuming === key}
            onClick={() => onResume(key)}
            size="sm"
          >
            {t("resume")}
          </Button>
        ) : null,
    },
  ];

  if (rows.length === 0) {
    return <EmptyState body={t("emptyBody")} icon="flow" title={t("emptyTitle")} />;
  }
  return <DataTable columns={columns} getRowKey={(r) => r.key} rows={rows} />;
}
