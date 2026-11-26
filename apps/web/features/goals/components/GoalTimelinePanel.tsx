"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState, ListToolbar, Stack, Typography } from "@zibby/design-system";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useGoalTimelineQuery } from "../queries";
import { type GoalNames, formatGoalDateTime, groupTimelineByCycle } from "../goalView";

export enum GoalTimelineTestId {
  Empty = "goal-timeline-empty",
  Loading = "goal-timeline-loading",
  Cycle = "goal-timeline-cycle",
  Event = "goal-timeline-event",
}

export interface GoalTimelinePanelProps {
  goalId: string;
  /** Instance keys, for the filter chips. */
  instances: string[];
  names: GoalNames;
  /** Standing goals show a heading per cycle; one-off ones have a single cycle. */
  standing: boolean;
}

/** What happened, grouped by cycle (newest first), filterable per instance. */
export function GoalTimelinePanel({ goalId, instances, names, standing }: GoalTimelinePanelProps) {
  const t = useTranslations("goals.timeline");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [instance, setInstance] = useState<string>("all");
  const timeline = useGoalTimelineQuery(goalId, instance === "all" ? undefined : instance);
  const groups = groupTimelineByCycle(timeline.data ?? []);
  const instanceLabel = (key: string) =>
    key === "_" ? t("noProject") : key === "*" ? t("allInstances") : names.projectName(key);

  return (
    <Stack gap="200">
      {instances.length > 1 && (
        <ListToolbar
          activeChip={instance}
          chips={[
            { id: "all", label: t("allInstances") },
            ...instances.map((key) => ({ id: key, label: instanceLabel(key) })),
          ]}
          onChipChange={setInstance}
        />
      )}
      {timeline.isError ? (
        <QueryError onRetry={() => void timeline.refetch()} />
      ) : timeline.isPending ? (
        <Typography
          data-testid={GoalTimelineTestId.Loading}
          size="caption"
          type="note"
          variant="tertiary"
        >
          {tc("loading")}
        </Typography>
      ) : groups.length === 0 ? (
        <EmptyState
          body={t("emptyBody")}
          data-testid={GoalTimelineTestId.Empty}
          icon="clock"
          title={t("emptyTitle")}
        />
      ) : (
        groups.map(({ cycle, events }) => (
          <Stack data-testid={`${GoalTimelineTestId.Cycle}-${cycle}`} gap="100" key={cycle}>
            {(standing || groups.length > 1) && (
              <Typography size="caption" type="label" variant="tertiary">
                {t("cycle", { n: cycle + 1 })}
              </Typography>
            )}
            {events.map((e, i) => (
              <Stack
                align="start"
                data-testid={GoalTimelineTestId.Event}
                direction="row"
                gap="150"
                key={`${e.at}-${i}`}
              >
                <Typography mono size="2xs" type="micro" variant="tertiary">
                  {formatGoalDateTime(e.at, locale)}
                </Typography>
                <Typography leading="snug" size="caption" type="note">
                  {instances.length > 1 && e.instance !== "*"
                    ? `${instanceLabel(e.instance)}: `
                    : ""}
                  {e.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ))
      )}
    </Stack>
  );
}
