"use client";

import {
  Button,
  SettingsNote,
  SettingsPanel,
  SettingsRow,
  Stack,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSettingsReadOnly } from "../draft/SettingsDraftProvider";
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
  const [kept, setKept] = useState(false);
  const readOnly = useSettingsReadOnly();

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
    <SettingsPanel
      description={t("panelHint")}
      id="shortcuts"
      title={t("title")}
      tone={collision && !kept ? "attention" : "default"}
    >
      <SettingsRow hint={t("hint")} label={t("current")}>
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
        <Button
          data-testid={ZibbyShortcutSectionTestId.Record}
          disabled={readOnly}
          icon="run"
          intent="secondary"
          onClick={() => {
            setNeedsModifier(false);
            setKept(false);
            setRecording((r) => !r);
          }}
          size="sm"
        >
          {recording ? t("cancel") : t("record")}
        </Button>
        <Button
          data-testid={ZibbyShortcutSectionTestId.Reset}
          disabled={isDefault || readOnly}
          icon="retry"
          intent="ghost"
          onClick={() => {
            setRecording(false);
            setKept(false);
            reset();
          }}
          size="sm"
        >
          {t("reset")}
        </Button>
      </SettingsRow>

      {showAlias && (
        <SettingsRow label={t("alias")}>
          <Stack inline data-testid={ZibbyShortcutSectionTestId.Alias}>
            <ZibbyShortcutKbd shortcut={DEFAULT_ZIBBY_SHORTCUT_ALIAS} />
          </Stack>
        </SettingsRow>
      )}

      {needsModifier && recording && <SettingsNote tone="err">{t("needsModifier")}</SettingsNote>}

      {collision && !recording && !kept && (
        <SettingsNote
          actions={
            <>
              <Button
                intent="ghost"
                onClick={() => {
                  setNeedsModifier(false);
                  setRecording(true);
                }}
                size="sm"
              >
                {t("recordAnother")}
              </Button>
              <Button intent="ghost" onClick={() => setKept(true)} size="sm">
                {t("keepAnyway")}
              </Button>
            </>
          }
          tone="wait"
        >
          <span data-testid={ZibbyShortcutSectionTestId.Collision}>
            <b>{t("collisionTitle")}</b> {t(`collision.${collision}`)}
          </span>
        </SettingsNote>
      )}
    </SettingsPanel>
  );
}
