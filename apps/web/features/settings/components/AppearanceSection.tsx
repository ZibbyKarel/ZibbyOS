"use client";

import {
  Icon,
  type IconName,
  SegmentedControl,
  SettingsPanel,
  SettingsRow,
  type ThemeChoice,
  Toggle,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type MotionChoice, useAppearance } from "../../../state/appearance";

const THEME_CHOICES: { value: ThemeChoice; icon: IconName }[] = [
  { value: "system", icon: "layout" },
  { value: "light", icon: "sun" },
  { value: "dark", icon: "moon" },
];

/**
 * General → Appearance: theme light/dark/system, wired straight to `AppearanceProvider`
 * (a choice applies immediately, no reload), and reduced motion — a per-viewer
 * `localStorage` convenience independent of the OS `prefers-reduced-motion` query.
 */
export function AppearanceSection() {
  const t = useTranslations("settings.appearance");
  const { theme, setTheme, motion, setMotion } = useAppearance();

  return (
    <SettingsPanel description={t("hint")} id="appearance" title={t("title")}>
      <SettingsRow hint={t("themeHint")} label={t("themeLabel")}>
        <SegmentedControl
          ariaLabel={t("themeLabel")}
          items={THEME_CHOICES.map(({ value, icon }) => ({
            value,
            label: t(`theme.${value}`),
            leading: <Icon name={icon} size="xs" />,
          }))}
          onChange={(value) => setTheme(value as ThemeChoice)}
          value={theme}
        />
      </SettingsRow>
      <SettingsRow hint={t("motionHint")} label={t("motionLabel")}>
        <Toggle
          checked={motion === "reduced"}
          label={t("motionLabel")}
          onChange={(checked) => setMotion((checked ? "reduced" : "system") satisfies MotionChoice)}
        />
      </SettingsRow>
    </SettingsPanel>
  );
}
