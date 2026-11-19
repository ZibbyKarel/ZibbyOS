"use client";

import { useTranslations } from "next-intl";
import { useDetailT } from "../useDetailT";
import { Button, Dialog, Icon, Stack, Typography } from "@zibby/design-system";
import { AgentDetailScreenTestId as TestId } from "../agentTestIds";
import type { WorkflowUse } from "./agentWorkflows";

export interface AgentDeleteDialogProps {
  name: string;
  file: string;
  /** Workflows whose phases will lose their agent. */
  breaks: WorkflowUse[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Delete confirm that lists the workflows it will break (the page's only dialog besides the leave guard). */
export function AgentDeleteDialog({
  name,
  file,
  breaks,
  pending,
  onCancel,
  onConfirm,
}: AgentDeleteDialogProps) {
  const t = useTranslations("agents");
  const td = useDetailT();
  const tk = useTranslations();
  return (
    <Dialog
      open
      actions={
        <>
          <Button intent="ghost" onClick={onCancel}>
            {tk("common.cancel")}
          </Button>
          <Button icon="trash" intent="danger" loading={pending} onClick={onConfirm}>
            {td("deleteAgent")}
          </Button>
        </>
      }
      onClose={onCancel}
      title={td("deleteTitle", { name })}
      width="sm"
    >
      <Stack gap="150">
        <Typography size="base" type="note" variant="secondary">
          {breaks.length > 0
            ? td("deleteUsed", { count: breaks.length })
            : t("deleteBody", { name, file })}
        </Typography>
        {breaks.length > 0 && (
          <Stack data-testid={TestId.DeleteBreaks} gap="75">
            {breaks.map(({ workflow, phaseIndexes }) => (
              <Stack align="center" direction="row" gap="100" key={workflow.id}>
                <Icon name="flow" size="xs" tone="faint" />
                <Typography size="sm" type="note">
                  {td("deleteBreakRow", {
                    workflow: workflow.name ?? workflow.id,
                    count: phaseIndexes.length,
                    n: phaseIndexes.map((i) => i + 1).join(", "),
                  })}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
        {breaks.length > 0 && (
          <Typography size="sm" type="note" variant="tertiary">
            {t("deleteBody", { name, file })}
          </Typography>
        )}
      </Stack>
    </Dialog>
  );
}
