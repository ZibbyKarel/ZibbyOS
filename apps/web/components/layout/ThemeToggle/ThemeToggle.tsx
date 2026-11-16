"use client";

import { Button, useResolvedTheme } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useAppearance } from "../../../state/appearance";

export enum ThemeToggleTestId {
  Trigger = "theme-toggle-trigger",
}

/** What the light/dark switch offers: the theme you'd switch TO (moon in light, sun in dark)
 *  and the action that sets that explicit theme — `system` stays selectable in Settings →
 *  Appearance. Shared by the toggle button and the header's preferences menu. */
export function useThemeToggle() {
  const t = useTranslations("shell");
  const { setTheme } = useAppearance();
  const next = useResolvedTheme() === "dark" ? "light" : "dark";
  return {
    label: t(next === "dark" ? "themeToDark" : "themeToLight"),
    icon: next === "dark" ? ("moon" as const) : ("sun" as const),
    toggle: () => setTheme(next),
  };
}

/** Light/dark switch button. */
export function ThemeToggle() {
  const { label, icon, toggle } = useThemeToggle();
  return (
    <Button
      aria-label={label}
      data-testid={ThemeToggleTestId.Trigger}
      icon={icon}
      intent="ghost"
      onClick={toggle}
      size="sm"
    />
  );
}
