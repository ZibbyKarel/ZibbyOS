"use client";

import type { GoalInstance } from "@zibby/contracts";
import {
  AnchoredSheet,
  Button,
  SheetAction,
  SheetBanner,
  SheetSection,
  SheetText,
  Stack,
  Typography,
} from "@zibby/design-system";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { QueryError } from "../../../../components/LoadError/QueryError";
import { apiErrorMessage } from "../../../../state/apiErrorMessage";
import { GoalInstanceStatus } from "../../../goals/components/GoalInstanceStatus";
import { GoalPlanPanel } from "../../../goals/components/GoalPlanPanel";
import { GoalCycleTimeline } from "../../../goals/components/GoalCycleTimeline";
import { GoalUpcoming } from "../../../goals/components/GoalUpcoming";
import { GOAL_CARD_STATE, isGoalNotFound } from "../../../goals/goalView";
import {
  useResumeGoalInstanceMutation,
  useUpdateGoalMutation,
  useWakeGoalMutation,
} from "../../../goals/mutations";
import { useGoalQuery, useGoalStateQuery } from "../../../goals/queries";
import { useProjectsQuery } from "../../../projects/queries";
import { type SheetProps, geometry } from "./sheetTypes";

export enum GoalSheetTestId {
  Wake = "goal-sheet-wake",
  Toggle = "goal-sheet-toggle",
  Log = "goal-sheet-log",
  Status = "goal-sheet-status",
  StateError = "goal-sheet-state-error",
  Next = "goal-sheet-next",
  Instance = "goal-sheet-instance",
  Resume = "goal-sheet-resume",
  Error = "goal-sheet-error",
}

/**
 * Goal detail (Bridge "Goals" widget): the goal page's own parts — the cycle timeline ("Co se
 * dělo") and "Co bude" (what each instance waits on and when it wakes, the next cycle / the
 * deadline) — plus the instances' status with Resume and the plan note. Wake and enable/pause top-right; the title
 * opens the goal page.
 */
