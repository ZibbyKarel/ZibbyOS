import type { Agent, Department } from "@zibby/contracts";
import { Icon, PortraitCard, StatusDot, Tag } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useEngineBadge, useTierLabel } from "../../ai-providers";
import {
  type AgentPresence,
  type AgentWeekStats,
  EFFORT_LEVEL,
  toolGlyphs,
} from "../agentListModel";
import { engineLetter } from "../engineLetter";

export interface AgentPortraitCardProps {
  agent: Agent;
  department?: Department | undefined;
  presence: AgentPresence;
  /** What the agent is working on right now (only while `presence` is `working`). */
  task?: string | undefined;
  /** 7-day stats; omitted until the runs feed is loaded. */
  stats?: AgentWeekStats | undefined;
  /** How many workflows reference this agent (drives the app-only usage chip). */
  workflowCount?: number;
  onOpen: (agent: Agent) => void;
}

/** The Agents list card: portrait silhouette over the contract `Agent`, with live status and 7-day stats. */
export function AgentPortraitCard({
  agent,
  department,
  presence,
  task,
  stats,
  workflowCount = 0,
  onOpen,
}: AgentPortraitCardProps) {
  const t = useTranslations("agents");
  const tierLabel = useTierLabel();
  const engineBadge = useEngineBadge();
  const name = agent.displayName ?? agent.name ?? agent.id;
  const badge = engineBadge(agent);
  const thinking = agent.thinking ?? "medium";

  return (
    <PortraitCard
      ariaLabel={t("openAria", { name })}
      chips={
        workflowCount > 0 ? (
          <Tag tone="accent">
            <Icon name="flow" size="xs" /> {t("workflowUsage", { count: workflowCount })}
          </Tag>
        ) : undefined
      }
      effort={{ level: EFFORT_LEVEL[thinking], label: t(`list.effort.${thinking}`) }}
      engine={engineLetter(badge.engine)}
      engineLabel={badge.label}
      hue={department?.color}
      model={agent.engineModel ?? tierLabel(agent.model ?? "sonnet", agent.engine)}
      name={name}
      now={task ? { text: t("list.now", { task }), tone: "run" } : undefined}
      onClick={() => onOpen(agent)}
      role={agent.description}
      stats={
        stats
          ? [
              { value: String(stats.runs), label: t("list.statRuns") },
              {
                value: stats.successRate === null ? "—" : `${stats.successRate} %`,
                label: t("list.statSuccess"),
              },
              {
                value: `$${stats.cost.toFixed(stats.cost < 10 ? 2 : 0)}`,
                label: t("list.statCost"),
              },
            ]
          : undefined
      }
      status={
        presence === "working" ? (
          <Tag tone="working">
            <StatusDot tone="working" /> {t("list.statusWorking")}
          </Tag>
        ) : presence === "error" ? (
          <Tag tone="error">
            <StatusDot tone="error" /> {t("list.statusError")}
          </Tag>
        ) : undefined
      }
      tag={department?.code}
      tools={toolGlyphs(agent.tools).map((g) => (
        <Icon key={g} name={g} size="sm" />
      ))}
    />
  );
}
