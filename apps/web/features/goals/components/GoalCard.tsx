"use client";

import { useLocale, useTranslations } from "next-intl";
import type { GoalWithRollup } from "@zibby/contracts";
import { Button, GoalLoopCard } from "@zibby/design-system";
import { type GoalLabel, type GoalNames, goalCardModel } from "../goalView";
import { useUpdateGoalMutation, useWakeGoalMutation } from "../mutations";
import { useGoalStateQuery, useGoalTimelineQuery } from "../queries";

export enum GoalCardTestId {
  Decide = "goal-card-decide",
  Wake = "goal-card-wake",
  Pause = "goal-card-pause",
  Enable = "goal-card-enable",
}

export interface GoalCardProps {
  goal: GoalWithRollup;
  names: GoalNames;
  /** The whole-card open target, and "Rozhodnout" on a needs-you goal. */
  onOpen: () => void;
  /** A failed wake / pause / enable. */
  onError?: (error: unknown) => void;
  selected?: boolean;
  /** The widget's row key (`data-rk`): the goal sheet anchors next to it. */
  rowKey?: string;
  /** `compact` for a narrow widget: no parties, no actions. */
  size?: "full" | "compact";
}

/**
 * One goal as the design's Cíle card: ring of done projects, roll-up pill, schedule, scope /
 * ceiling / loop, the newest timeline event and the actions for its status.
 */
export function GoalCard({
  goal,
  names,
  onOpen,
  onError,
  selected,
  rowKey,
  size = "full",
}: GoalCardProps) {
  const t = useTranslations("goals");
  const locale = useLocale();
  const label = (l: GoalLabel | string) => (typeof l === "string" ? l : t(l.key, l.values));
  // ponytail: one timeline query per card; add rollup.latest to the list API if a long list gets slow
  const timeline = useGoalTimelineQuery(goal.id);
  // The held state (Manual autonomy) lives in the goal state, not the roll-up.
  const state = useGoalStateQuery(goal.id);
  const wake = useWakeGoalMutation();
  const update = useUpdateGoalMutation();
  // Any data counts (a failed background refetch keeps the last good events); none = no box.
  const m = goalCardModel(goal, timeline.data, names, locale, state.data?.state);
  const name = { name: goal.name };
  const setEnabled = (enabled: boolean) =>
    update.mutate({ params: { id: goal.id }, body: { enabled } }, { onError });

  const actions =
    m.actions === "decide" ? (
      <Button
        aria-label={t("card.decideAria", name)}
        data-testid={GoalCardTestId.Decide}
        onClick={onOpen}
        size="sm"
      >
        {t("card.decide")}
      </Button>
    ) : m.actions === "enable" ? (
      <Button
        aria-label={t("card.enableAria", name)}
        data-testid={GoalCardTestId.Enable}
        icon="play"
        intent="secondary"
        loading={update.isPending}
        onClick={() => setEnabled(true)}
        size="sm"
      >
        {t("card.enable")}
      </Button>
    ) : (
      <>
        <Button
          aria-label={t("card.wakeAria", name)}
          data-testid={GoalCardTestId.Wake}
          intent="secondary"
          loading={wake.isPending}
          onClick={() => wake.mutate({ params: { id: goal.id }, body: {} }, { onError })}
          size="sm"
        >
          {t("detail.wake")}
        </Button>
        <Button
          aria-label={t("card.pauseAria", name)}
          data-testid={GoalCardTestId.Pause}
          intent="ghost"
          loading={update.isPending}
          onClick={() => setEnabled(false)}
          size="sm"
        >
          {t("card.pause")}
        </Button>
      </>
    );

  return (
    <GoalLoopCard
      actions={actions}
      data-rk={rowKey}
      max={m.max}
      onOpen={onOpen}
      openLabel={t("card.openAria", name)}
      parties={m.parties.map((p) => ({ role: label(p.role), name: label(p.name), avatar: false }))}
      ringAriaLabel={label(m.ringAria)}
      ringCaption={label(m.ringCaption)}
      ringValue={m.ringValue}
      selected={selected}
      size={size}
      state={m.state}
      stateLabel={t(`status.${m.held ? "held" : goal.rollup.status}`)}
      title={goal.name}
      topMeta={label(m.topMeta)}
      used={m.used}
      verdict={
        m.verdict && {
          head: label(m.verdict.head),
          status: m.verdict.status && label(m.verdict.status),
          text: label(m.verdict.text),
        }
      }
      verdictTone={m.verdictTone}
    />
  );
}
