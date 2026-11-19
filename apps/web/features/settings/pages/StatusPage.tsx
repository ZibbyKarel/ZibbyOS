"use client";

import { useTranslations } from "next-intl";
import {
  Container,
  Row,
  SettingsPanel,
  SettingsRow,
  StatusBadge,
  StatusDot,
  Typography,
} from "@zibby/design-system";
import { useHealthQuery } from "../../health";
import { SettingsPage } from "../components/SettingsPage";
import { SelfDevelopmentPanel } from "../components/SelfDevelopmentPanel";
import { UpdatesSection } from "../components/UpdatesSection";
import { WatchersPanel } from "../components/WatchersPanel";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d ? `${d} d` : "", d || h ? `${h} h` : "", `${m} min`].filter(Boolean).join(" ");
}

/** `/system/settings/status` — daemon health, watchers, version & updates, ZIBBY development. */
export function StatusPage() {
  const t = useTranslations("settings");
  const tp = useTranslations("settings.statusPanels");
  const { data: health, isSuccess, isError } = useHealthQuery();
  const stale = health?.watchers.some((w) => w.status === "stale") ?? false;
  const nominal = isSuccess && health?.status === "ok";
  return (
    <SettingsPage
      panels={[
        { id: "system", label: t("system") },
        { id: "watchers", label: t("watchers.title"), warn: stale },
        { id: "version", label: tp("versionTitle") },
        { id: "self-dev", label: t("selfDev.title") },
      ]}
      section="status"
    >
      <SettingsPanel
        badge={
          <StatusBadge tone={isError ? "err" : nominal ? "ok" : "wait"}>
            {isError ? t("offline") : nominal ? tp("nominal") : tp("degraded")}
          </StatusBadge>
        }
        description={tp("systemHint")}
        id="system"
        title={t("system")}
      >
        <Container padding="250">
          <Row gap="100">
            <StatusDot tone={isError ? "error" : nominal ? "ok" : "wait"} />
            <Typography
              mono
              size="xl"
              tone={isError ? "bad" : nominal ? "ok" : "warn"}
              type="body"
              weight="semibold"
            >
              {isError ? tp("offlineWord") : nominal ? tp("nominalWord") : tp("degradedWord")}
            </Typography>
          </Row>
        </Container>
        {health && (
          <SettingsRow label={t("uptime")}>
            <Typography mono type="note">
              {formatUptime(health.uptime)}
            </Typography>
          </SettingsRow>
        )}
      </SettingsPanel>
      <WatchersPanel watchers={health?.watchers} />
      <UpdatesSection />
      <SelfDevelopmentPanel />
    </SettingsPage>
  );
}
