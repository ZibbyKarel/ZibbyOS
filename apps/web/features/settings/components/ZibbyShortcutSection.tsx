"use client";

import { Alert, Button, Panel, Stack, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  DEFAULT_ZIBBY_SHORTCUT_ALIAS,
  shortcutCollision,
  shortcutFromEvent,
} from "../../zibby/shortcut/shortcut";
import { ZibbyShortcutKbd } from "../../zibby/shortcut/ZibbyShortcutKbd";
import {
  beginShortcutRecording,
  useShortcutPlatform,
  useZibbyShortcut,
} from "../../zibby/shortcut/useZibbyShortcut";

export enum ZibbyShortcutSectionTestId {
  Current = "zibby-shortcut-section-current",
  Record = "zibby-shortcut-section-record",
  Reset = "zibby-shortcut-section-reset",
  Recording = "zibby-shortcut-section-recording",
  Collision = "zibby-shortcut-section-collision",
  Alias = "zibby-shortcut-section-alias",
}

/**
 * Settings -> Shortcuts: record / reset the global summon combination for Zibby.
 * While recording, the global hotkey is suspended (see `beginShortcutRecording`);
 * Esc cancels. A collision with a known system/browser combination only warns.
 */
export function ZibbyShortcutSection() {
  const t = useTranslations("zibbyShortcut");
  const { shortcut, setShortcut, reset, isDefault } = useZibbyShortcut();
  const platform = useShortcutPlatform();
  const [recording, setRecording] = useState(false);
  const [needsModifier, setNeedsModifier] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const endRecording = beginShortcutRecording();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      const bare = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
      if (event.code === "Escape" && bare) {
        setNeedsModifier(false);
        setRecording(false);
        return;
      }
      if (/^(Alt|Control|Meta|Shift|OS)/.test(event.code)) return; // modifier-only: keep waiting
      const next = shortcutFromEvent(event);
      if (!next) {
        setNeedsModifier(true);
        return;
      }
      setNeedsModifier(false);
      setShortcut(next);
      setRecording(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      endRecording();
    };
  }, [recording, setShortcut]);

  // The default is Alt+Space everywhere, with Ctrl+Space as the non-macOS alias —
  // it is the shipped choice, so it never shows a "collision" warning.
  const collision = isDefault ? null : shortcutCollision(shortcut, platform);
  const showAlias = isDefault && platform !== "mac";

  return (
    <Panel header={t("title")} padding="300">
      <Stack gap="200">
        <Typography mono leading="snug" size="2xs" type="note" variant="tertiary">
          {t("hint")}
        </Typography>

        <Stack wrap align="center" direction="row" gap="200">
          <Typography type="text" weight="medium">
            {t("current")}
          </Typography>
          {recording ? (
            <Typography
              data-testid={ZibbyShortcutSectionTestId.Recording}
              type="text"
              variant="secondary"
            >
              {t("recording")}
            </Typography>
          ) : (
            <Stack inline data-testid={ZibbyShortcutSectionTestId.Current}>
              <ZibbyShortcutKbd />
            </Stack>
          )}
        </Stack>

        {showAlias && (
          <Stack
            wrap
            align="center"
            data-testid={ZibbyShortcutSectionTestId.Alias}
            direction="row"
            gap="100"
          >
            <Typography leading="snug" type="note" variant="secondary">
              {t("alias")}
            </Typography>
            <ZibbyShortcutKbd shortcut={DEFAULT_ZIBBY_SHORTCUT_ALIAS} />
          </Stack>
        )}

        {needsModifier && recording && (
          <Typography leading="snug" type="note" variant="secondary">
            {t("needsModifier")}
          </Typography>
        )}

        {collision && (
          <Alert
            data-testid={ZibbyShortcutSectionTestId.Collision}
            severity="warn"
            title={t("collisionTitle")}
          >
            {t(`collision.${collision}`)}
          </Alert>
        )}

        <Stack direction="row" gap="100">
          <Button
            data-testid={ZibbyShortcutSectionTestId.Record}
            intent="secondary"
            onClick={() => {
              setNeedsModifier(false);
              setRecording((r) => !r);
            }}
            size="sm"
          >
            {recording ? t("cancel") : t("record")}
          </Button>
          <Button
            data-testid={ZibbyShortcutSectionTestId.Reset}
            disabled={isDefault}
            intent="ghost"
            onClick={() => {
              setRecording(false);
              reset();
            }}
            size="sm"
          >
            {t("reset")}
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}
