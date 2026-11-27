"use client";
import { useWdT } from "./useWdT";
import type { Agent } from "@zibby/contracts";
import type { GraphNode } from "../WorkflowDialog/workflow-graph";

/** `(node) => string` — the phase's display name: its agent's name, or its step kind. */
export function usePhaseLabel(agents: readonly Agent[]): (node: GraphNode) => string {
  const t = useWdT("workflowDetail.card");
  return (node) =>
    node.type === "agent"
      ? (agents.find((a) => a.id === node.agent)?.name ?? node.agent ?? node.id)
      : node.type === "tool"
        ? t("tool")
        : node.type === "workflow"
          ? t("subWorkflow")
          : node.type === "parallel"
            ? t("parallel")
            : t("system");
}
