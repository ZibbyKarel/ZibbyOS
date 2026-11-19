"use client";

import { Button, OptionToggle, ZibbyFooter } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { formatShortcut } from "../shortcut/shortcut";
import { useShortcutPlatform, useZibbyShortcut } from "../shortcut/useZibbyShortcut";
import type { ZibbyVoiceMode } from "../voice/useZibbyVoice";

export enum ZibbyOverlayFooterTestId {
  Mode = "zibby-overlay-footer-mode",
  Mute = "zibby-overlay-footer-mute",
}

export interface ZibbyOverlayFooterProps {
  mode: ZibbyVoiceMode;
  onModeChange: (mode: ZibbyVoiceMode) => void;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  /** Neither the speakd daemon nor the browser can speak — the voice button says so. */
  voiceUnavailable?: boolean;
  /** Phone: no keyboard, so the shortcut hint is left out. */
  compact?: boolean;
}

/**
 * The row under the composer: talk-mode switch ("Drž" / "Hands-free"), the voice
 * on/off toggle, and the hint with the REAL configured summon shortcut.
 */
export function ZibbyOverlayFooter({
  mode,
  onModeChange,
  muted,
  onMutedChange,
  voiceUnavailable = false,
  compact = false,
}: ZibbyOverlayFooterProps) {
  const t = useTranslations("zibby");
  const tVoice = useTranslations("zibbyVoice");
  const { shortcut } = useZibbyShortcut();
  const platform = useShortcutPlatform();
  const shortcutText = formatShortcut(shortcut, platform).join(" ");

  return (
    <ZibbyFooter
      end={compact ? undefined : <span>{t("footer.hint", { shortcut: shortcutText })}</span>}
      start={
        <>
          <OptionToggle<ZibbyVoiceMode>
            ariaLabel={t("footer.mode")}
            onChange={onModeChange}
            options={[
              { id: "ptt", label: tVoice("mode.ptt") },
              { id: "handsfree", label: tVoice("mode.handsfree") },
            ]}
            value={mode}
          />
          <Button
            aria-pressed={muted}
            data-testid={ZibbyOverlayFooterTestId.Mute}
            disabled={voiceUnavailable}
            intent="ghost"
            onClick={() => onMutedChange(!muted)}
            size="sm"
          >
            {voiceUnavailable
              ? t("footer.voiceUnavailable")
              : muted
                ? t("footer.voiceOff")
                : t("footer.voiceOn")}
          </Button>
        </>
      }
    />
  );
}
