"use client";

import { useTranslations } from "next-intl";
import { AutoCompactPanel } from "../components/AutoCompactPanel";
import { AiModelsSection } from "../components/AiModelsSection";
import { SettingsPage } from "../components/SettingsPage";

/** `/system/settings/ai-engines` — active engine, model families, provider keys, BlueCode, auto-compaction. */
export function AiEnginesPage() {
  const t = useTranslations("settings");
  const ta = useTranslations("aiEngine");
  const ts = useTranslations("settings.engines");
  const tr = useTranslations("settings.runtimeGroups");
  return (
    <SettingsPage
      panels={[
        { id: "engine", label: ts("active") },
        { id: "families", label: ta("familyTitle") },
        { id: "opencode-model", label: ta("model") },
        { id: "openai", label: t("aiModels.openai") },
        { id: "bluecode", label: t("aiModels.bluecode.title") },
        { id: "context", label: tr("context") },
      ]}
      section="ai-engines"
    >
      <AiModelsSection />
      <AutoCompactPanel />
    </SettingsPage>
  );
}
