"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, CodeBlock, Panel, Stack, TextAreaField, Typography } from "@zibby/design-system";
import type { TaskRun } from "@zibby/contracts";
import { useResumeGoalRunMutation } from "../mutations";

export interface GoalWaitingCardProps {
  run: TaskRun;
}

/** A parked goal run: why it stopped, the last verdict, a note field, Resume / Resume without note. */
export function GoalWaitingCard({ run }: GoalWaitingCardProps) {
  const t = useTranslations("goalPage");
  const tr = useTranslations("runs");
  const resume = useResumeGoalRunMutation();
  const [note, setNote] = useState("");
  const reason = run.goalParkedReason ?? "iterations";
  const last = run.iterations?.at(-1)?.verifier.output;
  const go = (body: { note?: string }) => resume.mutate({ params: { runId: run.runId }, body });

  return (
    <Panel header={t("waitingForYou")} padding="250" role="alert" tone="warn">
      <Stack gap="150">
        <Stack gap="50">
          <Typography size="sm" type="bodySm" weight="semibold">
            {tr(`goalParkedReason.${reason}`)}
          </Typography>
          {reason === "awaiting-resume" ? (
            <Typography size="xs" type="note" variant="tertiary">
              {tr("goalParkedHint.awaiting-resume")}
            </Typography>
          ) : null}
        </Stack>
        {last ? <CodeBlock maxHeight="md" text={last} /> : null}
        <TextAreaField
          label={t("noteForNext")}
          onChange={(e) => setNote(e.target.value)}
          placeholder={tr("resumeNotePlaceholder")}
          value={note}
        />
        <Stack wrap direction="row" gap="100">
          <Button
            disabled={resume.isPending}
            icon="run"
            onClick={() => go({ note: note.trim() || undefined })}
            size="sm"
          >
            {t("resume")}
          </Button>
          <Button disabled={resume.isPending} intent="secondary" onClick={() => go({})} size="sm">
            {t("resumeWithoutNote")}
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}
