"use client";

import { useTranslations } from "next-intl";
import { ActivitySection } from "../components/ActivitySection";
import { AppearanceSection } from "../components/AppearanceSection";
import { ChatSection } from "../components/ChatSection";
import { LanguagePanel } from "../components/LanguagePanel";
import { SettingsPage } from "../components/SettingsPage";
import { ZibbyShortcutSection } from "../components/ZibbyShortcutSection";

/** `/system/settings/general` — language, appearance, shortcuts, chat persona, live log. */
export function GeneralPage() {
  const t = useTranslations("settings");
  const tz = useTranslations("zibbyShortcut");
  return (
    <SettingsPage
      panels={[
        { id: "language", label: t("languagePanel.title") },
        { id: "appearance", label: t("appearance.title") },
        { id: "shortcuts", label: tz("title") },
        { id: "persona", label: t("chat.title") },
        { id: "live-log", label: t("activity.liveLog") },
      ]}
      section="general"
    >
      <LanguagePanel />
      <AppearanceSection />
      <ZibbyShortcutSection />
      <ChatSection />
      <ActivitySection />
    </SettingsPage>
  );
}
