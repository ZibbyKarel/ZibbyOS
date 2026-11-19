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
}

/**
 * THIS machine's per-machine config — `cloneRoot`, the local directory ZIBBY clones a
 * project into when it is not already present. Per-machine and never synced; keep-awake
 * is a per-browser switch that applies instantly (no draft).
 */
export function MachineSection() {
  const { data: config } = useMachineConfigQuery();
  if (!config) return null;
  // Remount the editor when the persisted config changes so local state reseeds.
  return <MachineEditor config={config} key={config.cloneRoot} />;
}

function MachineEditor({ config }: { config: MachineConfig }) {
  const t = useTranslations("settings");
  const readOnly = useSettingsReadOnly();
  const setConfig = useUpdateMachineConfigMutation();
  const [cloneRoot, setCloneRoot] = useState(config.cloneRoot);

  const trimmed = cloneRoot.trim();
  const dirty = trimmed !== config.cloneRoot;
  const save = async () => {
    if (trimmed) await setConfig.mutateAsync({ body: { cloneRoot: trimmed } });
  };
  const discard = () => setCloneRoot(config.cloneRoot);
  useDraftPanel({ id: "machine", label: t("machine.title"), dirty, save, discard });

  return (
    <SettingsPanel
      actions={
        <PanelActions
          dirty={dirty}
          disabled={readOnly || trimmed.length === 0}
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
        changed={dirty}
        hint={t("machine.cloneRootHint")}
        label={t("machine.cloneRootLabel")}
        was={dirty ? config.cloneRoot : undefined}
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
    </SettingsPanel>
  );
}
