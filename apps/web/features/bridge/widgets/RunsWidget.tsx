"use client";

import { OPERATOR_QUESTION_ACTION } from "@zibby/contracts";
import {
  BoardLine,
  BoardSection,
  BoardText,
  Button,
  HoldButton,
  Progress,
  type ProgressBarTone,
  type StateTone,
  StatusRail,
  StatusRailItem,
  StatusRailNow,
  StatusRailPark,
} from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ConfirmDeleteDialog } from "../../../components/ConfirmDeleteDialog/ConfirmDeleteDialog";
import { useNow } from "../../../hooks/useNow";
import { clockTime, compactAgo, formatDuration } from "../../../utils/time";
import { useApprovalsQuery, useApproveMutation, useRejectMutation } from "../../approvals";
import type { DashboardApproval } from "../../approvals/approval";
import { relativeLabel } from "../../automations/schedule";
import {
  useInvalidateOnTerminalRun,
  useLiveRunsSnapshot,
} from "../../runs/components/TasksDockPanel";
import { type RunActions, useRunActions } from "../../runs/useRunActions";
import { useRecentArchivedRunsQuery } from "../../runs/queries/useRecentArchivedRunsQuery";
import {
  type RunView,
  WAITING_STATES,
  approvalForParkedRun,
  approvalForRun,
  isCancellableRun,
  isPausableRun,
  isStoppableRun,
} from "../../runs/run";
import { useWorkflowsQuery } from "../../workflows";
import { PRIORITY_WEIGHT } from "../grid/priority";
import { runRows } from "../state/rows";
import type { BridgeWidgetProps } from "./registry";
import { useWidgetReport } from "./useWidgetReport";

const PROGRESS_TONE: Record<string, ProgressBarTone> = {
  working: "run",
  thinking: "accent",
  blocked: "warn",
  error: "bad",
  done: "ok",
  idle: "idle",
};

/** Same hold as the run sheet's approval banner (spec §5, G-270). */
const APPROVAL_HOLD_MS = 1200;

export enum RunsWidgetTestId {
  Progress = "runs-widget-progress",
  Meta = "runs-widget-meta",
  /** A still-waiting (queued / scheduled / held) row's state label. */
  Queued = "runs-widget-queued",
  /** Inline actions of a parked / waiting-for-you block — suffixed `-<row key>`. */
  Detail = "runs-widget-detail",
  Approve = "runs-widget-approve",
  Reject = "runs-widget-reject",
  /** Hover controls of a running card — suffixed `-<row key>`. */
  Pause = "runs-widget-pause",
  Resume = "runs-widget-resume",
  Stop = "runs-widget-stop",
}

const FINISHED_LIMIT = 10;

/**
 * todo-16 — the live feed and the archive are separate queries fetched at different moments,
 * so a run that just changed state can sit in both (e.g. live "waiting for you", archive "done").
 * Show it once, from the fresher snapshot (`dataUpdatedAt`); the archive wins a tie. A gate stamp
 * written after `done` makes the run live again — a fresher live feed keeps it over a stale archive.
 */
export function dedupeRuns(
  live: RunView[],
  liveAt: number,
  archived: RunView[],
  archivedAt: number,
): { live: RunView[]; archived: RunView[] } {
  const inArchive = new Set(archived.map((r) => r.runId));
  const inLive = new Set(live.map((r) => r.runId));
  // A parked run sits in both feeds (the archive lists `parked` as history), but it still waits
  // on the operator and holds a run slot — the live feed is authoritative, never the archive.
  const livePark = (r: RunView) => r.status === "parked";
  return archivedAt >= liveAt
    ? {
        live: live.filter((r) => livePark(r) || !inArchive.has(r.runId)),
        archived: archived.filter((r) => !(livePark(r) && inLive.has(r.runId))),
      }
    : { live, archived: archived.filter((r) => !inLive.has(r.runId)) };
}

/**
 * Runs — status rail species. "Now" box: the started live runs (pulsing dot, progress bar with
 * `NN% · elapsed` while running), or one idle line with "next in …" (the soonest scheduled run).
 * "Parked": runs waiting for the operator (approval, question, parked) as amber blocks with the
 * gate's ask and its actions inline (hold to approve / reject for an approval, Detail always).
 * Clicking a parked block with an approval opens the approval detail; Detail opens the run sheet.
 * "Queued": runs waiting to start (queued / scheduled / held — they open the same run sheet, just with nothing running yet).
 * "Finished": the last 10. Every other row opens the run sheet. Sections collapse locally.
 */
