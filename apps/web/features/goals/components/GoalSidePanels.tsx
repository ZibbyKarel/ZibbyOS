"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Alert,
  Button,
  DetailTable,
  Markdown,
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
  /** Switches the page into edit mode (the Limits "Edit" link). */
  onEdit?: () => void;
  /** Average cost + duration of one iteration, when derivable from the shown run. */
  perIteration?: string;
}

/** Side column cards: instructions to the maker, and the goal's limits (editable in edit mode). */
export function GoalSidePanels({
  goal,
  editing,
  draft,
  onChange,
  onEdit,
  perIteration,
}: GoalSidePanelsProps) {
  const t = useTranslations("goalPage");
  const b = goal.budget;
  const mono = (v: string) => (
    <Typography mono size="sm" type="bodySm">
      {v}
    </Typography>
  );
  const rows = [
    { cells: [t("iterations"), mono(t("maxN", { n: goal.maxIterations }))] },
    ...(b?.dailyRuns || b?.weeklyRuns
      ? [
          {
            cells: [
              t("runs"),
              mono(
                [
                  b.dailyRuns ? t("perDay", { n: b.dailyRuns }) : null,
                  b.weeklyRuns ? t("perWeek", { n: b.weeklyRuns }) : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              ),
            ],
          },
        ]
      : []),
    ...(b?.monthlyCostCapUsd
      ? [{ cells: [t("spend"), mono(t("perMonth", { n: b.monthlyCostCapUsd }))] }]
      : []),
    ...(perIteration ? [{ cells: [t("perIteration"), mono(perIteration)] }] : []),
  ];
  return (
    <Stack gap="150">
      <Panel
        header={t("instructions")}
        headerEnd={t("toTheMaker")}
        headerRule={false}
        padding="200"
      >
        {editing ? (
          <TextAreaField
            label={t("instructions")}
            onChange={(e) => onChange({ instructions: e.target.value })}
            rows={5}
            value={draft.instructions}
          />
        ) : (
          <Markdown compact escapeHtml source={goal.instructions} />
        )}
      </Panel>
      <Panel
        header={t("limits")}
        headerEnd={
          editing || !onEdit ? undefined : (
            <Button icon="edit" intent="ghost" onClick={onEdit} size="sm">
              {t("edit")}
            </Button>
          )
        }
        headerRule={false}
        padding="200"
      >
        {editing ? (
          <GoalLimitsFields draft={draft} onChange={onChange} />
        ) : (
          <DetailTable rows={rows} />
        )}
      </Panel>
    </Stack>
  );
}
