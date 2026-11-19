"use client";

import { SettingsNote, SettingsPanel, SettingsTable, StatusBadge } from "@zibby/design-system";
import type { WatcherHealth } from "@zibby/contracts";
import { useTranslations } from "next-intl";

export enum WatchersPanelTestId {
  Stale = "settings-watchers-stale",
}

/** `90_000` → "2 min"; seconds below a minute, hours from 60 min up. */
export function compactDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

const BADGE: Record<WatcherHealth["status"], "ok" | "wait" | "off"> = {
  ok: "ok",
  stale: "wait",
  disabled: "off",
};

/** Status → Watchers: read-only table of the background loops from the health probe (no restart action). */
export function WatchersPanel({ watchers }: { watchers: WatcherHealth[] | undefined }) {
  const t = useTranslations("settings");
  const tp = useTranslations("settings.statusPanels");
  const list = watchers ?? [];
  const stale = list.filter((w) => w.status === "stale");
  return (
    <SettingsPanel description={tp("watchersHint")} id="watchers" title={t("watchers.title")}>
      <SettingsTable
        columns={[tp("colWatcher"), tp("colEvery"), tp("colLastTick"), tp("colState")]}
        rows={list.map((w) => ({
          id: w.id,
          attention: w.status === "stale",
          cells: [
            w.id,
            w.tickMs > 0 ? compactDuration(w.tickMs) : "—",
            w.status === "disabled"
              ? (w.detail ?? tp("notRunning"))
              : w.ageMs === undefined
                ? tp("noTickYet")
                : w.status === "stale"
                  ? tp("staleAgo", {
                      ago: compactDuration(w.ageMs),
                      every: compactDuration(w.tickMs),
                    })
                  : tp("ago", { ago: compactDuration(w.ageMs) }),
            <StatusBadge key="s" tone={BADGE[w.status]}>
              {t(`watchers.${w.status}`)}
            </StatusBadge>,
          ],
        }))}
      />
      {stale.length > 0 && (
        <div data-testid={WatchersPanelTestId.Stale}>
          <SettingsNote tone="wait">
            <b>{tp("staleLead", { names: stale.map((w) => w.id).join(", ") })}</b> {tp("staleBody")}
          </SettingsNote>
        </div>
      )}
    </SettingsPanel>
  );
}
