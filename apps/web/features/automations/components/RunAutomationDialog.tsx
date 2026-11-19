"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TRIGGER_PROMPT_MAX } from "@zibby/contracts";
import { Button, Dialog, TextAreaField } from "@zibby/design-system";
import { useTriggerAutomationMutation } from "../mutations";

export enum RunAutomationDialogTestId {
  Run = "run-automation-run",
  Cancel = "run-automation-cancel",
}

export interface RunAutomationDialogProps {
  automationId: string;
  onClose: () => void;
}

/** Confirm-with-input before a manual run: an optional one-off extra prompt sent with the trigger. Closes itself on submit. */
export function RunAutomationDialog({ automationId, onClose }: RunAutomationDialogProps) {
  const t = useTranslations("automations");
  const trigger = useTriggerAutomationMutation();
  const [prompt, setPrompt] = useState("");

  const run = () => {
    const text = prompt.trim();
    trigger.mutate({ params: { id: automationId }, body: text ? { prompt: text } : {} });
    // Fire and close: the request can outlast the dialog (some targets run inline), and a
    // failure surfaces through the global mutation toast.
    onClose();
  };

  return (
    <Dialog
      open
      actions={
        <>
          <Button data-testid={RunAutomationDialogTestId.Cancel} intent="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            data-testid={RunAutomationDialogTestId.Run}
            icon="play"
            loading={trigger.isPending}
            onClick={run}
          >
            {t("runNow")}
          </Button>
        </>
      }
      closeLabel={t("close")}
      onClose={onClose}
      title={t("runDialogTitle")}
      width="md"
    >
      <TextAreaField
        hint={t("runPromptHint")}
        label={t("runPromptLabel")}
        maxLength={TRIGGER_PROMPT_MAX}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t("runPromptPlaceholder")}
        value={prompt}
      />
    </Dialog>
  );
}