export function GoalSheet({ id, anchor, onClose, frame }: SheetProps) {
  const t = useTranslations();
  const g = useTranslations("bridge.widgets.goals");
  const ts = useTranslations("goals");
  const router = useRouter();
  const goalQuery = useGoalQuery(id);
  const stateQuery = useGoalStateQuery(id);
  const projects = useProjectsQuery().data ?? [];
  const update = useUpdateGoalMutation();
  const wake = useWakeGoalMutation();
  const resume = useResumeGoalInstanceMutation();
  const [resuming, setResuming] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const fail = (e: unknown) => setError(apiErrorMessage(e) ?? ts("actionFailed"));
  // A new action clears the last failure; a failure of the new one sets it again.
  const run = (start: (opts: { onError: (e: unknown) => void }) => void) => {
    setError(null);
    start({ onError: fail });
  };

  // ts-rest throws every non-2xx response, so `error` is the `{ status, body }`: 404 = gone.
  // A 404 wins over cached data: a goal deleted while the sheet is open reads as gone.
  const goalGone = goalQuery.isError && isGoalNotFound(goalQuery.error);
  const goal = goalGone ? undefined : goalQuery.data;
  if (!goal) {
    return (
      <AnchoredSheet
        {...geometry(anchor, frame)}
        closeLabel={t("bridge.sheet.close")}
        copyId={id}
        glyph="compass"
        kind={t("bridge.sheet.kind.goal")}
        onClose={onClose}
        title={id}
      >
        <SheetSection>
          <div data-testid={GoalSheetTestId.Status}>
            {goalQuery.isPending ? (
              <SheetText lines={[t("common.loading")]} />
            ) : goalGone ? (
              <SheetText lines={[g("gone")]} />
            ) : (
              <QueryError onRetry={() => void goalQuery.refetch()} />
            )}
          </div>
        </SheetSection>
      </AnchoredSheet>
    );
  }
  const stateView = stateQuery.data;
  const stateFailed = stateQuery.isError;
  const state = stateView?.state;
  const rollup = stateView?.rollup;
  const instances = Object.entries(state?.instances ?? {});
  const names = {
    projectName: (pid: string) => projects.find((p) => p.id === pid)?.name ?? pid,
    companyName: (cid: string) => cid,
  };
  const display = rollup?.status;
  const label = (key: string) => (key === "_" ? ts("instances.noProject") : names.projectName(key));
  const plans = instances.flatMap(([key, i]) =>
    i.planNoteId ? [{ noteId: i.planNoteId, label: label(key) }] : [],
  );
  const renderInstance = (key: string, i: GoalInstance) => (
    <Stack data-testid={`${GoalSheetTestId.Instance}-${key}`} gap="50" key={key}>
      <Stack align="start" direction="row" gap="100">
        <Typography size="caption" type="label" weight="semibold">
          {label(key)}
        </Typography>
        <GoalInstanceStatus instance={i} instanceKey={key} />
      </Stack>
      {i.summary && <SheetText lines={[i.summary]} />}
      {i.status === "parked" && (
        <div>
          <Button
            data-testid={`${GoalSheetTestId.Resume}-${key}`}
            icon="play"
            intent="secondary"
            loading={resuming === key}
            onClick={() => {
              setResuming(key);
              run((o) =>
                resume.mutate(
                  { params: { id, instance: key }, body: {} },
                  { ...o, onSettled: () => setResuming(null) },
                ),
              );
            }}
            size="sm"
          >
            {ts("instances.resume")}
          </Button>
        </div>
      )}
    </Stack>
  );

  return (
    <AnchoredSheet
      {...geometry(anchor, frame)}
      actions={
        <>
          <SheetAction
            data-testid={GoalSheetTestId.Toggle}
            disabled={update.isPending}
            onClick={() =>
              run((o) => update.mutate({ params: { id }, body: { enabled: !goal.enabled } }, o))
            }
          >
            {goal.enabled ? g("pause") : g("enable")}
          </SheetAction>
          <SheetAction
            data-testid={GoalSheetTestId.Wake}
            disabled={wake.isPending}
            intent="primary"
            onClick={() => run((o) => wake.mutate({ params: { id }, body: {} }, o))}
          >
            {ts("detail.wake")}
          </SheetAction>
        </>
      }
      banner={
        error ? (
          <div data-testid={GoalSheetTestId.Error}>
            <SheetBanner icon="warn" title={error} tone="error" />
          </div>
        ) : undefined
      }
      closeLabel={t("bridge.sheet.close")}
      copyId={id}
      glyph="compass"
      kind={t("bridge.sheet.kind.goal")}
      onClose={onClose}
      onTitleClick={() => router.push(`/work/goals/${encodeURIComponent(id)}` as Route)}
      title={goal.name}
      tones={display ? [{ tone: GOAL_CARD_STATE[display], label: ts(`status.${display}`) }] : []}
    >
      <SheetSection>
        <div data-testid={GoalSheetTestId.Log}>
          <GoalCycleTimeline
            goalId={id}
            instances={instances.map(([key]) => key)}
            liveIndex={state?.cycle.index}
            names={names}
            standing={goal.cadence !== undefined}
            status={rollup?.status}
          />
        </div>
        {stateFailed ? (
          <div data-testid={GoalSheetTestId.StateError}>
            <QueryError onRetry={() => void stateQuery.refetch()} />
          </div>
        ) : state ? (
          <Stack data-testid={GoalSheetTestId.Next} gap="150">
            <GoalUpcoming goal={goal} names={names} now={now} state={state} />
            {instances.map(([key, i]) => renderInstance(key, i))}
            <GoalPlanPanel plans={plans} />
          </Stack>
        ) : (
          <SheetText lines={[t("common.loading")]} />
        )}
      </SheetSection>
    </AnchoredSheet>
  );
}
