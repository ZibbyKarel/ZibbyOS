"use client";

import { useTranslations } from "next-intl";
import { ButtonGroup, Stack, Typography } from "@zibby/design-system";
import type { AiEngine } from "@zibby/contracts";
import { AiEngineModelPicker, useAiEnginesQuery } from "../../ai-providers";

export interface AutomationEngineFieldsProps {
  /** `""` = use the agent's / global engine. */
  engine: AiEngine | "";
  engineModel: string;
  onEngineChange: (engine: AiEngine | "") => void;
  onEngineModelChange: (model: string) => void;
}

/** Per-automation engine override: same selector as the agent edit form. */
export function AutomationEngineFields({
  engine,
  engineModel,
  onEngineChange,
  onEngineModelChange,
}: AutomationEngineFieldsProps) {
  const t = useTranslations("aiEngine");
  const { data: engines } = useAiEnginesQuery();
  const opencodeModels = engines?.engines.find((e) => e.id === "opencode")?.models ?? [];

  return (
    <Stack gap="75">
      <Typography mono size="sm" type="note" variant="secondary">
        {t("agentField")}
      </Typography>
      <ButtonGroup
        ariaLabel={t("agentField")}
        onChange={(v) => onEngineChange(v === "global" ? "" : (v as AiEngine))}
        options={[
          { id: "global", label: t("useGlobal") },
          { id: "claude", label: t("engine.claude") },
          { id: "opencode", label: t("engine.opencode") },
        ]}
        value={engine || "global"}
      />
      {engine === "opencode" && (
        <AiEngineModelPicker
          clearable
          label={t("exactModel")}
          loaded={engines !== undefined}
          models={opencodeModels}
          onChange={onEngineModelChange}
          value={engineModel}
        />
      )}
      <Typography leading="snug" size="2xs" type="note" variant="tertiary">
        {t("automationHint")}
      </Typography>
    </Stack>
  );
}
