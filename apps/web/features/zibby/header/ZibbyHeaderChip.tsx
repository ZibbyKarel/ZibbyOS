"use client";

import { type BrandMarkState, ZibbyChip, ZibbyOrb, type ZibbyOrbState } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useChat } from "../../chat/ChatContext";
import { useZibbyLive } from "../live/ZibbyLiveContext";
import { formatShortcut } from "../shortcut/shortcut";
import { useShortcutPlatform, useZibbyShortcut } from "../shortcut/useZibbyShortcut";

export enum ZibbyHeaderChipTestId {
  Root = "zibby-header-chip",
}

export interface ZibbyHeaderChipProps {
  /** System state shown while the overlay is closed: something waits on the operator /
   *  agents run / rest. The logo is static; this orb carries the signal. */
  systemState?: BrandMarkState;
  /** Only the orb (no label; the shortcut lives in the aria label). */
  iconOnly?: boolean;
}

const CLOSED_ORB_STATE = {
  blocked: "needs",
  working: "work",
  idle: "sleep",
} as const satisfies Record<BrandMarkState, ZibbyOrbState>;

/**
 * The header's mini orb / summon button (`.zchip`): a 20 px orb (+ "Zibby" unless `iconOnly`; the
 * shortcut lives in the aria label). Closed, the orb shows the system state (`needs` when
 * something waits on the operator, `work` while agents run, else asleep); while the overlay is
 * summoned/open it mirrors the live orb state. Click opens the overlay (or closes it when open).
 */
export function ZibbyHeaderChip({ systemState = "idle", iconOnly = false }: ZibbyHeaderChipProps) {
  const t = useTranslations("zibby");
  const { dockOpen, open, setDockOpen } = useChat();
  const live = useZibbyLive();
  const { shortcut } = useZibbyShortcut();
  const platform = useShortcutPlatform();

  const orbState: ZibbyOrbState =
    live.phase === "closed" ? CLOSED_ORB_STATE[systemState] : live.orbState;

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
