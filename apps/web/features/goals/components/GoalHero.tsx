"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Goal, GoalRollup, GoalState } from "@zibby/contracts";
import {
  Container,
  IterationGauge,
  Meter,
  Stack,
  StatePill,
  Tag,
  Typography,
} from "@zibby/design-system";
import {
  GOAL_CARD_STATE,
  type GoalLabel,
  type GoalNames,
  decisionsThisMonth,
  formatGoalDateTime,
  goalMeterTone,
  goalScheduleLabel,
  goalScopeLabel,
  percentOf,
} from "../goalView";

export enum GoalHeroTestId {
  Name = "goal-hero-name",
  Outcome = "goal-hero-outcome",
  Tags = "goal-hero-tags",
  MergeGrant = "goal-hero-merge-grant",
  Gauge = "goal-hero-gauge",
  Meters = "goal-hero-meters",
  MeterDeadline = "goal-hero-meter-deadline",
  MeterDecisions = "goal-hero-meter-decisions",
  MeterRuns = "goal-hero-meter-runs",
  HeldReason = "goal-hero-held-reason",
}

export interface GoalHeroProps {
  goal: Goal;
  /** Absent while the state loads (or failed): no pill, gauge or meters rather than faked ones. */
  state?: GoalState;
  rollup?: GoalRollup;
  names: GoalNames;
  now: number;
}

/**
 * Hero of the goal page: roll-up pill · "Cíl" · schedule, the name (h1), the outcome as the
 * large objective, scope / ceiling / loop / merge-grant tags, the done-of-projects gauge and
 * only the meters the mandate really carries (cycle deadline, decisions, runs this cycle).
 */
