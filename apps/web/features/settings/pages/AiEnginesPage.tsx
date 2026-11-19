"use client";

import { useTranslations } from "next-intl";
import { AiModelsSection } from "../components/AiModelsSection";
import { SettingsPage } from "../components/SettingsPage";

/** `/system/settings/ai-engines` — active engine, model families, provider keys, BlueCode. */
export function AiEnginesPage() {
  const t = useTranslations("settings");
  const ta = useTranslations("aiEngine");
  return (
    <SettingsPage
      panels={[
        { id: "engine", label: ta("title") },
        { id: "openai", label: t("aiModels.openai") },
        { id: "bluecode", label: t("aiModels.bluecode.title") },
      ]}
      section="ai-engines"
    >
      <AiModelsSection />
    </SettingsPage>
  );
}
