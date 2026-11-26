"use client";

import type { GoalRollupStatus, GoalWithRollup } from "@zibby/contracts";
import {
  BoardLine,
  BoardRow,
  BoardText,
  Container,
  Dropdown,
  Stack,
  type SubNavLinkComponent,
  TextLink,
  Typography,
} from "@zibby/design-system";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { QueryError } from "../../../components/LoadError/QueryError";
import { GoalStatusBadge } from "../../goals/components/GoalStatusBadge";
import { goalScheduleLabel } from "../../goals/goalView";
import { useGoalTimelineQuery, useGoalsQuery } from "../../goals/queries";
import type { BridgeWidgetProps, WidgetSettingsProps } from "./registry";
import { useWidgetReport } from "./useWidgetReport";

export enum GoalsWidgetTestId {
  Row = "goals-widget-row",
  Counts = "goals-widget-counts",
  Latest = "goals-widget-latest",
  Empty = "goals-widget-empty",
  NoMatch = "goals-widget-no-match",
  Select = "goals-widget-select",
}

/** needs-you first, then the busy ones, waiting, done, paused. */
const STATUS_ORDER: Record<GoalRollupStatus, number> = {
  "needs-you": 0,
  acting: 1,
  planning: 1,
  waiting: 2,
  done: 3,
  paused: 4,
};

/**
 * The goals a widget shows: its `scope.goalIds` pick (ids that no longer exist are ignored), or
 * every enabled goal when none is picked. Sorted by roll-up group, then name.
 */
export function widgetGoals(goals: readonly GoalWithRollup[], ids?: readonly string[]) {
  return (ids?.length ? goals.filter((g) => ids.includes(g.id)) : goals.filter((g) => g.enabled))
    .slice()
    .sort(
      (a, b) =>
        STATUS_ORDER[a.rollup.status] - STATUS_ORDER[b.rollup.status] ||
        a.name.localeCompare(b.name),
    );
}

function GoalRow({
  goal,
  widgetId,
  selection,
  onOpen,
}: { goal: GoalWithRollup; widgetId: string } & Pick<BridgeWidgetProps, "selection" | "onOpen">) {
  const t = useTranslations("goals");
  const tw = useTranslations("bridge.widgets.goals");
  const locale = useLocale();
  const key = `${widgetId}:${goal.id}`;
  const { counts, needsYou, status } = goal.rollup;
  const latest = useGoalTimelineQuery(goal.id).data?.at(-1);
  const schedule = goalScheduleLabel(goal, locale);
  return (
    <BoardRow
      needsYou={needsYou > 0}
      onClick={() => onOpen({ kind: "goal", id: goal.id, widgetId, key })}
      rowKey={key}
      selected={selection?.key === key}
      shape="list"
      tone="neutral"
    >
      <BoardLine between end={<GoalStatusBadge status={status} />} gap="6">
        <span data-testid={GoalsWidgetTestId.Row}>
          <BoardText kind="rowTitle">{goal.name}</BoardText>
        </span>
      </BoardLine>
      <BoardLine wrap gap="6">
        <BoardText data-testid={GoalsWidgetTestId.Counts} kind="rowMeta">
          {counts.total === 0
            ? t("counts.none")
            : needsYou > 0
              ? t("counts.withNeedsYou", { done: counts.done, total: counts.total, needsYou })
              : t("counts.progress", { done: counts.done, total: counts.total })}
        </BoardText>
        <BoardText kind="rowMeta">· {t(schedule.key, schedule.values)}</BoardText>
      </BoardLine>
      <BoardLine gap="6">
        <BoardText data-testid={GoalsWidgetTestId.Latest} kind="reading">
          {latest ? latest.text : tw("noEvents")}
        </BoardText>
      </BoardLine>
    </BoardRow>
  );
}

/**
 * Goals — status rows of the picked goals (`scope.goalIds`, absent = every enabled goal): name,
 * roll-up pill, counts, schedule and the latest timeline line. Needs-you goals sort first. A click
 * opens the goal sheet (full log + what is next). Live through the `goals` SSE scope.
 */
export function GoalsWidget({
  widget,
  onEmptyChange,
  onCountChange,
  selection,
  onOpen,
}: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.goals");
  const query = useGoalsQuery();
  const picked = widget.scope?.goalIds;
  const rows = widgetGoals(query.data ?? [], picked);
  const you = rows.filter((g) => g.rollup.status === "needs-you").length;
  useWidgetReport(
    {
      loading: query.isPending,
      count: query.isPending ? undefined : rows.length,
      you,
      failed: query.isError,
    },
    { onEmptyChange, onCountChange },
  );

  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;
  if (query.isPending) return null;
  if (rows.length === 0) {
    // Picks exist but none matches (deleted goals) vs. no goals at all.
    const noMatch = (picked?.length ?? 0) > 0 && (query.data?.length ?? 0) > 0;
    return (
      <Container padding="150">
        <Stack gap="75">
          <Typography
            data-testid={noMatch ? GoalsWidgetTestId.NoMatch : GoalsWidgetTestId.Empty}
            size="caption"
            type="note"
            variant="secondary"
          >
            {noMatch ? t("noMatch") : t("empty")}
          </Typography>
          <TextLink href="/work/goals" linkComponent={Link as SubNavLinkComponent}>
            {t("openGoals")}
          </TextLink>
        </Stack>
      </Container>
    );
  }
  return (
    <>
      {rows.map((g) => (
        <GoalRow goal={g} key={g.id} onOpen={onOpen} selection={selection} widgetId={widget.id} />
      ))}
    </>
  );
}

/** Settings: which goals the widget shows, saved as `scope.goalIds` (none = every enabled goal). */
export function GoalsWidgetSettings({ draft, onChange }: WidgetSettingsProps) {
  const t = useTranslations("bridge.widgets.goals");
  const tf = useTranslations("bridge.filterControls");
  const { data: goals = [] } = useGoalsQuery();
  return (
    <Stack data-testid={GoalsWidgetTestId.Select} gap="75">
      <Typography size="sm" type="note" variant="secondary">
        {t("goals")}
      </Typography>
      <Dropdown
        multi
        showSelectAll
        aria-label={t("goals")}
        deselectAllLabel={tf("deselectAll")}
        onChange={(ids) => onChange({ ...draft, scope: ids.length ? { goalIds: ids } : undefined })}
        options={goals.map((g) => ({ value: g.id, label: g.name }))}
        placeholder={t("allGoals")}
        selectAllLabel={tf("selectAll")}
        value={draft.scope?.goalIds ?? []}
      />
    </Stack>
  );
}
