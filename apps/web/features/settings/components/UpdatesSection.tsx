"use client";

import {
  Button,
  SettingsNote,
  SettingsPanel,
  SettingsRow,
  StatusBadge,
  TextLink,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCheckAppUpdateMutation, useSelfStatusQuery } from "../../self";

declare global {
  interface Window {
    /** ZibbyOS.app's preload bridge (apps/desktop/src/preload.ts); absent in a plain browser. */
    zibbyDesktop?: { checkForUpdates(): Promise<void>; installUpdate(): Promise<void> };
  }
}

export enum UpdatesSectionTestId {
  Root = "updates-section",
  Check = "updates-check",
  Install = "updates-install",
  Available = "updates-available",
  /** Polite live region with the result of the last check / failed install. */
  Status = "updates-status",
  Installing = "updates-installing",
}

type Phase = "idle" | "installing" | "upToDate" | "failed";

/**
 * Settings → Status → Version & updates: the running ZibbyOS version, the newest `desktop-v*`
 * release, and the states the desktop updater already produces — checking, update available,
 * installing, up to date, failed. "Download & install" runs the desktop updater straight away
 * (in a plain browser it opens the release page instead).
 */
export function UpdatesSection() {
  const t = useTranslations("settings.updates");
  const ts = useTranslations("settings.updateStates");
  const { data: status } = useSelfStatusQuery();
  const check = useCheckAppUpdateMutation();
  const [phase, setPhase] = useState<Phase>("idle");

  const version = (v: string | undefined) => (v ? `v${v}` : "—");
  const latest = version(status?.latestAppVersion);
  const available = Boolean(status?.appUpdateAvailable);

  const handleCheck = () => {
    setPhase("idle");
    check.mutate(
      { body: {} },
      {
        onSuccess: ({ body }) => {
          if (!body.latestAppVersion) setPhase("failed");
          else if (!body.appUpdateAvailable) setPhase("upToDate");
        },
        onError: () => setPhase("failed"),
      },
    );
  };

  const handleInstall = () => {
    if (window.zibbyDesktop) {
      setPhase("installing");
      void window.zibbyDesktop
        .installUpdate()
        .then(() => setPhase("idle"))
        .catch(() => setPhase("failed"));
    } else if (status?.latestAppReleaseUrl) {
      window.open(status.latestAppReleaseUrl, "_blank", "noopener,noreferrer");
    }
  };

  const badge = check.isPending ? (
    <StatusBadge tone="info">{ts("checking")}</StatusBadge>
  ) : phase === "installing" ? (
    <StatusBadge tone="info">{ts("installing")}</StatusBadge>
  ) : phase === "failed" ? (
    <StatusBadge tone="err">{ts("failedBadge")}</StatusBadge>
  ) : available ? (
    <StatusBadge tone="info">{ts("availableBadge", { version: latest })}</StatusBadge>
  ) : status?.latestAppVersion ? (
    <StatusBadge tone="ok">{ts("upToDateBadge")}</StatusBadge>
  ) : undefined;

  return (
    <SettingsPanel
      actions={
        <Button
          data-testid={UpdatesSectionTestId.Check}
          intent="secondary"
          loading={check.isPending}
          onClick={handleCheck}
          size="sm"
        >
          {check.isPending ? ts("checking") : t("check")}
        </Button>
      }
      badge={badge}
      description={ts("hint")}
      id="version"
      title={ts("title")}
    >
      <div data-testid={UpdatesSectionTestId.Root}>
        <SettingsRow label={t("current")}>
          <Typography mono type="note">
            {version(status?.appVersion)}
          </Typography>
        </SettingsRow>
        <SettingsRow label={t("latest")}>
          <Typography mono type="note">
            {latest}
          </Typography>
          {status?.latestAppReleaseUrl && (
            <TextLink href={status.latestAppReleaseUrl} rel="noreferrer" target="_blank">
              <Typography size="sm" type="note">
                {t("releaseNotes")}
              </Typography>
            </TextLink>
          )}
        </SettingsRow>
        {phase === "installing" ? (
          <div data-testid={UpdatesSectionTestId.Installing}>
            <SettingsNote tone="sky">
              <b>{ts("installingLead", { version: latest })}</b> {ts("installingBody")}
            </SettingsNote>
          </div>
        ) : phase === "failed" ? (
          <div aria-live="polite" data-testid={UpdatesSectionTestId.Status}>
            <SettingsNote
              actions={
                <Button intent="secondary" onClick={handleCheck} size="sm">
                  {ts("retry")}
                </Button>
              }
              tone="err"
            >
              <b>{t("failed")}</b> {ts("failedBody")}
            </SettingsNote>
          </div>
        ) : available ? (
          <div data-testid={UpdatesSectionTestId.Available}>
            <SettingsNote
              actions={
                <Button
                  data-testid={UpdatesSectionTestId.Install}
                  icon="upgrade"
                  intent="ink"
                  onClick={handleInstall}
                  size="sm"
                >
                  {t("install")}
                </Button>
              }
              tone="sky"
            >
              <b>{t("available", { version: latest })}</b> {ts("restartBody")}
            </SettingsNote>
          </div>
        ) : phase === "upToDate" ? (
          <div aria-live="polite" data-testid={UpdatesSectionTestId.Status}>
            <SettingsNote icon="check" tone="info">
              {t("upToDate")}
            </SettingsNote>
          </div>
        ) : null}
      </div>
    </SettingsPanel>
  );
}
