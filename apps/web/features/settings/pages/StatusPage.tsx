"use client";

import { useTranslations } from "next-intl";
import { SettingsPanel, SettingsRow, StatusBadge, Typography } from "@zibby/design-system";
import { useHealthQuery } from "../../health";
import { SettingsPage } from "../components/SettingsPage";
import { SelfDevelopmentPanel } from "../components/SelfDevelopmentPanel";
import { UpdatesSection } from "../components/UpdatesSection";
import { WatcherRows } from "../components/WatcherRows";

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** `/system/settings/status` — daemon health, watchers, version & updates, ZIBBY development. */
export function StatusPage() {
  const t = useTranslations("settings");
  const { data: health, isSuccess } = useHealthQuery();
  return (
    <SettingsPage
      panels={[
        { id: "system", label: t("system") },
        { id: "updates", label: t("updates.title") },
        { id: "self-dev", label: t("selfDev.title") },
      ]}
      section="status"
    >
      <SettingsPanel
        badge={
          <StatusBadge tone={isSuccess ? "ok" : "err"}>
            {isSuccess ? t("online") : t("offline")}
          </StatusBadge>
        }
        id="system"
        title={t("system")}
      >
        <SettingsRow label={t("daemon")}>
          <Typography mono type="note">
            ZIBBY
          </Typography>
        </SettingsRow>
        {health && (
          <SettingsRow label={t("uptime")}>
            <Typography mono type="note">
              {formatUptime(health.uptime)}
            </Typography>
          </SettingsRow>
        )}
        <SettingsRow stack label={t("watchers.title")}>
          <WatcherRows watchers={health?.watchers} />
        </SettingsRow>
      </SettingsPanel>
      <UpdatesSection />
      <SelfDevelopmentPanel />
    </SettingsPage>
  );
}
