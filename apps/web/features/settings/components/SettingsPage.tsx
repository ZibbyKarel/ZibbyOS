"use client";

import {
  Button,
  Dialog,
  type IconName,
  SettingsLayout,
  type SettingsLayoutLinkComponent,
  Typography,
  UnsavedBar,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { useHealthQuery } from "../../health";
import { useLeaveGuard } from "../../agents/useLeaveGuard";
import { useSelfStatusQuery } from "../../self";
import { SettingsDraftProvider, useSettingsDraft } from "../draft/SettingsDraftProvider";
import { SETTINGS_SECTIONS, type SettingsSection } from "../settingsSections";

export enum SettingsPageTestId {
  Root = "settings-page-root",
  Offline = "settings-page-offline",
  LeaveDialog = "settings-page-leave-dialog",
  LeaveStay = "settings-page-leave-stay",
  LeaveDiscard = "settings-page-leave-discard",
}

const PAGE_ICON: Record<SettingsSection, IconName> = {
  general: "gear",
  access: "lock",
  "ai-engines": "sparkles",
  runtime: "cog",
  status: "pulse",
};

/** i18n key segment per section (`ai-engines` is not a valid flat key part). */
const PAGE_KEY: Record<SettingsSection, string> = {
  general: "general",
  access: "access",
  "ai-engines": "aiEngines",
  runtime: "runtime",
  status: "status",
};

export interface SettingsPanelMeta {
  id: string;
  label: string;
  /** Needs attention — amber dot on the anchor rail. */
  warn?: boolean;
}

export interface SettingsPageProps {
  section: SettingsSection;
  panels: readonly SettingsPanelMeta[];
  children: ReactNode;
}

/**
 * The frame every settings page renders in: draft provider (read-only while the daemon is
 * offline), left page rail, "On this page" anchors, the sticky save bar (Cmd+S), and the
 * leave-without-saving confirm.
 */
export function SettingsPage({ section, panels, children }: SettingsPageProps) {
  const health = useHealthQuery();
  // Only a failed probe makes the page read-only; a still-loading one stays editable.
  return (
    <SettingsDraftProvider readOnly={health.isError}>
      <SettingsFrame panels={panels} section={section}>
        {children}
      </SettingsFrame>
    </SettingsDraftProvider>
  );
}

function SettingsFrame({ section, panels, children }: SettingsPageProps) {
  const t = useTranslations("settings");
  const router = useRouter();
  const draft = useSettingsDraft();
  const { data: status } = useSelfStatusQuery();
  const key = PAGE_KEY[section];
  const dirtyIds = new Set(draft.dirtyPanels.map((p) => p.id));
  const dirty = draft.dirtyPanels.length > 0;

  // Cmd/Ctrl+S saves every dirty panel.
  const saveAll = draft.saveAll;
  useEffect(() => {
    if (!dirty || draft.readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, draft.readOnly, saveAll]);

  const leave = useLeaveGuard(dirty && !draft.saving);
  const [leaving, setLeaving] = useState(false);

  return (
    <div data-testid={SettingsPageTestId.Root}>
      <SettingsLayout
        anchors={panels.map((p) => ({
          id: p.id,
          label: p.label,
          dirty: dirtyIds.has(p.id),
          warn: p.warn,
        }))}
        anchorsTitle={t("onThisPage")}
        eyebrow={t("railTitle")}
        linkComponent={Link as unknown as SettingsLayoutLinkComponent}
        nav={SETTINGS_SECTIONS.map((id) => ({
          id,
          href: `/system/settings/${id}`,
          label: t(`pages.${PAGE_KEY[id]}.title` as never),
          icon: PAGE_ICON[id],
          active: id === section,
        }))}
        navFooter={status?.appVersion ? `ZibbyOS · v${status.appVersion}` : undefined}
        navLabel={t("pagesLabel")}
        navTitle={t("railTitle")}
        onNavigate={(href) => router.push(href as never)}
        subtitle={t(`pages.${key}.question` as never)}
        title={t(`pages.${key}.title` as never)}
      >
        {draft.readOnly && (
          <Typography
            data-testid={SettingsPageTestId.Offline}
            role="alert"
            size="sm"
            tone="warn"
            type="text"
          >
            {t("draft.offline")}
          </Typography>
        )}
        {children}
        {dirty && (
          <UnsavedBar
            sticky
            discardLabel={t("draft.discard")}
            error={draft.error ? t("draft.saveFailed", { reason: draft.error }) : undefined}
            items={draft.dirtyPanels.map((p) => p.label)}
            onDiscard={draft.discardAll}
            onSave={() => void saveAll()}
            saveDisabled={draft.readOnly}
            saveLabel={t("draft.saveChanges")}
            saving={draft.saving}
            shortcut="⌘S"
            title={t("draft.unsaved", { count: draft.dirtyPanels.length })}
          />
        )}
      </SettingsLayout>

      {leave.pending && (
        <Dialog
          open
          actions={
            <>
              <Button
                data-testid={SettingsPageTestId.LeaveStay}
                intent="ghost"
                onClick={leave.stay}
              >
                {t("draft.stay")}
              </Button>
              <Button
                data-testid={SettingsPageTestId.LeaveDiscard}
                intent="danger"
                loading={leaving}
                onClick={() => {
                  const to = leave.pending!;
                  setLeaving(true);
                  // Discard first: the guard disarms once nothing is dirty, so the push is not re-caught.
                  draft.discardAll();
                  leave.stay();
                  router.push(to as never);
                  setLeaving(false);
                }}
              >
                {t("draft.discardLeave")}
              </Button>
            </>
          }
          onClose={leave.stay}
          title={t("draft.leaveTitle")}
          width="sm"
        >
          <Typography
            data-testid={SettingsPageTestId.LeaveDialog}
            size="base"
            type="note"
            variant="secondary"
          >
            {t("draft.leaveBody", { count: draft.dirtyPanels.length })}
          </Typography>
        </Dialog>
      )}
    </div>
  );
}
