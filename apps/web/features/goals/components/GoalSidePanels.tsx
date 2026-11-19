"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Alert,
  Button,
  DetailTable,
  Panel,
  Stack,
  type SubNavLinkComponent,
  TextAreaField,
  TextLink,
  Typography,
} from "@zibby/design-system";
import type { Goal } from "@zibby/contracts";
import type { GoalDraft } from "../goalDraft";
import { GoalLimitsFields } from "./GoalLimitsFields";

export interface GoalErrorNoticeProps {
  /** Opens the maker editor ("Switch maker"). */
  onSwitchMaker: () => void;
}

/** Shown when the run ended in error: what happened, and the one in-page fix (switch the maker). */
export function GoalErrorNotice({ onSwitchMaker }: GoalErrorNoticeProps) {
  const t = useTranslations("goalPage");
  return (
    <Alert severity="error" title={t("runStopped")}>
      <Stack gap="100">
        <Typography size="sm" type="bodySm">
          {t("runStoppedBody")}
        </Typography>
        <Stack wrap align="center" direction="row" gap="100">
          <Button intent="secondary" onClick={onSwitchMaker} size="sm">
            {t("switchMaker")}
          </Button>
          <TextLink href="/system/settings/ai-models" linkComponent={Link as SubNavLinkComponent}>
            {t("aiEngines")}
          </TextLink>
        </Stack>
      </Stack>
    </Alert>
  );
}

export interface GoalSidePanelsProps {
  goal: Goal;
  editing: boolean;
  draft: GoalDraft;
  onChange: (patch: Partial<GoalDraft>) => void;
  /** Average cost + duration of one iteration, when derivable from the shown run. */
  perIteration?: string;
}

/** Side column cards: instructions to the maker, and the goal's limits (editable in edit mode). */
export function GoalSidePanels({
  goal,
  editing,
  draft,
  onChange,
  perIteration,
}: GoalSidePanelsProps) {
  const t = useTranslations("goalPage");
  const b = goal.budget;
  const rows = [
    { cells: [t("iterations"), t("maxN", { n: goal.maxIterations })] },
    ...(b?.dailyRuns || b?.weeklyRuns
      ? [
          {
            cells: [
              t("runs"),
              [
                b.dailyRuns ? t("perDay", { n: b.dailyRuns }) : null,
                b.weeklyRuns ? t("perWeek", { n: b.weeklyRuns }) : null,
              ]
                .filter(Boolean)
                .join(" · "),
            ],
          },
        ]
      : []),
    ...(b?.monthlyCostCapUsd
      ? [{ cells: [t("spend"), t("perMonth", { n: b.monthlyCostCapUsd })] }]
      : []),
    ...(perIteration ? [{ cells: [t("perIteration"), perIteration] }] : []),
  ];
  return (
    <Stack gap="150">
      <Panel header={t("instructions")} headerEnd={t("toTheMaker")} padding="200">
        {editing ? (
          <TextAreaField
            label={t("instructions")}
            onChange={(e) => onChange({ instructions: e.target.value })}
            rows={5}
            value={draft.instructions}
          />
        ) : (
          <Typography leading="relaxed" size="sm" type="bodySm" variant="secondary">
            {goal.instructions}
          </Typography>
        )}
      </Panel>
      <Panel header={t("limits")} padding="200">
        {editing ? (
          <GoalLimitsFields draft={draft} onChange={onChange} />
        ) : (
          <DetailTable rows={rows} />
        )}
      </Panel>
    </Stack>
  );
}
