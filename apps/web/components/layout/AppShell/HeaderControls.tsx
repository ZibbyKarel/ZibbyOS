"use client";

import type { ReactNode } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type BrandMarkState,
  Container,
  HeaderIconButton,
  HeaderNewButton,
  HeaderStatus,
  Icon,
  MenuButton,
  Stack,
  Typography,
} from "@zibby/design-system";
import { NEW_TASK_PAGE_HREF } from "../../../features/tasks";
import { SECTIONS } from "../../../state/config";
import { HeaderPopover } from "../HeaderPopover/HeaderPopover";
import { SelfUpgrade } from "../SelfUpgrade";
import { useThemeToggle } from "../ThemeToggle/ThemeToggle";
import { NavLink } from "./NavLink";

const SYSTEM_HREF = SECTIONS.find((s) => s.id === "system")?.href ?? "/system/settings/general";

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

export interface SystemStatusProps {
  markState: BrandMarkState;
  version?: string;
  updateAvailable: boolean;
}

/** Zone C status chip: state dot + update badge; opens the version / self-upgrade panel. */
export function SystemStatus({ markState, version, updateAvailable }: SystemStatusProps) {
  const t = useTranslations("shell");
  const title = t("statusPopoverTitle");
  return (
    <HeaderPopover
      ariaLabel={title}
      trigger={(props) => (
        <HeaderStatus
          {...props}
          aria-label={t("statusAria")}
          attention={markState === "blocked"}
          state={markState}
          update={updateAvailable ? <Icon name="upgrade" size="xs" /> : undefined}
        />
      )}
    >
      <Container padding="200">
        <Stack gap="150">
          <Typography type="label">{title}</Typography>
          {version && <Typography type="text">{t("statusVersion", { version })}</Typography>}
          <SelfUpgrade />
        </Stack>
      </Container>
    </HeaderPopover>
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
