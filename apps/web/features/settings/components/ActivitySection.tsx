"use client";

import { RadioMatrix, SettingsPanel, Tag } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  ACTIVITY_GROUPS,
  type ActivityGroup,
  type ActivityView,
  type ActivityViewMode,
} from "@zibby/contracts";
import { useSetActivityViewMutation } from "../mutations";
import { useActivityViewQuery } from "../queries";
import { useSettingsReadOnly } from "../draft/SettingsDraftProvider";

/** The display modes offered per group, in order. Labels come from i18n. */
const MODES: ActivityViewMode[] = ["visible", "grouped", "hidden"];

/**
 * General → Live log (was the Activity page): which activity groups the right-rail live
 * log shows as individual lines (`visible`), collapses into a counted row (`grouped`), or
 * hides entirely (`hidden`). A collapsible matrix panel (`#live-log`); each radio applies
 * instantly — the whole file-backed document is PUT (the mandate/chat posture).
 */
export function ActivitySection() {
  const { data: view } = useActivityViewQuery();
  if (!view) return null;
  return <ActivityEditor view={view} />;
}

function ActivityEditor({ view }: { view: ActivityView }) {
  const t = useTranslations("settings");
  const setView = useSetActivityViewMutation();
  const readOnly = useSettingsReadOnly();
  const [local, setLocal] = useState<ActivityView>(view);
  // The panel only mounts after the config loaded client-side, so reading the hash here is safe.
  const [open, setOpen] = useState(() => window.location.hash === "#live-log");

  // Deep link `#live-log` opens the panel and brings it into view once it has mounted.
  useEffect(() => {
    if (window.location.hash !== "#live-log") return;
    requestAnimationFrame(() => document.getElementById("live-log")?.scrollIntoView());
  }, []);

  const choose = (group: ActivityGroup, mode: ActivityViewMode) => {
    const next: ActivityView = { ...local, [group]: mode };
    setLocal(next);
    setView.mutate({ body: next });
  };

  const count = (mode: ActivityViewMode) => ACTIVITY_GROUPS.filter((g) => local[g] === mode).length;

  return (
    <SettingsPanel
      collapsible
      badge={<Tag>{t("activity.was")}</Tag>}
      description={t("activity.summary", {
        visible: count("visible"),
        grouped: count("grouped"),
        hidden: count("hidden"),
      })}
      id="live-log"
      onOpenChange={setOpen}
      open={open}
      title={t("activity.liveLog")}
    >
      <RadioMatrix
        ariaLabel={t("activity.liveLog")}
        caption={t("activity.hint")}
        columns={MODES.map((m) => ({ id: m, label: t(`activity.modes.${m}`) }))}
        disabled={readOnly}
        onChange={(group, mode) => choose(group as ActivityGroup, mode as ActivityViewMode)}
        rowHeader={t("activity.groupHeader")}
        rows={ACTIVITY_GROUPS.map((g) => ({
          id: g,
          label: t(`activity.groups.${g}`),
          value: local[g],
        }))}
      />
    </SettingsPanel>
  );
}
