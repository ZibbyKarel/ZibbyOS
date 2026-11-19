"use client";

import { Button } from "@zibby/design-system";
import { useTranslations } from "next-intl";

export enum PanelActionsTestId {
  Discard = "settings-panel-discard",
  Save = "settings-panel-save",
}

export interface PanelActionsProps {
  dirty: boolean;
  saving: boolean;
  disabled?: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

/** Per-panel Discard / Save pair, shown only while the panel has unsaved edits. */
export function PanelActions({ dirty, saving, disabled, onDiscard, onSave }: PanelActionsProps) {
  const t = useTranslations("settings.draft");
  if (!dirty) return null;
  return (
    <>
      <Button data-testid={PanelActionsTestId.Discard} intent="ghost" onClick={onDiscard} size="sm">
        {t("discard")}
      </Button>
      <Button
        data-testid={PanelActionsTestId.Save}
        disabled={disabled}
        intent="ink"
        loading={saving}
        onClick={onSave}
        size="sm"
      >
        {t("save")}
      </Button>
    </>
  );
}
