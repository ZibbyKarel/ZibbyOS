"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SettingsPanel, SettingsRow, Slider } from "@zibby/design-system";
import type { SystemConfig } from "@zibby/contracts";
import { useSetSystemConfigMutation, useSystemConfigQuery } from "../../system";
import { useDraftPanel, useSettingsReadOnly } from "../draft/SettingsDraftProvider";
import { PanelActions } from "./PanelActions";

/** Testids for the auto-compaction panel. */
export enum AutoCompactPanelTestId {
  Opencode = "runtime-compact-opencode",
  Claude = "runtime-compact-claude",
}

type Compact = { opencode: number; claude: number };

/** AI engine → Auto-compaction: the context fill at which each engine compacts a run. */
export function AutoCompactPanel() {
  const { data: config } = useSystemConfigQuery();
  if (!config) return null;
  // Remount when the persisted config changes so the draft reseeds.
  return <AutoCompactEditor config={config} key={JSON.stringify(config)} />;
}

function AutoCompactEditor({ config }: { config: SystemConfig }) {
  const t = useTranslations("settings.runtimeGroups");
  const readOnly = useSettingsReadOnly();
  const setConfig = useSetSystemConfigMutation();
  const base: Compact = { ...config.autoCompactPct };
  const [draft, setDraft] = useState<Compact>(base);
  const dirty = draft.opencode !== base.opencode || draft.claude !== base.claude;

  // The whole document is PUT — spread the loaded config so other screens' fields survive.
  const save = async () => {
    await setConfig.mutateAsync({ body: { ...config, autoCompactPct: draft } });
  };
  const discard = () => setDraft(base);
  useDraftPanel({
    id: "context",
    label: t("context"),
    dirty,
    save,
    discard,
    batch: { key: "system-config", save },
  });

  return (
    <SettingsPanel
      actions={
        <PanelActions
          dirty={dirty}
          disabled={readOnly}
          onDiscard={discard}
          onSave={() => void save().catch(() => undefined)}
          saving={setConfig.isPending}
        />
      }
      description={t("contextHint")}
      id="context"
      title={t("context")}
      tone={dirty ? "dirty" : "default"}
    >
      {(
        [
          ["opencode", AutoCompactPanelTestId.Opencode],
          ["claude", AutoCompactPanelTestId.Claude],
        ] as const
      ).map(([k, testId]) => (
        <SettingsRow
          stack
          changed={draft[k] !== base[k]}
          key={k}
          label={t(`compact.${k}`)}
          was={draft[k] !== base[k] ? `${base[k]}%` : undefined}
        >
          <div data-testid={testId}>
            <Slider
              disabled={readOnly}
              format={(v) => `${v} %`}
              label={t("compactAt")}
              max={95}
              min={50}
              onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
              step={5}
              value={draft[k]}
            />
          </div>
        </SettingsRow>
      ))}
    </SettingsPanel>
  );
}
