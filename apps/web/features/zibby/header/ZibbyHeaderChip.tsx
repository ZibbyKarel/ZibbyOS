"use client";

import { ZibbyChip, ZibbyOrb, type ZibbyOrbState } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useChat } from "../../chat/ChatContext";
import { useZibbyLive } from "../live/ZibbyLiveContext";
import { formatShortcut } from "../shortcut/shortcut";
import { useShortcutPlatform, useZibbyShortcut } from "../shortcut/useZibbyShortcut";

export enum ZibbyHeaderChipTestId {
  Root = "zibby-header-chip",
}

export interface ZibbyHeaderChipProps {
  /** Something waits on the operator — the same signal that turns the logo's knot amber. */
  needsAttention?: boolean;
  /** Phone toolbar: only the orb (no label, no shortcut — there is no keyboard). */
  iconOnly?: boolean;
}

/**
 * The header's summon button (`.zchip`): a 20 px orb + "Zibby" (the shortcut lives in the aria label). Closed, the
 * orb is `needs` when something waits on the operator, otherwise asleep; while the overlay is
 * summoned/open it mirrors the live orb state. Click opens the overlay (or closes it when open).
 */
export function ZibbyHeaderChip({
  needsAttention = false,
  iconOnly = false,
}: ZibbyHeaderChipProps) {
  const t = useTranslations("zibby");
  const { dockOpen, open, setDockOpen } = useChat();
  const live = useZibbyLive();
  const { shortcut } = useZibbyShortcut();
  const platform = useShortcutPlatform();

  const orbState: ZibbyOrbState =
    live.phase === "closed" ? (needsAttention ? "needs" : "sleep") : live.orbState;

  return (
    <ZibbyChip
      data-testid={ZibbyHeaderChipTestId.Root}
      label={t("chip.aria", { shortcut: formatShortcut(shortcut, platform).join(" ") })}
      onClick={() => (dockOpen ? setDockOpen(false) : open())}
      orb={<ZibbyOrb size={20} state={orbState} />}
    >
      {iconOnly ? undefined : t("chip.label")}
    </ZibbyChip>
  );
}
