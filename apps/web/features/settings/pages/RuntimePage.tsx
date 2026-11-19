"use client";

import { useTranslations } from "next-intl";
import { MachineSection } from "../components/MachineSection";
import { SettingsPage } from "../components/SettingsPage";
import { SystemSection } from "../components/SystemSection";

/** `/system/settings/runtime` — this machine, schedulers, limits, context. */
export function RuntimePage() {
  const t = useTranslations("settings");
  return (
    <SettingsPage
      panels={[
        { id: "machine", label: t("machine.title") },
        { id: "runtime", label: t("runtime.title") },
      ]}
      section="runtime"
    >
      <MachineSection />
      <SystemSection />
    </SettingsPage>
  );
}