export function RunsWidget({
  widget,
  onEmptyChange,
  onCountChange,
  selection,
  onOpen,
}: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.runs");
  const tRuns = useTranslations("runs");
  const tk = useTranslations();
  const locale = useLocale();
  const now = useNow(60_000);
  const liveSnapshot = useLiveRunsSnapshot();
  useInvalidateOnTerminalRun(FINISHED_LIMIT);
  const archivedQuery = useRecentArchivedRunsQuery(FINISHED_LIMIT);
  const { data: approvals } = useApprovalsQuery();
  const { isPending } = archivedQuery;
  const { live, archived } = useMemo(
    () =>
      dedupeRuns(
        liveSnapshot.runs,
        liveSnapshot.updatedAt,
        archivedQuery.data ?? [],
        archivedQuery.dataUpdatedAt,
      ),
    [liveSnapshot.runs, liveSnapshot.updatedAt, archivedQuery.data, archivedQuery.dataUpdatedAt],
  );
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  // Pause / resume / stop straight from a running card (no selection to move: callbacks no-op).
  const runActions = useRunActions(noop, noop);
  // The Stop confirm is rendered by the widget, not by the (hover-only) card controls.
  const [stopTarget, setStopTarget] = useState<RunView | null>(null);

  const { data: workflows } = useWorkflowsQuery();
  const phasesByWorkflow = useMemo(
    () =>
      new Map(
        (workflows ?? []).map((w) => [
          w.id,
          w.phases.map((p) => p.id).filter((id): id is string => !!id),
        ]),
      ),
    [workflows],
  );
  const { active, parked } = useMemo(() => {
    const started = live.filter((r) => !WAITING_STATES.has(r.status));
    const rows = runRows(widget.id, started, phasesByWorkflow).map((r, i) => ({
      ...r,
      approval:
        approvalForRun(approvals ?? [], started[i] as RunView) ??
        approvalForParkedRun(approvals ?? [], started[i] as RunView),
      parkedDetail: started[i]?.status === "parked" ? started[i]?.parked : undefined,
    }));
    return {
      active: rows.filter((r) => r.tone !== "blocked"),
      parked: rows.filter((r) => r.tone === "blocked"),
    };
  }, [widget.id, live, phasesByWorkflow, approvals]);
  const queued = useMemo(() => {
    const waiting = live.filter((r) => WAITING_STATES.has(r.status));
    return runRows(widget.id, waiting).map((r) => ({
      ...r,
      when:
        r.status === "scheduled" ? clockTime(r.startedAt, locale) : compactAgo(r.startedAt, now),
    }));
  }, [widget.id, live, locale, now]);
  const finished = useMemo(() => {
    const runs = archived.slice(0, FINISHED_LIMIT);
    const rows = runRows(widget.id, runs);
    return rows.map((r, i) => {
      const run = runs[i];
      return {
        ...r,
        status: run?.status ?? "done",
        age: compactAgo(run?.taskOutcomeFinishedAt ?? run?.startedAt ?? "", now),
      };
    });
  }, [widget.id, archived, now]);
  // "Next in …" on the idle Now line: the soonest scheduled start still ahead.
  const nextAt = Math.min(
    ...queued
      .filter((r) => r.status === "scheduled")
      .map((r) => Date.parse(r.startedAt))
      .filter((at) => at > now),
  );

  const total = active.length + parked.length + queued.length + finished.length;
  useWidgetReport(
    {
      loading: isPending,
      count: isPending ? undefined : total,
      // Parked / waiting-for-you runs are the operator's (amber pill), not urgency on top.
      you: parked.length,
      urgency:
        PRIORITY_WEIGHT.error * [...active, ...finished].filter((r) => r.tone === "error").length,
    },
    { onEmptyChange, onCountChange },
  );

  if (total === 0) return null;

  const open = (r: { runId: string; key: string }) => () =>
    onOpen({
      kind: "run",
      id: r.runId,
      widgetId: widget.id,
      key: r.key,
      href: `/activity/runs/${r.runId}`,
    });
  // A run waiting on an approval opens the approval in the bridge sheet; Detail opens the run.
  // The key is the row's own: the sheet anchors to `[data-rk="<key>"]` and renders nothing without it.
  const openApproval = (id: string, rowKey: string) => () =>
    onOpen({ kind: "approval", id, widgetId: widget.id, key: rowKey });
  const section = (group: string, label: string, count: number, accent = false) => (
    <BoardSection
      closed={!!closed[group]}
      count={String(count).padStart(2, "0")}
      label={label}
      onToggle={() => setClosed((c) => ({ ...c, [group]: !c[group] }))}
      tone={accent ? "accent" : "default"}
    />
  );
  const stateLabel = (tone: StateTone) => t(`state.${tone}`);

  return (
    <>
      {stopTarget && (
        <ConfirmDeleteDialog
          body={tRuns("stopBody")}
          cancelLabel={tk("common.cancel")}
          confirmLabel={tRuns("stop")}
          icon="stop"
          onCancel={() => setStopTarget(null)}
          onConfirm={() => {
            runActions.stop(stopTarget);
            setStopTarget(null);
          }}
          pending={runActions.stopping}
          title={tRuns("stopTitle")}
        />
      )}
      {active.length === 0 ? (
        <StatusRailNow
          aside={
            Number.isFinite(nextAt) ? t("next", { in: relativeLabel(nextAt, now, locale) }) : null
          }
          label={t("nowIdle")}
        />
      ) : (
        <StatusRailNow>
          {active.map((r) => (
            <StatusRailItem
              actions={
                <RunHoverActions
                  actions={runActions}
                  onStop={setStopTarget}
                  rowKey={r.key}
                  run={live.find((x) => x.runId === r.runId)}
                  title={r.title}
                />
              }
              key={r.key}
              onClick={open(r)}
              rowKey={r.key}
              selected={selection?.key === r.key}
              sub={r.step}
              time={r.issue ? `${r.issue} ↗` : r.project}
              title={r.title}
              tone={r.tone}
              toneLabel={stateLabel(r.tone)}
            >
              {r.status === "running" ? (
                <BoardLine direction="col" gap="5">
                  <span data-testid={`${RunsWidgetTestId.Progress}-${r.key}`}>
                    {r.pct === null ? (
                      <Progress indeterminate height="25" label={t("progressLabel")} />
                    ) : (
                      <Progress
                        height="25"
                        label={t("progressLabel")}
                        pulse={r.tone === "working"}
                        tone={PROGRESS_TONE[r.tone] ?? "idle"}
                        value={r.pct}
                      />
                    )}
                  </span>
                  <span data-testid={`${RunsWidgetTestId.Meta}-${r.key}`}>
                    <BoardText tabular kind="rowMeta">
                      {r.pct !== null && `${t("pct", { pct: r.pct })} · `}
                      <RunElapsed startedAt={r.startedAt} />
                    </BoardText>
                  </span>
                </BoardLine>
              ) : (
                <BoardText tabular kind="rowMeta">
                  {r.pct !== null ? t("pct", { pct: r.pct }) : "—"}
                </BoardText>
              )}
            </StatusRailItem>
          ))}
        </StatusRailNow>
      )}
      {parked.length > 0 && section("parked", t("group.parked"), parked.length, true)}
      {!closed["parked"] &&
        parked.map((r) => (
          <StatusRailPark
            actions={
              <ParkActions
                approval={r.approval}
                onDetail={open(r)}
                rowKey={r.key}
                title={r.title}
              />
            }
            key={r.key}
            // A run waiting on an approval opens the approval; its run sheet is the Detail button.
            onClick={r.approval ? openApproval(r.approval.id, r.key) : open(r)}
            rowKey={r.key}
            selected={selection?.key === r.key}
            sub={r.step}
            time={compactAgo(r.startedAt, now)}
            title={r.title}
            toneLabel={tRuns(`state.${r.status}`)}
            why={
              r.approval
                ? (r.approval.summary ?? r.approval.consequence ?? r.approval.text)
                : r.status === "parked"
                  ? r.parkedDetail
                    ? t("parkedWhy", {
                        phase: r.parkedDetail.phaseId,
                        attempts: r.parkedDetail.attempts,
                      })
                    : tRuns("detail.banner.parkedHint")
                  : undefined
            }
          />
        ))}
      {queued.length > 0 && section("queued", t("group.queued"), queued.length)}
      {!closed["queued"] && queued.length > 0 && (
        <StatusRail>
          {queued.map((r) => (
            <StatusRailItem
              key={r.key}
              onClick={open(r)}
              rowKey={r.key}
              selected={selection?.key === r.key}
              sub={
                <>
                  <span data-testid={`${RunsWidgetTestId.Queued}-${r.key}`}>
                    {tRuns(`state.${r.status}`)}
                  </span>
                  {` · ${r.step}`}
                </>
              }
              time={r.when}
              title={r.title}
              tone={r.tone}
              toneLabel={tRuns(`state.${r.status}`)}
            />
          ))}
        </StatusRail>
      )}
      {finished.length > 0 && section("finished", t("group.finished"), finished.length)}
      {!closed["finished"] && finished.length > 0 && (
        <StatusRail>
          {finished.map((r) => (
            <StatusRailItem
              dim
              key={r.key}
              onClick={open(r)}
              rowKey={r.key}
              selected={selection?.key === r.key}
              sub={r.issue ? `${r.step} · ${r.issue}` : r.step}
              time={r.age}
              title={r.title}
              tone={r.tone}
              toneLabel={stateLabel(r.tone)}
            />
          ))}
        </StatusRail>
      )}
    </>
  );
}

