"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SettingsPanel, SettingsRow, TextInputField } from "@zibby/design-system";
import type { MachineConfig } from "@zibby/contracts";
import { useMachineConfigQuery, useUpdateMachineConfigMutation } from "../../machine";
import { useDraftPanel, useSettingsReadOnly } from "../draft/SettingsDraftProvider";
import { KeepAwakeRow } from "./KeepAwakeRow";
import { PanelActions } from "./PanelActions";

/** Testids for the per-machine config editor (the screen + tests select via these). */
export enum MachineSectionTestId {
  CloneRoot = "machine-clone-root",
  GeneratedRoot = "machine-generated-root",
}

/**
 * THIS machine's per-machine config — `cloneRoot` (where ZIBBY clones a
 * project when it is not already present) and `generatedRoot` (where run deliverables land). Per-machine and never synced; keep-awake
 * is a per-browser switch that applies instantly (no draft).
 */
export function MachineSection() {
  const { data: config } = useMachineConfigQuery();
  if (!config) return null;
  // Remount the editor when the persisted config changes so local state reseeds.
  return <MachineEditor config={config} key={`${config.cloneRoot}|${config.generatedRoot}`} />;
}

function MachineEditor({ config }: { config: MachineConfig }) {
  const t = useTranslations("settings");
  const readOnly = useSettingsReadOnly();
  const setConfig = useUpdateMachineConfigMutation();
  const [cloneRoot, setCloneRoot] = useState(config.cloneRoot);
  const [generatedRoot, setGeneratedRoot] = useState(config.generatedRoot);

  const trimmed = cloneRoot.trim();
  const trimmedGenerated = generatedRoot.trim();
  const cloneDirty = trimmed !== config.cloneRoot;
  const generatedDirty = trimmedGenerated !== config.generatedRoot;
  const dirty = cloneDirty || generatedDirty;
  const save = async () => {
    if (!trimmed || !trimmedGenerated) return;
    await setConfig.mutateAsync({
      body: {
        ...(cloneDirty ? { cloneRoot: trimmed } : {}),
        ...(generatedDirty ? { generatedRoot: trimmedGenerated } : {}),
      },
    });
  };
  const discard = () => {
    setCloneRoot(config.cloneRoot);
    setGeneratedRoot(config.generatedRoot);
  };
  useDraftPanel({ id: "machine", label: t("machine.title"), dirty, save, discard });

  return (
    <SettingsPanel
      actions={
        <PanelActions
          dirty={dirty}
          disabled={readOnly || trimmed.length === 0 || trimmedGenerated.length === 0}
          onDiscard={discard}
          onSave={() => void save().catch(() => undefined)}
          saving={setConfig.isPending}
        />
      }
      description={t("machine.panelHint")}
      id="machine"
      title={t("machine.title")}
      tone={dirty ? "dirty" : "default"}
    >
      <KeepAwakeRow />
      <SettingsRow
        changed={cloneDirty}
        hint={t("machine.cloneRootHint")}
        label={t("machine.cloneRootLabel")}
        was={cloneDirty ? config.cloneRoot : undefined}
      >
        <TextInputField
          hideLabel
          data-testid={MachineSectionTestId.CloneRoot}
          disabled={readOnly}
          label={t("machine.cloneRootLabel")}
          onChange={(e) => setCloneRoot(e.target.value)}
          placeholder={config.cloneRoot}
          value={cloneRoot}
        />
      </SettingsRow>
      <SettingsRow
        changed={generatedDirty}
        hint={
          generatedDirty
            ? t("machine.generatedRootWarning", { old: config.generatedRoot })
            : t("machine.generatedRootHint")
        }
        label={t("machine.generatedRootLabel")}
        was={generatedDirty ? config.generatedRoot : undefined}
      >
        <TextInputField
          hideLabel
          data-testid={MachineSectionTestId.GeneratedRoot}
          disabled={readOnly}
          label={t("machine.generatedRootLabel")}
          onChange={(e) => setGeneratedRoot(e.target.value)}
          placeholder={config.generatedRoot}
          value={generatedRoot}
        />
      </SettingsRow>
    </SettingsPanel>
  );
}
