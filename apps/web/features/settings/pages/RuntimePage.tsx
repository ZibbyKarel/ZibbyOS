"use client";

import { useTranslations } from "next-intl";
import { MachineSection } from "../components/MachineSection";
import { RuntimePanels } from "../components/RuntimePanels";
import { SettingsPage } from "../components/SettingsPage";

/** `/system/settings/runtime` — this machine, schedulers, limits. */
export function RuntimePage() {
  const t = useTranslations("settings");
  const tr = useTranslations("settings.runtimeGroups");
  return (
    <SettingsPage
      panels={[
        { id: "machine", label: t("machine.title") },
        { id: "schedulers", label: tr("schedulers") },
        { id: "limits", label: tr("limits") },
      ]}
      section="runtime"
    >
      <MachineSection />
      <RuntimePanels />
    </SettingsPage>
  );
}
