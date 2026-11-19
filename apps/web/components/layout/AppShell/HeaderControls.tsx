"use client";

import type { ReactNode } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HeaderIconButton, HeaderNewButton, Icon, MenuButton } from "@zibby/design-system";
import { NEW_TASK_PAGE_HREF } from "../../../features/tasks";
import { SECTIONS } from "../../../state/config";
import { useThemeToggle } from "../ThemeToggle/ThemeToggle";
import { NavLink } from "./NavLink";

const SYSTEM_HREF = SECTIONS.find((s) => s.id === "system")?.href ?? "/system/settings/general";
const ABOUT_HREF = "/system/settings/status" as Route;

/** "+ New" (zone B; icon-only "+" on the phone): a menu of the create actions — a new task
 *  (the `/work/tasks/new` page, hidden on that page itself) and a new note (the floating window). */
export function NewMenu({
  iconOnly = false,
  onNewNote,
}: {
  iconOnly?: boolean;
  onNewNote: () => void;
}) {
  const t = useTranslations("shell");
  const router = useRouter();
  const pathname = usePathname();
  const items = [
    ...(pathname === NEW_TASK_PAGE_HREF
      ? []
      : [
          {
            id: "new-task",
            label: t("newTask"),
            icon: "plus" as const,
            onSelect: () => router.push(NEW_TASK_PAGE_HREF as Route),
          },
        ]),
    { id: "new-note", label: t("newNote"), icon: "edit" as const, onSelect: onNewNote },
  ];
  return (
    <MenuButton
      ariaLabel={t("newMenuAria")}
      items={items}
      renderTrigger={(props) => (
        <HeaderNewButton
          {...props}
          aria-label={t("newMenuAria")}
          label={iconOnly ? undefined : t("newMenu")}
        />
      )}
    />
  );
}

/** Zone C, last: gear → theme switch + link to Settings. */
export function PreferencesMenu(): ReactNode {
  const t = useTranslations("shell");
  const theme = useThemeToggle();
  return (
    <MenuButton
      ariaLabel={t("preferences")}
      items={[
        { id: "theme", label: theme.label, icon: theme.icon, onSelect: theme.toggle },
        { id: "divider", divider: true },
        { id: "settings", label: t("settings"), icon: "gear", href: SYSTEM_HREF },
        { id: "about", label: t("about"), icon: "pulse", href: ABOUT_HREF },
      ]}
      linkComponent={NavLink}
      renderTrigger={(props) => (
        <HeaderIconButton {...props} aria-label={t("preferences")}>
          <Icon name="gear" size="md" />
        </HeaderIconButton>
      )}
    />
  );
}
