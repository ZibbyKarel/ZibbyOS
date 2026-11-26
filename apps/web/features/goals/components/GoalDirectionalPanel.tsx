"use client";

import { useTranslations } from "next-intl";
import type { GoalDirectional, GoalInstance, GoalState } from "@zibby/contracts";
import { Stack, Typography } from "@zibby/design-system";
import type { GoalNames } from "../goalView";

export enum GoalDirectionalTestId {
  Checklist = "goal-directional-checklist",
  Decisions = "goal-directional-decisions",
  Autonomy = "goal-directional-autonomy",
}

export interface GoalDirectionalPanelProps {
  directional: GoalDirectional;
  decisions?: GoalState["decisionsThisMonth"];
  instances: Record<string, GoalInstance>;
  names: GoalNames;
}

const PRAGUE_MONTH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
});

/** Directional goal: checklist, this month's decision counter and each instance's effective autonomy. */
export function GoalDirectionalPanel({
  directional,
  decisions,
  instances,
  names,
}: GoalDirectionalPanelProps) {
  const t = useTranslations("goals.directional");
  const count = decisions?.month === PRAGUE_MONTH.format(new Date()) ? decisions.count : 0;
  return (
    <Stack gap="200">
      <Stack data-testid={GoalDirectionalTestId.Checklist} gap="50">
        <Typography size="2xs" type="label" variant="tertiary">
          {t("checklist")}
        </Typography>
        {directional.checklist.length === 0 && (
          <Typography size="base" type="note" variant="secondary">
            {t("noChecklist")}
          </Typography>
        )}
        {directional.checklist.map((c) => (
          <Typography key={c.id} size="base" type="note">
            {c.done ? "☑" : "☐"} {c.title}
          </Typography>
        ))}
      </Stack>
      <Stack gap="25">
        <Typography size="2xs" type="label" variant="tertiary">
          {t("decisions")}
        </Typography>
        <Typography data-testid={GoalDirectionalTestId.Decisions} size="base" type="note">
          {t("decisionsValue", { count, max: directional.maxDecisionsPerMonth })}
        </Typography>
      </Stack>
      <Stack gap="25">
        <Typography size="2xs" type="label" variant="tertiary">
          {t("autonomy")}
        </Typography>
        {Object.entries(instances).map(([key, instance]) => {
          const a = instance.autoDecide;
          const line =
            a?.level === "auto"
              ? t("line.auto")
              : t("line.proposes", {
                  why: t(`why.${a ? (a.reason === "level" ? a.level : a.reason) : "unknown"}`),
                });
          return (
            <Typography
              data-testid={`${GoalDirectionalTestId.Autonomy}-${key}`}
              key={key}
              size="base"
              type="note"
            >
              {key === "_" ? line : `${names.projectName(key)}: ${line}`}
            </Typography>
          );
        })}
      </Stack>
    </Stack>
  );
}
