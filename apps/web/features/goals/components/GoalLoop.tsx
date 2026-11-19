"use client";

import { useTranslations } from "next-intl";
import { Icon, LoopDiagram, type LoopDiagramActive, LoopDiagramNode } from "@zibby/design-system";

export interface GoalLoopProps {
  makerName: string;
  makerSub: string;
  makerKind: "agent" | "workflow";
  verifierName: string;
  verifierSub: string;
  used: number;
  max: number;
  active: LoopDiagramActive;
  /** The run waits for the operator. */
  parked: boolean;
  /** Edit mode: the nodes are buttons that open their editor. */
  onEditMaker?: () => void;
  onEditVerifier?: () => void;
}

/** The goal's loop: maker ⇄ verifier, the live arrow, the iteration counter. */
export function GoalLoop({
  makerName,
  makerSub,
  makerKind,
  verifierName,
  verifierSub,
  used,
  max,
  active,
  parked,
  onEditMaker,
  onEditVerifier,
}: GoalLoopProps) {
  const t = useTranslations("goalPage");
  return (
    <LoopDiagram
      board
      active={active}
      backLabel={parked ? t("pausedNeedsYou") : t("verdictRetry")}
      count={`${used} / ${max}`}
      countLabel={t("iteration")}
      forwardLabel={t("resultJudge")}
      maker={
        <LoopDiagramNode
          ariaLabel={
            onEditMaker ? t("changeNode", { node: t("maker"), name: makerName }) : undefined
          }
          kicker={t("maker")}
          leading={<Icon name={makerKind === "agent" ? "bot" : "flow"} size="md" />}
          line={active === "forward" ? t("makerWorking") : t("makerIdle")}
          onClick={onEditMaker}
          state={active === "forward" ? "active" : "rest"}
          subtitle={makerSub}
          title={makerName}
        />
      }
      paused={parked}
      verifier={
        <LoopDiagramNode
          ariaLabel={
            onEditVerifier
              ? t("changeNode", { node: t("verifier"), name: verifierName })
              : undefined
          }
          kicker={t("verifier")}
          leading={<Icon name="shield" size="md" />}
          line={
            parked ? t("cantDecide") : active === "back" ? t("verifierJudging") : t("verifierIdle")
          }
          onClick={onEditVerifier}
          state={parked ? "wait" : active === "back" ? "active" : "rest"}
          subtitle={verifierSub}
          title={verifierName}
        />
      }
    />
  );
}