const noop = () => undefined;

/**
 * A running card's hover / focus controls (they replace the project on the right): Pause for a
 * workflow, Resume while its pause is pending, Stop behind the same confirm as the run detail.
 */
function RunHoverActions({
  actions,
  run,
  rowKey,
  title,
  onStop,
}: {
  actions: RunActions;
  run: RunView | undefined;
  rowKey: string;
  title: string;
  /** Asks the widget to confirm stopping `run` (the dialog lives outside the hover slot). */
  onStop: (run: RunView) => void;
}) {
  const t = useTranslations("runs.detail.action");
  if (!run) return null;
  const pending = run.status === "running" && run.pauseRequested === true;
  const named = (label: string) => `${label}: ${title}`;
  return (
    <>
      {isPausableRun(run) && (
        <Button
          aria-label={named(t("pause"))}
          data-testid={`${RunsWidgetTestId.Pause}-${rowKey}`}
          disabled={actions.pausing}
          icon="pause"
          intent="ghost"
          onClick={() => actions.pause(run)}
          size="sm"
          title={t("pause")}
        />
      )}
      {pending && (
        <Button
          aria-label={named(t("resume"))}
          data-testid={`${RunsWidgetTestId.Resume}-${rowKey}`}
          disabled={actions.resuming}
          icon="play"
          intent="ghost"
          onClick={() => actions.resume(run)}
          size="sm"
          title={t("resume")}
        />
      )}
      {(isStoppableRun(run) || isCancellableRun(run)) && (
        <Button
          aria-label={named(t("stop"))}
          data-testid={`${RunsWidgetTestId.Stop}-${rowKey}`}
          icon="stop"
          intent="ghost"
          onClick={() => onStop(run)}
          size="sm"
          title={t("stop")}
        />
      )}
    </>
  );
}

