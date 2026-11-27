"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { GoalRollupStatus } from "@zibby/contracts";
import {
  EmptyState,
  IterationTimeline,
  IterationTimelineItem,
  ListToolbar,
  SegmentedControl,
  Stack,
  Typography,
} from "@zibby/design-system";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useGoalTimelineQuery } from "../queries";
import {
  type GoalNames,
  formatGoalDate,
  formatGoalTime,
  goalCycles,
  goalEventMark,
} from "../goalView";

export enum GoalCycleTimelineTestId {
  Order = "goal-cycles-order",
  Empty = "goal-cycles-empty",
  Loading = "goal-cycles-loading",
}

export interface GoalCycleTimelineProps {
  goalId: string;
  /** Instance keys, for the filter chips. */
  instances: string[];
  names: GoalNames;
  /** Standing goals title each cycle "Cyklus N"; a one-off goal has one "Průběh". */
  standing: boolean;
  /** The live cycle index and roll-up (absent while the state loads): the live cycle's tone. */
  liveIndex?: number;
  status?: GoalRollupStatus;
}

/** A cycle shows its newest rows; the item toggle reveals the rest. */
const COLLAPSED_ROWS = 5;

/** "Co se dělo": one timeline item per cycle, the events as its rows, filterable per instance. */
export function GoalCycleTimeline({
  goalId,
  instances,
  names,
  standing,
  liveIndex,
  status,
}: GoalCycleTimelineProps) {
  const t = useTranslations("goals");
  const g = useTranslations("bridge.widgets.goals");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [instance, setInstance] = useState<string>("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const timeline = useGoalTimelineQuery(goalId, instance === "all" ? undefined : instance);
  const cycles = goalCycles(timeline.data ?? [], liveIndex, status);
  const ordered = newestFirst ? cycles : [...cycles].reverse();
  const instanceLabel = (key: string) =>
    key === "_" ? t("timeline.noProject") : names.projectName(key);
  const toggle = (index: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  return (
    <Stack gap="150">
      <Stack wrap align="center" direction="row" gap="150">
        <Typography type="h3">{g("whatHappened")}</Typography>
        <Stack grow />
        <div data-testid={GoalCycleTimelineTestId.Order}>
          <SegmentedControl
            ariaLabel={t("detail.order")}
            items={[
              { value: "newest", label: t("detail.newestFirst") },
              { value: "oldest", label: t("detail.oldestFirst") },
            ]}
            onChange={(v) => setNewestFirst(v === "newest")}
            size="sm"
            value={newestFirst ? "newest" : "oldest"}
          />
        </div>
      </Stack>
      {instances.length > 1 && (
        <ListToolbar
          activeChip={instance}
          chips={[
            { id: "all", label: t("timeline.allInstances") },
            ...instances.map((key) => ({ id: key, label: instanceLabel(key) })),
          ]}
          onChipChange={setInstance}
        />
      )}
      {timeline.isError ? (
        <QueryError onRetry={() => void timeline.refetch()} />
      ) : timeline.isPending ? (
        <Typography
          data-testid={GoalCycleTimelineTestId.Loading}
          size="caption"
          type="note"
          variant="tertiary"
        >
          {tc("loading")}
        </Typography>
      ) : cycles.length === 0 ? (
        <EmptyState
          body={t("timeline.emptyBody")}
          data-testid={GoalCycleTimelineTestId.Empty}
          icon="clock"
          title={t("timeline.emptyTitle")}
        />
      ) : (
        <IterationTimeline ariaLabel={g("whatHappened")}>
          {ordered.map((cycle) => {
            const title =
              standing || cycles.length > 1
                ? t("timeline.cycle", { n: cycle.index + 1 })
                : t("detail.progress");
            const expanded = open.has(cycle.index);
            const collapsible = cycle.events.length > COLLAPSED_ROWS;
            const shown =
              collapsible && !expanded ? cycle.events.slice(0, COLLAPSED_ROWS) : cycle.events;
            const from = formatGoalDate(cycle.from, locale);
            const to = formatGoalDate(cycle.to, locale);
            return (
              <IterationTimelineItem
                expanded={expanded}
                key={cycle.index}
                marker={cycle.index + 1}
                meta={
                  <span>
                    {t("detail.cycleMeta", {
                      count: cycle.events.length,
                      range: from === to ? from : `${from} – ${to}`,
                    })}
                  </span>
                }
                onToggle={collapsible ? () => toggle(cycle.index) : undefined}
                rows={(newestFirst ? shown : [...shown].reverse()).map((e) => ({
                  label: formatGoalTime(e.at, locale),
                  ...goalEventMark(e.kind),
                  text:
                    instances.length > 1 && e.instance !== "*"
                      ? `${instanceLabel(e.instance)}: ${e.text}`
                      : e.text,
                }))}
                title={title}
                toggleLabel={t(expanded ? "detail.showLess" : "detail.showAll", { title })}
                tone={cycle.tone}
              />
            );
          })}
        </IterationTimeline>
      )}
    </Stack>
  );
}
