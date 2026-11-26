"use client";

import { useTranslations } from "next-intl";
import { EmptyState, Markdown, Stack, Typography } from "@zibby/design-system";
import { useNoteQuery } from "../../knowledge/queries";

export enum GoalPlanTestId {
  Empty = "goal-plan-empty",
  Note = "goal-plan-note",
}

export interface GoalPlanPanelProps {
  /** Plan note ids of the instances that have one, with the label to show above each. */
  plans: Array<{ noteId: string; label: string }>;
}

function PlanNote({
  noteId,
  label,
  showLabel,
}: {
  noteId: string;
  label: string;
  showLabel: boolean;
}) {
  const t = useTranslations("goals.plan");
  const note = useNoteQuery(noteId);
  return (
    <Stack data-testid={`${GoalPlanTestId.Note}-${noteId}`} gap="100">
      {showLabel && (
        <Typography size="caption" type="label" variant="tertiary">
          {label}
        </Typography>
      )}
      {note.isError ? (
        <Typography size="caption" type="note" variant="secondary">
          {t("loadFailed")}
        </Typography>
      ) : note.data ? (
        <Markdown source={note.data.body ?? ""} variant="prose" />
      ) : (
        <Typography size="caption" type="note" variant="tertiary">
          {t("loading")}
        </Typography>
      )}
    </Stack>
  );
}

/** The plan note(s) the engine wrote, rendered from the vault; an empty state until the first plan exists. */
export function GoalPlanPanel({ plans }: GoalPlanPanelProps) {
  const t = useTranslations("goals.plan");
  if (plans.length === 0) {
    return (
      <EmptyState
        body={t("emptyBody")}
        data-testid={GoalPlanTestId.Empty}
        icon="file"
        title={t("emptyTitle")}
      />
    );
  }
  return (
    <Stack gap="250">
      {plans.map((p) => (
        <PlanNote key={p.noteId} label={p.label} noteId={p.noteId} showLabel={plans.length > 1} />
      ))}
    </Stack>
  );
}
