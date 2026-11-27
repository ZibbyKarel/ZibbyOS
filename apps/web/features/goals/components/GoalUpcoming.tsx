"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Goal, GoalState } from "@zibby/contracts";
import { Stack, Typography } from "@zibby/design-system";
import { type GoalNames, formatGoalDateTime, goalUpcoming } from "../goalView";

export enum GoalUpcomingTestId {
  Root = "goal-upcoming",
  NextCycle = "goal-upcoming-next-cycle",
  Deadline = "goal-upcoming-deadline",
  WaitingOn = "goal-upcoming-waiting-on",
  WakeAt = "goal-upcoming-wake-at",
  Nothing = "goal-upcoming-nothing",
}

export interface GoalUpcomingProps {
  goal: Pick<Goal, "cadence" | "deadline" | "enabled">;
  state: GoalState;
  names: GoalNames;
  now: number;
}

function Line({ testId, children }: { testId: string; children: string }) {
  return (
    <Typography data-testid={testId} leading="snug" size="caption" type="note" variant="secondary">
      {children}
    </Typography>
  );
}

/** "Co bude": per instance what it waits on and when it wakes, the deadline and the next cycle. */
export function GoalUpcoming({ goal, state, names, now }: GoalUpcomingProps) {
  const g = useTranslations("bridge.widgets.goals");
  const t = useTranslations("goals");
  const locale = useLocale();
  const when = (iso: string) => formatGoalDateTime(iso, locale);
  const { nextCycleAt, deadlineAt } = goalUpcoming(goal, state, now);
  const entries = Object.entries(state.instances);
  const prefix = (key: string, line: string) =>
    entries.length > 1
      ? `${key === "_" ? t("instances.noProject") : names.projectName(key)}: ${line}`
      : line;
  const lines = entries.flatMap(([key, i]) => [
    ...(i.waitingOn ?? []).map((w) => (
      <Line key={`${key}:${w.kind}:${w.ref}`} testId={`${GoalUpcomingTestId.WaitingOn}-${key}`}>
        {prefix(key, g("waitingOn", { kind: g(`waiting.${w.kind}`), ref: w.ref }))}
      </Line>
    )),
    ...(i.wakeAt
      ? [
          <Line key={`${key}:wake`} testId={`${GoalUpcomingTestId.WakeAt}-${key}`}>
            {prefix(key, g("wakesAt", { when: when(i.wakeAt) }))}
          </Line>,
        ]
      : []),
  ]);

  return (
    <Stack data-testid={GoalUpcomingTestId.Root} gap="75">
      <Typography type="h3">{g("whatNext")}</Typography>
      {lines}
      {deadlineAt && (
        <Line testId={GoalUpcomingTestId.Deadline}>
          {g("deadline", { when: when(deadlineAt) })}
        </Line>
      )}
      {nextCycleAt && (
        <Line testId={GoalUpcomingTestId.NextCycle}>
          {g("nextCycle", { when: when(nextCycleAt) })}
        </Line>
      )}
      {entries.length === 0 && <Line testId={GoalUpcomingTestId.Nothing}>{g("nothingYet")}</Line>}
    </Stack>
  );
}