/** A parked block's inline actions: hold to approve + reject for an approval gate, Detail always. */
function ParkActions({
  approval,
  rowKey,
  title,
  onDetail,
}: {
  approval: DashboardApproval | undefined;
  rowKey: string;
  title: string;
  onDetail: () => void;
}) {
  const t = useTranslations("runs.detail");
  const tApprovals = useTranslations("approvals");
  const tk = useTranslations();
  const approve = useApproveMutation();
  const reject = useRejectMutation();
  const [confirmReject, setConfirmReject] = useState(false);
  const gate = approval && approval.action !== OPERATOR_QUESTION_ACTION ? approval : undefined;
  return (
    <>
      {gate && (
        <HoldButton
          armedLabel={tApprovals("holdArmed")}
          data-testid={`${RunsWidgetTestId.Approve}-${rowKey}`}
          disabled={approve.isPending}
          doneLabel={tApprovals("holdDone")}
          durationMs={APPROVAL_HOLD_MS}
          label={t("banner.hold")}
          onConfirm={() => approve.mutate({ params: { id: gate.id }, body: {} })}
          size="sm"
        />
      )}
      {gate && (
        <Button
          data-testid={`${RunsWidgetTestId.Reject}-${rowKey}`}
          intent="secondary"
          onClick={() => setConfirmReject(true)}
          size="sm"
        >
          {t("banner.reject")}
        </Button>
      )}
      <Button
        data-testid={`${RunsWidgetTestId.Detail}-${rowKey}`}
        intent="ghost"
        onClick={onDetail}
        size="sm"
      >
        {tk("bridge.widgets.runs.detail")}
      </Button>
      {gate && confirmReject && (
        <ConfirmDeleteDialog
          body={t("confirm.rejectBody", {
            action: title.charAt(0).toLowerCase() + title.slice(1),
          })}
          cancelLabel={tk("common.cancel")}
          confirmLabel={t("banner.reject")}
          icon="x"
          onCancel={() => setConfirmReject(false)}
          onConfirm={() => {
            setConfirmReject(false);
            reject.mutate({ params: { id: gate.id }, body: {} });
          }}
          pending={reject.isPending}
          title={t("confirm.rejectTitle")}
        />
      )}
    </>
  );
}

/** How long a running run has been going ("3m 12s"), ticking every second in its own leaf. */
export function RunElapsed({ startedAt }: { startedAt: string }) {
  const now = useNow(1_000);
  const start = Date.parse(startedAt);
  return Number.isNaN(start) ? "—" : formatDuration(now - start);
}
