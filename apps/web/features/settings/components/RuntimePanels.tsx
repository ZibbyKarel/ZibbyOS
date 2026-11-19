"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  SettingsDuration,
  SettingsPanel,
  SettingsRow,
  SettingsStepper,
  StatusBadge,
  Toggle,
} from "@zibby/design-system";
import type { SystemConfig } from "@zibby/contracts";
import { useSetSystemConfigMutation, useSystemConfigQuery } from "../../system";
import { useDraftPanel, useSettingsReadOnly } from "../draft/SettingsDraftProvider";
import { PanelActions } from "./PanelActions";

/** Testids for the runtime panels (the screen + tests select via these). */
export enum RuntimePanelsTestId {
  /** Suffixed with the tick key, e.g. `runtime-tick-taskTickMs`. */
  Tick = "runtime-tick",
  MaxRuns = "runtime-max-runs",
  MaxCycles = "runtime-max-cycles",
  Dock = "runtime-dock",
  AutoResume = "runtime-auto-resume",
}

const TICKS = [
  ["taskTickMs", "task"],
  ["channelTickMs", "channel"],
  ["monitorTickMs", "monitor"],
  ["automationTickMs", "automation"],
  ["limitResumeTickMs", "limitResume"],
  ["roadmapTickMs", "roadmap"],
] as const;
type TickKey = (typeof TICKS)[number][0];
type Group = "sch" | "lim";

interface Draft {
  /** Minutes (a sub-minute legacy tick displays rounded up so it never reads as off). */
  ticks: Record<TickKey, number>;
  maxRuns: number;
  maxCycles: number;
  dock: number;
  autoResume: boolean;
}

const toDraft = (c: SystemConfig): Draft => ({
  ticks: Object.fromEntries(TICKS.map(([k]) => [k, Math.ceil(c[k] / 60_000)])) as Draft["ticks"],
  maxRuns: c.maxConcurrentRuns,
  maxCycles: c.limitResumeMax,
  dock: c.dockDoneTasksLimit,
  autoResume: c.goalAutoResume,
});

function dirtyGroups(d: Draft, b: Draft): Record<Group, boolean> {
  return {
    sch: TICKS.some(([k]) => d.ticks[k] !== b.ticks[k]),
    lim:
      d.maxRuns !== b.maxRuns ||
      d.maxCycles !== b.maxCycles ||
      d.dock !== b.dock ||
      d.autoResume !== b.autoResume,
  };
}

/** The config fields one group owns; untouched ticks keep their stored ms. */
function patchFor(g: Group, d: Draft, b: Draft, c: SystemConfig): Partial<SystemConfig> {
  if (g === "sch")
    return Object.fromEntries(
      TICKS.map(([k]) => [k, d.ticks[k] === b.ticks[k] ? c[k] : d.ticks[k] * 60_000]),
    );
  return {
    maxConcurrentRuns: d.maxRuns,
    limitResumeMax: d.maxCycles,
    dockDoneTasksLimit: d.dock,
    goalAutoResume: d.autoResume,
  };
}

const fmtMin = (x: number, off: string) => {
  if (x === 0) return off;
  const h = Math.floor(x / 60);
  const m = x % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
};

/** Runtime → Schedulers / Limits: two draft panels over one config document. */
export function RuntimePanels() {
  const { data: config } = useSystemConfigQuery();
  if (!config) return null;
  // Remount when the persisted config changes so the drafts reseed.
  return <RuntimeEditor config={config} key={JSON.stringify(config)} />;
}

