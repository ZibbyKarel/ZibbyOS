"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Goal, GoalRollup, GoalState } from "@zibby/contracts";
import { Icon, LoopDiagram, type LoopDiagramActive, LoopDiagramNode } from "@zibby/design-system";
import { formatGoalDateTime, goalDisplayStatus } from "../goalView";

export interface GoalLoopProps {
  goal: Pick<Goal, "cadence" | "loop" | "enabled">;
  state: GoalState;
  rollup: GoalRollup;
}

/**
 * The goal's loop: "Plán" (ZIBBY plans) ⇄ "Vykonání" (the stored loop or its tasks). Forward
 * arrow while acting, back arrow while planning, dashed and paused while it needs the operator.
 * With several instances it shows the roll-up; the counter is the cycle for standing goals.
 */
export function GoalLoop({ goal, state, rollup }: GoalLoopProps) {
  const t = useTranslations("goals.detail.loop");
  const g = useTranslations("bridge.widgets.goals");
  const locale = useLocale();
  const { counts } = rollup;
  // A held goal (Manual autonomy) is idle: nothing plans or runs, so no arrow.
  const status =
    goalDisplayStatus(goal, rollup.status, state) === "held" ? "waiting" : rollup.status;
  const instances = Object.values(state.instances);
  const single = instances.length === 1 ? instances[0] : undefined;
  const needsYou = status === "needs-you";
  const active: LoopDiagramActive =
    status === "acting" ? "forward" : status === "planning" ? "back" : null;
  const runs = instances.reduce((n, i) => n + i.taskIds.length, 0);

  // What execution waits on: the first instance that waits on something, else one with a wake time.
  const waiting = instances.find((i) => i.waitingOn?.length)?.waitingOn?.[0];
  const wakeAt = instances.find((i) => i.wakeAt)?.wakeAt;
  const execLine = waiting
    ? g("waitingOn", { kind: g(`waiting.${waiting.kind}`), ref: waiting.ref })
    : wakeAt
      ? g("wakesAt", { when: formatGoalDateTime(wakeAt, locale) })
      : status === "acting"
        ? t("acting")
        : t("idle");
  const planLine = needsYou
    ? t("needsYou")
    : status === "planning"
      ? t("planning")
      : (single?.feasibility ?? t("planIdle"));

  return (
    <LoopDiagram
      board
      active={active}
      ariaLabel={t("aria")}
      backLabel={needsYou ? t("pausedBack") : t("back")}
      count={goal.cadence ? String(state.cycle.index + 1) : `${counts.done} / ${counts.total}`}
      countLabel={goal.cadence ? t("countCycle") : t("countProjects")}
      forwardLabel={t("forward")}
      maker={
        <LoopDiagramNode
          kicker={t("plan")}
          leading={<Icon name="compass" size="md" />}
          line={planLine}
          state={needsYou ? "wait" : active === "back" ? "active" : "rest"}
          subtitle={t("planSub")}
          title={t("planTitle")}
        />
      }
      paused={needsYou}
      verifier={
        <LoopDiagramNode
          kicker={t("exec")}
          leading={<Icon name={goal.loop ? "flow" : "tasks"} size="md" />}
          line={execLine}
          state={active === "forward" ? "active" : "rest"}
          subtitle={t("runs", { count: runs })}
          title={goal.loop ? goal.loop.loopId : t("tasks")}
        />
      }
    />
  );
}
