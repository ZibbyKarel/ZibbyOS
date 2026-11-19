"use client";
import type { Agent, Department } from "@zibby/contracts";
import type { IconName } from "@zibby/design-system";
import { EngineBadge, IconTile } from "@zibby/design-system";
import { stepEngineTarget } from "../../../../utils/engine";
import { agentSymbol } from "../../../agents/agentSymbol";
import { useEngineBadge } from "../../../ai-providers";
import type { GraphNode } from "../WorkflowDialog/workflow-graph";

export interface PhaseAvatarProps {
  node: GraphNode;
  agent?: Agent | undefined;
  departments?: readonly Department[];
  size?: "sm" | "md" | "lg";
}

/** The phase's face: the agent's avatar with its engine mark, or a step glyph for tool/sub-workflow. */
export function PhaseAvatar({ node, agent, departments = [], size = "sm" }: PhaseAvatarProps) {
  const engineBadge = useEngineBadge();
  const isAgent = node.type === "agent";
  const sym = isAgent
    ? agentSymbol(agent, departments)
    : { glyph: (node.type === "workflow" ? "flow" : "gear") as IconName, color: undefined };
  return (
    <EngineBadge {...(isAgent ? engineBadge(stepEngineTarget(node, agent)) : {})}>
      <IconTile
        alt={isAgent ? node.agent : undefined}
        color={sym.color}
        glyph={node.type === "tool" ? "terminal" : sym.glyph}
        shape={node.type === "tool" ? "square" : undefined}
        size={size}
        src={isAgent ? agent?.avatar : undefined}
      />
    </EngineBadge>
  );
}
