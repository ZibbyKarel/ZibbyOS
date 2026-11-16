"use client";

import type { Automation } from "@zibby/contracts";
import type { EngineBadgeProps } from "@zibby/design-system";
import { useAgentsQuery } from "../agents/queries";
import { useEngineBadge } from "../ai-providers/useEngineBadge";

/**
 * Engine-badge props for an automation, or `undefined` when none applies. The effective
 * engine is the automation's own override ?? the target agent's ?? global; workflow and
 * system targets show nothing (the override only applies to agent runs).
 */
export function useAutomationEngineBadge(
  automation: Automation,
): Required<Pick<EngineBadgeProps, "engine" | "label">> | undefined {
  const engineBadge = useEngineBadge();
  const { data: agents = [] } = useAgentsQuery();
  const { target } = automation;
  const agentId =
    target.type === "agent"
      ? target.agentId
      : target.type === "task" && target.target?.kind === "agent"
        ? target.target.id
        : undefined;
  if (target.type !== "agent" && target.type !== "task") return undefined;
  if (target.type === "task" && target.target?.kind === "workflow") return undefined;
  const agent = agentId ? agents.find((a) => a.id === agentId) : undefined;
  return engineBadge(
    automation.engine
      ? { engine: automation.engine, engineModel: automation.engineModel }
      : (agent ?? {}),
  );
}
