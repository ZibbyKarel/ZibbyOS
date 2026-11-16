"use client";

import { useTranslations } from "next-intl";
import type { AiEngine, ModelTier } from "@zibby/contracts";
import type { EngineBadgeProps } from "@zibby/design-system";
import { catalogIds, engineMark, workflowEngineMarks } from "../../utils/engine";
import { useSystemConfigQuery } from "../system";
import { useAiEnginesQuery } from "./queries";

/**
 * Returns `(target) => { engine, label }` — props for the DS `EngineBadge`: the mark of the
 * engine the target really runs on (its override ?? the global engine, see `engineMark`)
 * with its translated accessible name.
 */
export function useEngineBadge(): (target: {
  engine?: AiEngine | undefined;
  engineModel?: string | undefined;
  model?: ModelTier;
}) => Required<Pick<EngineBadgeProps, "engine" | "label">> {
  const t = useTranslations("aiEngine.badge");
  const config = useSystemConfigQuery().data;
  const listed = catalogIds(useAiEnginesQuery().data?.engines);
  return (target) => {
    const engine = engineMark(target, config, listed);
    return { engine, label: t(engine) };
  };
}

/**
 * Returns `(steps, agents) => { engines, label }` — props for the DS `EngineBadge` of a
 * workflow: every distinct engine its agent steps run on (see `workflowEngineMarks`).
 */
export function useWorkflowEngineBadge(): (
  steps: Parameters<typeof workflowEngineMarks>[0],
  agents: Parameters<typeof workflowEngineMarks>[1],
) => Required<Pick<EngineBadgeProps, "engines" | "label">> {
  const t = useTranslations("aiEngine.badge");
  const config = useSystemConfigQuery().data;
  const listed = catalogIds(useAiEnginesQuery().data?.engines);
  return (steps, agents) => {
    const engines = workflowEngineMarks(steps, agents, (target) =>
      engineMark(target, config, listed),
    );
    return { engines, label: engines.map((e) => t(e)).join(", ") };
  };
}
