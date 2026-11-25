"use client";

import { useTranslations } from "next-intl";
import { AccountsSection } from "../components/AccountsSection";
import { OperatorChannelSection } from "../components/OperatorChannelSection";
import { OperatorTokenSection } from "../components/OperatorTokenSection";
import { SettingsPage } from "../components/SettingsPage";
import { WebPushSection } from "../components/WebPushSection";

/** `/system/settings/access` — operator token, personal accounts, Slack operator channel, web push. */
export function AccessPage() {
  const t = useTranslations("settings");
  return (
    <SettingsPage
      panels={[
        { id: "operator-token", label: t("operatorToken") },
        { id: "accounts", label: t("accounts.title") },
        { id: "slack", label: t("operatorChannel.title") },
        { id: "push", label: t("webPush.title") },
      ]}
      section="access"
    >
      <OperatorTokenSection />
      <AccountsSection />
      <OperatorChannelSection />
      <WebPushSection />
    </SettingsPage>
  );
}
