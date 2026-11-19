"use client";

import { useTranslations } from "next-intl";
import { OperatorChannelSection } from "../components/OperatorChannelSection";
import { OperatorTokenSection } from "../components/OperatorTokenSection";
import { SettingsPage } from "../components/SettingsPage";
import { WebPushSection } from "../components/WebPushSection";

/** `/system/settings/access` — operator token, Slack operator channel, web push. */
export function AccessPage() {
  const t = useTranslations("settings");
  return (
    <SettingsPage
      panels={[
        { id: "operator-token", label: t("operatorToken") },
        { id: "slack", label: t("operatorChannel.title") },
        { id: "push", label: t("webPush.title") },
      ]}
      section="access"
    >
      <OperatorTokenSection />
      <OperatorChannelSection />
      <WebPushSection />
    </SettingsPage>
  );
}
