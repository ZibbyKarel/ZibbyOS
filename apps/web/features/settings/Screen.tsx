"use client";

import { Container } from "@zibby/design-system";
import { AiEnginesPage } from "./pages/AiEnginesPage";
import { RuntimePage } from "./pages/RuntimePage";
import { StatusPage } from "./pages/StatusPage";
import { AccessPage } from "./pages/AccessPage";
import { GeneralPage } from "./pages/GeneralPage";
import type { SettingsSection } from "./settingsSections";

export interface SettingsScreenProps {
  section: SettingsSection;
}

/**
 * `/system/settings/[section]` (ZB-11, ROUTE-MAP §3) — the settings pages router. Five
 * pages share the `SettingsPage` frame (left rail, anchors, draft grammar). The old
 * `activity` page now lives in General as the Live log panel.
 */
export function SettingsScreen({ section }: SettingsScreenProps) {
  return (
    <Container>
      {section === "general" && <GeneralPage />}
      {section === "access" && <AccessPage />}
      {section === "status" && <StatusPage />}
      {section === "runtime" && <RuntimePage />}
      {section === "ai-engines" && <AiEnginesPage />}
    </Container>
  );
}
