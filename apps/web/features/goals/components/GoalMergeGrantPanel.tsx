"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Goal } from "@zibby/contracts";
import {
  Alert,
  Button,
  SelectField,
  Stack,
  TextInputField,
  Typography,
} from "@zibby/design-system";
import { apiErrorMessage } from "../../../state/apiErrorMessage";
import { isOperatorTokenError } from "../../../state/operatorToken";
import { isoToLocalInput, localInputToIso } from "../goalForm";
import { type GoalNames, formatGoalDateTime } from "../goalView";
import { useClearGoalMergeGrantMutation, useSetGoalMergeGrantMutation } from "../mutations";

export enum GoalMergeGrantTestId {
  NeedsTier3 = "goal-merge-grant-needs-tier3",
  Active = "goal-merge-grant-active",
  Until = "goal-merge-grant-until",
  Grant = "goal-merge-grant-grant",
  Revoke = "goal-merge-grant-revoke",
  Error = "goal-merge-grant-error",
}

export interface GoalMergeGrantPanelProps {
  goal: Goal;
  /** The projects the goal's scope covers (the only ones a grant may list). */
  projectIds: string[];
  names: GoalNames;
}

/**
 * The goal's merge grant: shown and set only for a tier3 goal. Setting and revoking need the
 * operator token; a 401 is the "locked" state, as on the autonomy page (`useSaveAutomation`).
 */
export function GoalMergeGrantPanel({ goal, projectIds, names }: GoalMergeGrantPanelProps) {
  const t = useTranslations("goals.mergeGrant");
  const tk = useTranslations();
  const locale = useLocale();
  const set = useSetGoalMergeGrantMutation();
  const clear = useClearGoalMergeGrantMutation();
  const [picked, setPicked] = useState<string[]>([]);
  const [until, setUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Captured once per mount (render stays pure); an expiry while the page is open shows on refetch.
  const [now] = useState(() => Date.now());
  const fail = (e: unknown) =>
    setError(isOperatorTokenError(e) ? t("locked") : (apiErrorMessage(e) ?? t("failed")));

  if (goal.ceiling !== "tier3") {
    return (
      <Typography data-testid={GoalMergeGrantTestId.NeedsTier3} size="base" type="note">
        {t("needsTier3")}
      </Typography>
    );
  }
  if (projectIds.length === 0) {
    return (
      <Typography size="base" type="note" variant="secondary">
        {t("noProjects")}
      </Typography>
    );
  }

  const grant = goal.mergeGrant;
  const active = grant && Date.parse(grant.until) > now;
  const untilIso = localInputToIso(until);

  return (
    <Stack gap="150">
      <Typography size="base" type="note" variant="secondary">
        {t("intro")}
      </Typography>
      {error && (
        <Alert
          data-testid={GoalMergeGrantTestId.Error}
          onClose={() => setError(null)}
          severity="error"
        >
          {error}
        </Alert>
      )}
      {grant && active ? (
        <Stack wrap align="center" direction="row" gap="150" justify="between">
          <Typography data-testid={GoalMergeGrantTestId.Active} size="base" type="note">
            {t("active", {
              until: formatGoalDateTime(grant.until, locale),
              projects: grant.projectIds.map(names.projectName).join(", "),
            })}
          </Typography>
          <Button
            data-testid={GoalMergeGrantTestId.Revoke}
            icon="trash"
            intent="danger"
            loading={clear.isPending}
            onClick={() => {
              setError(null);
              clear.mutate({ params: { id: goal.id }, body: {} }, { onError: fail });
            }}
            size="sm"
          >
            {t("revoke")}
          </Button>
        </Stack>
      ) : (
        <Stack gap="150">
          {grant && (
            <Typography size="base" type="note" variant="tertiary">
              {t("expired", { until: formatGoalDateTime(grant.until, locale) })}
            </Typography>
          )}
          <SelectField
            multi
            label={t("projects")}
            onValueChange={setPicked}
            options={projectIds.map((id) => ({ value: id, label: names.projectName(id) }))}
            placeholder={t("projectsPlaceholder")}
            removeLabel={tk("common.delete")}
            value={picked}
          />
          <TextInputField
            data-testid={GoalMergeGrantTestId.Until}
            hint={t("untilHint")}
            label={t("until")}
            max={isoToLocalInput(new Date(now + 24 * 3_600_000).toISOString())}
            min={isoToLocalInput(new Date(now).toISOString())}
            onChange={(e) => setUntil(e.target.value)}
            type="datetime-local"
            value={until}
          />
          <Stack direction="row" justify="end">
            <Button
              data-testid={GoalMergeGrantTestId.Grant}
              disabled={picked.length === 0 || !untilIso}
              loading={set.isPending}
              onClick={() => {
                if (!untilIso) return;
                setError(null);
                set.mutate(
                  { params: { id: goal.id }, body: { projectIds: picked, until: untilIso } },
                  { onError: fail, onSuccess: () => setPicked([]) },
                );
              }}
              size="sm"
            >
              {t("grant")}
            </Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
