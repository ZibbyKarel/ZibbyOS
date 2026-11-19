"use client";

import { useTranslations } from "next-intl";
import {
  Button,
  Checkbox,
  Grid,
  SettingsPanel,
  SettingsRow,
  Stack,
  StatusBadge,
  Toggle,
  Typography,
} from "@zibby/design-system";
import {
  type OperatorChannelSettings,
  type OperatorEventKind,
  OperatorEventKindSchema,
} from "@zibby/contracts";
import {
  useOperatorChannelSettingsQuery,
  useOperatorChannelStatusQuery,
  useSetOperatorChannelSettingsMutation,
  useTestOperatorChannelMutation,
} from "../../operator-channel";

/** Testids for the operator-channel card (the screen + tests select via these). */
export enum OperatorChannelSectionTestId {
  Test = "operator-channel-test",
  Enabled = "operator-channel-enabled",
  Event = "operator-channel-event",
  TestResult = "operator-channel-test-result",
}

/**
 * The Slack operator channel (Phase 1): connection status, a test send (top-right),
 * the master switch and one toggle per event kind. Tokens are never entered here —
 * they go to `PUT /api/operator-channel/credentials/:kind` (see the operator-channel doc).
 */
export function OperatorChannelSection() {
  const t = useTranslations("settings");
  const { data: settings } = useOperatorChannelSettingsQuery();
  const { data: status } = useOperatorChannelStatusQuery();
  const save = useSetOperatorChannelSettingsMutation();
  const test = useTestOperatorChannelMutation();
  if (!settings) return null;

  const put = (next: OperatorChannelSettings) => {
    // dmChannelId is server-owned; the PUT body must not carry it.
    const body = { ...next };
    delete body.dmChannelId;
    save.mutate({ body });
  };
  const toggleEvent = (kind: OperatorEventKind, on: boolean) => {
    const events = on
      ? [...settings.notify.events, kind]
      : settings.notify.events.filter((k) => k !== kind);
    put({ ...settings, notify: { ...settings.notify, events } });
  };
  const result = test.data?.body;
  const connected = Boolean(status?.connected);
  const events = OperatorEventKindSchema.options;
  const on = settings.notify.events.length;

  return (
    <SettingsPanel
      actions={
        <Button
          data-testid={OperatorChannelSectionTestId.Test}
          disabled={test.isPending || !settings.enabled}
          icon="play"
          intent="ghost"
          onClick={() => test.mutate({})}
          size="sm"
        >
          {t("operatorChannel.test")}
        </Button>
      }
      badge={
        <StatusBadge tone={connected && settings.enabled ? "ok" : "off"}>
          {!connected
            ? t("operatorChannel.notConnected")
            : settings.enabled
              ? t("operatorChannel.connected")
              : t("access.paused")}
        </StatusBadge>
      }
      description={t("operatorChannel.hint")}
      id="slack"
      title={t("operatorChannel.title")}
    >
      <SettingsRow hint={t("access.masterHint")} label={t("operatorChannel.enabled")}>
        <Toggle
          checked={settings.enabled}
          data-testid={OperatorChannelSectionTestId.Enabled}
          label={t("operatorChannel.enabled")}
          onChange={(next) => put({ ...settings, enabled: next })}
        />
      </SettingsRow>
      {status && (
        <>
          <SettingsRow
            disabled={!settings.enabled}
            hint={status.workspace ?? undefined}
            label={t("operatorChannel.connection")}
          >
            <Typography mono type="note">
              {status.mode}
            </Typography>
          </SettingsRow>
          <SettingsRow disabled={!settings.enabled} label={t("operatorChannel.credentials")}>
            <Typography mono type="note">
              {`bot ${status.credentials.bot ? "✓" : "–"} · app ${status.credentials.app ? "✓" : "–"}`}
            </Typography>
          </SettingsRow>
          {status.lastDelivery && (
            <SettingsRow disabled={!settings.enabled} label={t("operatorChannel.lastDelivery")}>
              <Typography mono type="note">
                {`${status.lastDelivery.kind} · ${status.lastDelivery.status}`}
              </Typography>
            </SettingsRow>
          )}
          {status.lastError && (
            <SettingsRow disabled={!settings.enabled} label={t("operatorChannel.lastError")}>
              <Typography mono type="note">
                {status.lastError}
              </Typography>
            </SettingsRow>
          )}
        </>
      )}
      {result && (
        <SettingsRow label={t("operatorChannel.test")}>
          <Typography
            mono
            data-testid={OperatorChannelSectionTestId.TestResult}
            type="note"
            variant="tertiary"
          >
            {result.ok ? t("operatorChannel.testOk") : t("operatorChannel.testFailed")}:{" "}
            {result.detail}
          </Typography>
        </SettingsRow>
      )}
      <SettingsRow stack label={`${t("operatorChannel.events")} · ${on}/${events.length}`}>
        <Grid cols={2} gap="150">
          {events.map((kind) => (
            <Stack align="center" direction="row" gap="100" key={kind}>
              <Checkbox
                checked={settings.notify.events.includes(kind)}
                data-testid={`${OperatorChannelSectionTestId.Event}-${kind}`}
                disabled={!settings.enabled}
                label={t(`operatorChannel.event.${kind}`)}
                onChange={(next) => toggleEvent(kind, next)}
                size="sm"
              />
              <Typography size="sm" type="text">
                {t(`operatorChannel.event.${kind}`)}
              </Typography>
            </Stack>
          ))}
        </Grid>
      </SettingsRow>
    </SettingsPanel>
  );
}