function RuntimeEditor({ config }: { config: SystemConfig }) {
  const t = useTranslations("settings.runtimeGroups");
  const tu = useTranslations("settings.runtime.unit");
  const readOnly = useSettingsReadOnly();
  const setConfig = useSetSystemConfigMutation();
  const base = toDraft(config);
  const [draft, setDraft] = useState<Draft>(base);
  const dirty = dirtyGroups(draft, base);
  const off = t("off");

  const save = async (groups: Group[]) => {
    const patch = Object.assign({}, ...groups.map((g) => patchFor(g, draft, base, config)));
    // The whole document is PUT — spread the loaded config so other screens' fields survive.
    await setConfig.mutateAsync({ body: { ...config, ...patch } });
  };
  const discard = (g: Group) =>
    setDraft((d) => {
      const b = toDraft(config);
      if (g === "sch") return { ...d, ticks: b.ticks };
      return {
        ...d,
        maxRuns: b.maxRuns,
        maxCycles: b.maxCycles,
        dock: b.dock,
        autoResume: b.autoResume,
      };
    });
  const dirtyList = (Object.keys(dirty) as Group[]).filter((g) => dirty[g]);

  const handle = (g: Group, id: string, label: string) => ({
    id,
    label,
    dirty: dirty[g],
    save: () => save([g]),
    discard: () => discard(g),
    batch: { key: "system-config", save: () => save(dirtyList) },
  });
  useDraftPanel(handle("sch", "schedulers", t("schedulers")));
  useDraftPanel(handle("lim", "limits", t("limits")));

  const panel = (g: Group) => ({
    tone: dirty[g] ? ("dirty" as const) : ("default" as const),
    actions: (
      <PanelActions
        dirty={dirty[g]}
        disabled={readOnly}
        onDiscard={() => discard(g)}
        onSave={() => void save([g]).catch(() => undefined)}
        saving={setConfig.isPending}
      />
    ),
  });
  const was = (cur: number, prev: number, fmt: (x: number) => string) =>
    cur !== prev ? fmt(prev) : undefined;
  const plain = (x: number) => String(x);

  return (
    <>
      <SettingsPanel
        description={t("schedulersHint")}
        id="schedulers"
        title={t("schedulers")}
        {...panel("sch")}
      >
        {TICKS.map(([k, name]) => {
          const v = draft.ticks[k];
          const chg = v !== base.ticks[k];
          return (
            <SettingsRow
              changed={chg}
              hint={t(`tick.${name}Hint` as never)}
              key={k}
              label={t(`tick.${name}` as never)}
              was={was(v, base.ticks[k], (x) => fmtMin(x, off))}
            >
              {v === 0 && <StatusBadge tone="off">{t("offBadge")}</StatusBadge>}
              <span data-testid={`${RuntimePanelsTestId.Tick}-${k}`}>
                <SettingsDuration
                  changed={chg}
                  disabled={readOnly}
                  hoursLabel={tu("hours")}
                  label={t(`tick.${name}` as never)}
                  minutesLabel={tu("minutes")}
                  onChange={(m) => setDraft((d) => ({ ...d, ticks: { ...d.ticks, [k]: m } }))}
                  value={v}
                />
              </span>
            </SettingsRow>
          );
        })}
      </SettingsPanel>

      <SettingsPanel
        description={t("limitsHint")}
        id="limits"
        title={t("limits")}
        {...panel("lim")}
      >
        <SettingsRow
          changed={draft.maxRuns !== base.maxRuns}
          hint={t("maxRunsHint")}
          label={t("maxRuns")}
          was={was(draft.maxRuns, base.maxRuns, plain)}
        >
          <span data-testid={RuntimePanelsTestId.MaxRuns}>
            <SettingsStepper
              changed={draft.maxRuns !== base.maxRuns}
              disabled={readOnly}
              label={t("maxRuns")}
              max={64}
              min={1}
              onChange={(maxRuns) => setDraft((d) => ({ ...d, maxRuns }))}
              value={draft.maxRuns}
            />
          </span>
        </SettingsRow>
        <SettingsRow
          changed={draft.maxCycles !== base.maxCycles}
          hint={t("maxCyclesHint")}
          label={t("maxCycles")}
          was={was(draft.maxCycles, base.maxCycles, plain)}
        >
          <span data-testid={RuntimePanelsTestId.MaxCycles}>
            <SettingsStepper
              changed={draft.maxCycles !== base.maxCycles}
              disabled={readOnly}
              label={t("maxCycles")}
              max={50}
              min={1}
              onChange={(maxCycles) => setDraft((d) => ({ ...d, maxCycles }))}
              value={draft.maxCycles}
            />
          </span>
        </SettingsRow>
        <SettingsRow
          changed={draft.dock !== base.dock}
          hint={t("dockHint")}
          label={t("dock")}
          was={was(draft.dock, base.dock, plain)}
        >
          <span data-testid={RuntimePanelsTestId.Dock}>
            <SettingsStepper
              changed={draft.dock !== base.dock}
              disabled={readOnly}
              label={t("dock")}
              max={100}
              min={1}
              onChange={(dock) => setDraft((d) => ({ ...d, dock }))}
              value={draft.dock}
            />
          </span>
        </SettingsRow>
        <SettingsRow
          changed={draft.autoResume !== base.autoResume}
          hint={t("autoResumeHint")}
          label={t("autoResume")}
          labelEnd={
            <StatusBadge noDot tone="off">
              {t("restartRequired")}
            </StatusBadge>
          }
          was={draft.autoResume !== base.autoResume ? (base.autoResume ? t("on") : off) : undefined}
        >
          <Toggle
            checked={draft.autoResume}
            data-testid={RuntimePanelsTestId.AutoResume}
            disabled={readOnly}
            label={t("autoResume")}
            onChange={(autoResume) => setDraft((d) => ({ ...d, autoResume }))}
          />
        </SettingsRow>
      </SettingsPanel>
    </>
  );
}
