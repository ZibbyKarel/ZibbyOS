"use client";

import type { GoalRollupStatus, GoalWithRollup } from "@zibby/contracts";
import {
  Container,
  Dropdown,
  Grid,
  Stack,
  type SubNavLinkComponent,
  TextLink,
  Typography,
} from "@zibby/design-system";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryError } from "../../../components/LoadError/QueryError";
import { GoalCard } from "../../goals/components/GoalCard";
import { useGoalsQuery } from "../../goals/queries";
import type { BridgeWidgetProps, WidgetSettingsProps } from "./registry";
import { useWidgetReport } from "./useWidgetReport";

export enum GoalsWidgetTestId {
  List = "goals-widget-list",
  Empty = "goals-widget-empty",
  NoMatch = "goals-widget-no-match",
  Select = "goals-widget-select",
}

/** needs-you first, then the busy ones, waiting and held (Manual), done, paused. */
const STATUS_ORDER: Record<GoalRollupStatus, number> = {
  "needs-you": 0,
  acting: 1,
  planning: 1,
  waiting: 2,
  held: 2,
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

// Compact cards show no scope or project names, so a goal's own ids are all they need.
const NAMES = { projectName: (id: string) => id, companyName: (id: string) => id };

/**
 * Goals — the same goal cards as the goals page, compact, in a grid that fills the widget's width
 * (`scope.goalIds` picks which, absent = every enabled goal). Needs-you goals sort first. A click
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
    <Container padding="100">
      {/* 1 column while the widget is narrow, more as it widens (no DS prop for auto-fill). */}
      <Grid
        data-testid={GoalsWidgetTestId.List}
        gap="100"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}
      >
        {rows.map((g) => {
          const key = `${widget.id}:${g.id}`;
          return (
            <GoalCard
              goal={g}
              key={g.id}
              names={NAMES}
              onOpen={() => onOpen({ kind: "goal", id: g.id, widgetId: widget.id, key })}
              rowKey={key}
              selected={selection?.key === key}
              size="compact"
            />
          );
        })}
      </Grid>
    </Container>
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