export function GoalHero({ goal, state, rollup, names, now }: GoalHeroProps) {
  const t = useTranslations("goals");
  const locale = useLocale();
  const label = (l: GoalLabel) => t(l.key, l.values);
  const when = (iso: string) => formatGoalDateTime(iso, locale);
  const counts = rollup?.counts;
  const display = rollup?.status;
  const grantActive = goal.mergeGrant && Date.parse(goal.mergeGrant.until) > now;

  // Nothing to count (no instance yet) or a single project-less run: no "0 of 0" ring.
  const showGauge =
    counts !== undefined && counts.total > 0 && !(goal.scope.kind === "none" && counts.total <= 1);
  const gaugeCaption = !counts
    ? undefined
    : counts.total === 0
      ? t("card.notRun")
      : counts.parked > 0
        ? t("list.needsYou", { count: counts.parked })
        : counts.done === counts.total
          ? t("detail.gaugeAllDone")
          : t("detail.gaugeLeft", { count: counts.total - counts.done });

  const deadline = state?.cycle.deadlineAt;
  const deadlinePct =
    state && deadline
      ? percentOf(
          now - Date.parse(state.cycle.startedAt),
          Date.parse(deadline) - Date.parse(state.cycle.startedAt),
        )
      : 0;
  const decisions = goal.directional && decisionsThisMonth(state?.decisionsThisMonth, now);
  const maxDecisions = goal.directional?.maxDecisionsPerMonth ?? 0;
  const maxRuns = goal.budget?.maxRunsPerCycle;
  const instances = Object.values(state?.instances ?? {});
  // The run cap is per instance (the engine checks each one's own `taskIds`): show the one that used the most.
  const runs = Math.max(0, ...instances.map((i) => i.taskIds.length));
  const meters = [
    state && deadline && (
      <div data-testid={GoalHeroTestId.MeterDeadline} key="deadline">
        <Meter
          quiet
          barLabel={t("detail.meterDeadline")}
          label={t("detail.meterDeadline")}
          pct={deadlinePct}
          tone={goalMeterTone(deadlinePct)}
          value={t("detail.meterDeadlineValue", { when: when(deadline) })}
        />
      </div>
    ),
    state && decisions !== undefined && (
      <div data-testid={GoalHeroTestId.MeterDecisions} key="decisions">
        <Meter
          quiet
          barLabel={t("directional.decisions")}
          label={t("directional.decisions")}
          pct={percentOf(decisions, maxDecisions)}
          tone={goalMeterTone(percentOf(decisions, maxDecisions))}
          value={t("directional.decisionsValue", { count: decisions, max: maxDecisions })}
        />
      </div>
    ),
    state && maxRuns !== undefined && instances.length > 0 && (
      <div data-testid={GoalHeroTestId.MeterRuns} key="runs">
        <Meter
          quiet
          barLabel={t("detail.meterRuns")}
          label={t("detail.meterRuns")}
          note={instances.length > 1 ? t("detail.meterRunsNote") : undefined}
          pct={percentOf(runs, maxRuns)}
          tone={goalMeterTone(percentOf(runs, maxRuns))}
          value={t("detail.meterRunsValue", { used: runs, max: maxRuns })}
        />
      </div>
    ),
  ].filter(Boolean);

  return (
    <Stack wrap align="start" direction="row" gap="500" justify="between">
      <Container grow minW0 maxWidth="760px">
        <Stack gap="150">
          <Stack wrap align="center" direction="row" gap="100">
            {display && (
              <StatePill label={t(`status.${display}`)} state={GOAL_CARD_STATE[display]} />
            )}
            <Typography size="xs" type="note" variant="tertiary">
              {t("detail.goal")}
            </Typography>
            <Typography aria-hidden="true" size="xs" type="note" variant="tertiary">
              ·
            </Typography>
            <Typography size="xs" type="note" variant="tertiary">
              {label(goalScheduleLabel(goal, locale))}
            </Typography>
          </Stack>
          <Typography as="h1" data-testid={GoalHeroTestId.Name} type="subtitle">
            {goal.name}
          </Typography>
          {/* The outcome keeps its line breaks: one block per non-empty line. */}
          <Stack data-testid={GoalHeroTestId.Outcome} gap="100">
            {goal.outcome
              .split("\n")
              .filter((line) => line.trim() !== "")
              .map((line, i) => (
                <Typography key={i} leading="normal" size="xl" type="bodyLg">
                  {line}
                </Typography>
              ))}
          </Stack>
          {display === "held" && (
            <Typography
              data-testid={GoalHeroTestId.HeldReason}
              size="sm"
              type="note"
              variant="secondary"
            >
              {t("card.heldReason")}
            </Typography>
          )}
          <Stack wrap data-testid={GoalHeroTestId.Tags} direction="row" gap="100">
            <Tag icon="stack" tone="neutral">
              {label(goalScopeLabel(goal.scope, names))}
            </Tag>
            <Tag icon="shield" tone="neutral">
              {t(`ceiling.${goal.ceiling}`)}
            </Tag>
            {goal.loop && (
              <Tag icon="flow" tone="neutral">
                {goal.loop.loopId}
              </Tag>
            )}
            {grantActive && goal.mergeGrant && (
              <Tag data-testid={GoalHeroTestId.MergeGrant} icon="branch" tone="neutral">
                {t("detail.mergeGrantUntil", { until: when(goal.mergeGrant.until) })}
              </Tag>
            )}
          </Stack>
        </Stack>
      </Container>
      {(showGauge || meters.length > 0) && (
        <Stack wrap align="center" direction="row" gap="300">
          {showGauge && counts && rollup && (
            <div data-testid={GoalHeroTestId.Gauge}>
              <IterationGauge
                ariaLabel={t("card.ringAria", { done: counts.done, total: counts.total })}
                caption={gaugeCaption}
                hot={rollup.status === "needs-you"}
                label={t("detail.gaugeLabel")}
                max={counts.total}
                ofLabel={t("detail.gaugeOf", { count: counts.total })}
                used={counts.done}
              />
            </div>
          )}
          {meters.length > 0 && (
            <Container minWidth="220px">
              <Stack
                aria-label={t("detail.meters")}
                data-testid={GoalHeroTestId.Meters}
                gap="100"
                role="group"
              >
                {meters}
              </Stack>
            </Container>
          )}
        </Stack>
      )}
    </Stack>
  );
}
