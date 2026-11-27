"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Goal, GoalRollup, GoalState } from "@zibby/contracts";
import {
  Container,
  IterationGauge,
  Markdown,
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
  goalProgress,
  goalScheduleLabel,
  goalScopeLabel,
  percentOf,
} from "../goalView";
import { GoalCriteriaCard } from "./GoalCriteriaCard";

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
  Criteria = "goal-hero-criteria",
  Identity = "goal-hero-identity",
}

export interface GoalHeroProps {
  goal: Goal;
  /** Absent while the state loads (or failed): no pill, gauge or meters rather than faked ones. */
  state?: GoalState;
  rollup?: GoalRollup;
  names: GoalNames;
  now: number;
  /** Edit mode: the in-place name / outcome / predicate inputs, shown instead of the read-only text. */
  identity?: ReactNode;
}

/**
 * Hero of the goal page: roll-up pill · "Cíl" · schedule, the name (h1), the outcome as the
 * Markdown objective, the verification rule, scope / ceiling / loop / merge-grant tags, the done-of-projects gauge and
 * only the meters the mandate really carries (cycle deadline, decisions, runs this cycle).
 */
export function GoalHero({ goal, state, rollup, names, now, identity }: GoalHeroProps) {
  const t = useTranslations("goals");
  const locale = useLocale();
  const label = (l: GoalLabel) => t(l.key, l.values);
  const when = (iso: string) => formatGoalDateTime(iso, locale);
  const counts = rollup?.counts;
  const progress = rollup ? goalProgress(rollup) : undefined;
  const bySteps = progress?.kind === "steps";
  const display = rollup?.status;
  const grantActive = goal.mergeGrant && Date.parse(goal.mergeGrant.until) > now;

  // Nothing to count (no instance yet) or a single project-less run: no "0 of 0" ring.
  const showGauge =
    counts !== undefined &&
    progress !== undefined &&
    progress.total > 0 &&
    (bySteps || !(goal.scope.kind === "none" && counts.total <= 1));
  const gaugeCaption = !counts
    ? undefined
    : counts.total === 0
      ? t("card.notRun")
      : counts.parked > 0
        ? t("list.needsYou", { count: counts.parked })
        : progress && progress.done === progress.total
          ? t("detail.gaugeAllDone")
          : t("detail.gaugeLeft", { count: (progress?.total ?? 0) - (progress?.done ?? 0) });

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
    <Stack gap="250">
      <Stack gap="150">
        <Stack wrap align="center" direction="row" gap="100">
          {display && <StatePill label={t(`status.${display}`)} state={GOAL_CARD_STATE[display]} />}
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
        {identity ? (
          <div data-testid={GoalHeroTestId.Identity}>{identity}</div>
        ) : (
          <>
            <Typography as="h1" data-testid={GoalHeroTestId.Name} type="subtitle">
              {goal.name}
            </Typography>
            <div data-testid={GoalHeroTestId.Outcome}>
              <Markdown source={goal.outcome} variant="prose" />
            </div>
            <Stack data-testid={GoalHeroTestId.Criteria} gap="50">
              <Typography size="2xs" type="label" variant="tertiary">
                {t("detail.criteriaTitle")}
              </Typography>
              <GoalCriteriaCard goal={goal} />
            </Stack>
          </>
        )}
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
      {(showGauge || meters.length > 0) && (
        <Stack wrap align="center" direction="row" gap="300">
          {showGauge && progress && rollup && (
            <div data-testid={GoalHeroTestId.Gauge}>
              <IterationGauge
                ariaLabel={t(bySteps ? "card.ringAriaSteps" : "card.ringAria", {
                  done: progress.done,
                  total: progress.total,
                })}
                caption={gaugeCaption}
                hot={rollup.status === "needs-you"}
                label={t("detail.gaugeLabel")}
                max={progress.total}
                ofLabel={t(bySteps ? "card.ringOfSteps" : "detail.gaugeOf", {
                  count: progress.total,
                })}
                used={progress.done}
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
