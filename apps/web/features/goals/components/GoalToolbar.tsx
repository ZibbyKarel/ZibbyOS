"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button, MenuButton, type MenuButtonEntry } from "@zibby/design-system";
import type { TaskRun } from "@zibby/contracts";
import { PageActions } from "../../../components/layout/PageActions/PageActions";
import { isStoppableRun } from "../../runs/run";
import { goalStateTone } from "../goal";

export interface GoalToolbarProps {
  /** Runs of this goal, newest first. */
  runs: readonly TaskRun[];
  selectedRunId: string | undefined;
  onSelectRun: (runId: string) => void;
  /** The run on screen (drives Stop vs Start / Run again). */
  run: TaskRun | undefined;
  editing: boolean;
  canSave: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onStart: () => void;
  starting: boolean;
  onStop: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const LIVE = new Set(["running", "parked", "paused-limit"]);

/** The goal page's toolbar in the shell's action row: run selector, Edit/Save, Stop/Start, More. */
export function GoalToolbar({
  runs,
  selectedRunId,
  onSelectRun,
  run,
  editing,
  canSave,
  saving,
  onEdit,
  onCancel,
  onSave,
  onStart,
  starting,
  onStop,
  onRename,
  onDuplicate,
  onDelete,
}: GoalToolbarProps) {
  const t = useTranslations("goalPage");
  const tone = useTranslations("goals.stateTone");
  const locale = useLocale();
  const live = runs.some((r) => LIVE.has(r.status));
  const runItems: MenuButtonEntry[] = runs.map((r, i) => ({
    id: r.runId,
    label: `${selectedRunId === r.runId ? "● " : ""}#${runs.length - i} · ${tone(goalStateTone(r.status))} · ${new Date(r.startedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}`,
    description: [
      t("iterationCount", { n: r.iterations?.length ?? 0 }),
      ...(r.costUsd !== undefined ? [`$${r.costUsd.toFixed(2)}`] : []),
    ].join(" · "),
    onSelect: () => onSelectRun(r.runId),
  }));

  return (
    <PageActions>
      {runItems.length > 0 ? (
        <MenuButton
          ariaLabel={t("runHistory")}
          icon="clock"
          items={runItems}
          renderTrigger={(props) => (
            <Button icon="clock" intent="ghost" size="sm" {...props}>
              {t("runLabel", {
                n:
                  runs.length -
                  Math.max(
                    0,
                    runs.findIndex((r) => r.runId === selectedRunId),
                  ),
              })}
              {run ? ` · ${tone(goalStateTone(run.status))}` : ""}
            </Button>
          )}
        />
      ) : null}
      {editing ? (
        <>
          <Button intent="ghost" onClick={onCancel} size="sm">
            {t("cancel")}
          </Button>
          <Button disabled={!canSave} icon="check" loading={saving} onClick={onSave} size="sm">
            {t("save")}
          </Button>
        </>
      ) : (
        <Button icon="edit" intent="ghost" onClick={onEdit} size="sm">
          {t("edit")}
        </Button>
      )}
      {run && isStoppableRun(run) ? (
        <Button icon="stop" intent="danger" onClick={onStop} size="sm">
          {t("stop")}
        </Button>
      ) : (
        <Button disabled={live || starting} icon="play" onClick={onStart} size="sm">
          {runs.length === 0 ? t("start") : t("runAgain")}
        </Button>
      )}
      <MenuButton
        ariaLabel={t("more")}
        items={[
          { id: "rename", label: t("rename"), icon: "pen", onSelect: onRename },
          { id: "duplicate", label: t("duplicate"), icon: "copy", onSelect: onDuplicate },
          { id: "div", divider: true },
          { id: "delete", label: t("delete"), icon: "trash", danger: true, onSelect: onDelete },
        ]}
      />
    </PageActions>
  );
}
