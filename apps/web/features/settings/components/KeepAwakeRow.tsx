"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { SettingsRow, StatusBadge, Toggle } from "@zibby/design-system";

export const KEEP_AWAKE_STORAGE_KEY = "zibby.caffeinate";

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
/** Default on; only an explicit "false" turns it off. */
const read = () => {
  try {
    return localStorage.getItem(KEEP_AWAKE_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
};

export enum KeepAwakeRowTestId {
  Toggle = "settings-keep-awake",
}

/** Runtime → Machine: keep this Mac awake (caffeinate), stored per browser. */
export function KeepAwakeRow() {
  const t = useTranslations("settings");
  const on = useSyncExternalStore(subscribe, read, () => true);
  return (
    <SettingsRow
      hint={t("caffeinateHint")}
      label={t("caffeinate")}
      labelEnd={<StatusBadge tone="off">{t("runtimePanel.thisMac")}</StatusBadge>}
    >
      <Toggle
        checked={on}
        data-testid={KeepAwakeRowTestId.Toggle}
        label={t("caffeinate")}
        onChange={(next) => {
          try {
            localStorage.setItem(KEEP_AWAKE_STORAGE_KEY, String(next));
          } catch {
            /* storage blocked — the toggle just won't persist */
          }
          listeners.forEach((l) => l());
        }}
      />
    </SettingsRow>
  );
}
