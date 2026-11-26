"use client";

import type { GoalInstance, GoalRollupStatus } from "@zibby/contracts";
import {
  AnchoredSheet,
  Button,
  SheetAction,
  SheetBanner,
  SheetBlock,
  SheetSection,
  SheetText,
  Stack,
  type StateTone,
  StatusBadge,
  Typography,
} from "@zibby/design-system";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { QueryError } from "../../../../components/LoadError/QueryError";
import { apiErrorMessage } from "../../../../state/apiErrorMessage";
import { GoalPlanPanel } from "../../../goals/components/GoalPlanPanel";
import { GoalTimelinePanel } from "../../../goals/components/GoalTimelinePanel";
import { nextCycleStart } from "../../../goals/goalCadence";
import { formatGoalDateTime, instanceStatusTone, isGoalNotFound } from "../../../goals/goalView";
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
  NextCycle = "goal-sheet-next-cycle",
  Deadline = "goal-sheet-deadline",
  Instance = "goal-sheet-instance",
  WaitingOn = "goal-sheet-waiting-on",
  WakeAt = "goal-sheet-wake-at",
  Resume = "goal-sheet-resume",
  Error = "goal-sheet-error",
}

const SHEET_TONE: Record<GoalRollupStatus, StateTone> = {
  "needs-you": "blocked",
  acting: "working",
  planning: "thinking",
  waiting: "idle",
  done: "done",
  paused: "idle",
};

/**
 * Goal detail (Bridge "Goals" widget): the full log of what was done ("Co se dělo", the goal page's
 * timeline panel) and what comes next ("Co bude": per instance what it waits on and when it wakes,
 * the next cycle / the deadline, and the plan note). Wake and enable/pause top-right; the title
 * opens the goal page.
 */
export function GoalSheet({ id, anchor, onClose, frame }: SheetProps) {
  const t = useTranslations();
  const g = useTranslations("bridge.widgets.goals");
  const ts = useTranslations("goals");
  const locale = useLocale();
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
  const label = (key: string) => (key === "_" ? ts("instances.noProject") : names.projectName(key));
  const plans = instances.flatMap(([key, i]) =>
    i.planNoteId ? [{ noteId: i.planNoteId, label: label(key) }] : [],
  );
  // From now (or the cycle start if that is later), so a boundary the engine has not ticked yet
  // never shows as a "next cycle" in the past.
  const nextCycle =
    goal.cadence && goal.enabled && !stateFailed && !stateQuery.isPending
      ? nextCycleStart(
          goal.cadence,
          new Date(Math.max(now, state ? Date.parse(state.cycle.startedAt) : 0)),
        )
      : null;
  const deadline = state?.cycle.deadlineAt ?? goal.deadline;
  const when = (iso: string) => formatGoalDateTime(iso, locale);

  const renderInstance = (key: string, i: GoalInstance) => (
    <Stack data-testid={`${GoalSheetTestId.Instance}-${key}`} gap="50" key={key}>
      <Stack align="center" direction="row" gap="100">
        <Typography size="caption" type="label" weight="semibold">
          {label(key)}
        </Typography>
        <StatusBadge tone={instanceStatusTone(i.status)}>
          {ts(`instances.state.${i.status}`)}
        </StatusBadge>
      </Stack>
      {i.parkedReason && (
        <Typography size="caption" type="note" variant="secondary">
          {ts(`instances.parked.${i.parkedReason}`)}
        </Typography>
      )}
      {i.summary && <SheetText lines={[i.summary]} />}
      {i.waitingOn?.map((w) => (
        <div data-testid={`${GoalSheetTestId.WaitingOn}-${key}`} key={`${w.kind}:${w.ref}`}>
          <SheetText lines={[g("waitingOn", { kind: g(`waiting.${w.kind}`), ref: w.ref })]} />
        </div>
      ))}
      {i.wakeAt && (
        <div data-testid={`${GoalSheetTestId.WakeAt}-${key}`}>
          <SheetText lines={[g("wakesAt", { when: when(i.wakeAt) })]} />
        </div>
      )}
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
      tones={
        rollup ? [{ tone: SHEET_TONE[rollup.status], label: ts(`status.${rollup.status}`) }] : []
      }
    >
      <SheetSection>
        <SheetBlock label={g("whatHappened")}>
          <div data-testid={GoalSheetTestId.Log}>
            <GoalTimelinePanel
              goalId={id}
              instances={instances.map(([key]) => key)}
              names={names}
              standing={goal.cadence !== undefined}
            />
          </div>
        </SheetBlock>
        <SheetBlock label={g("whatNext")}>
          {stateFailed ? (
            <div data-testid={GoalSheetTestId.StateError}>
              <QueryError onRetry={() => void stateQuery.refetch()} />
            </div>
          ) : (
            <Stack data-testid={GoalSheetTestId.Next} gap="150">
              {nextCycle && (
                <div data-testid={GoalSheetTestId.NextCycle}>
                  <SheetText lines={[g("nextCycle", { when: when(nextCycle.toISOString()) })]} />
                </div>
              )}
              {deadline && (
                <div data-testid={GoalSheetTestId.Deadline}>
                  <SheetText lines={[g("deadline", { when: when(deadline) })]} />
                </div>
              )}
              {stateQuery.isPending ? (
                <SheetText lines={[t("common.loading")]} />
              ) : instances.length === 0 ? (
                <SheetText lines={[g("nothingYet")]} />
              ) : (
                instances.map(([key, i]) => renderInstance(key, i))
              )}
              <GoalPlanPanel plans={plans} />
            </Stack>
          )}
        </SheetBlock>
      </SheetSection>
    </AnchoredSheet>
  );
}
