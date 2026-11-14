"use client";

import { AnchoredSheet, type StateTone } from "@zibby/design-system";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useApprovalSheetParam } from "../../../approvals/useApprovalSheetParam";
import { useTaskRunQuery } from "../../../runs/queries/useTaskRunQuery";
import { RunDetail, RunHeaderActions } from "../../../runs/components/RunDetail";
import { type FeedStatus, RUN_STATE } from "../../../runs/run";
import { type SheetProps, geometry, selectionFor } from "./sheetTypes";

/** Run state → sheet tone (spec §3): needs me = amber, failed = rose, running = violet, done = emerald, else idle. */
const RUN_TONE: Partial<Record<(typeof RUN_STATE)[FeedStatus]["badge"], StateTone>> = {
  warn: "blocked",
  bad: "error",
  run: "working",
  ok: "done",
};

/**
 * Run detail from `GET /api/tasks/runs/:id`: the very same `RunDetail` the run page renders
 * (approval banner, phases, metrics, LIVE / INPUT / OUTPUT, composer) — one source, so the two
 * never drift; its action buttons sit top-right in the sheet header like every sheet's. The
 * approval card opens the approval detail (where the gated phase's output lives). The run / task
 * pages are one footer click away.
 */
export function RunSheet({ id, anchor, onClose, onOpen, frame }: SheetProps) {
  const t = useTranslations();
  const router = useRouter();
  const approvalSheet = useApprovalSheetParam();
  const { data: run } = useTaskRunQuery(id);
  // An approval detail opened from this sheet closes with it (and when the arrow keys step to another run).
  // `history.replaceState` like the bridge's `?run=` sync — Next mirrors it into `useSearchParams`.
  const openedApproval = useRef<string | null>(null);
  useEffect(
    () => () => {
      const opened = openedApproval.current;
      openedApproval.current = null;
      const params = new URLSearchParams(window.location.search);
      if (!opened || params.get("approval") !== opened) return;
      params.delete("approval");
      const qs = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        qs ? `?${qs}` : window.location.pathname,
      );
    },
    [id],
  );
  const openApproval = (approvalId: string) => {
    openedApproval.current = approvalId;
    approvalSheet.open(approvalId);
  };

  if (!run) return null;

  return (
    <AnchoredSheet
      {...geometry(anchor, frame)}
      actions={<RunHeaderActions part="primary" run={run} />}
      closeLabel={t("bridge.sheet.close")}
      copyId={run.runId}
      expandable={Boolean(frame)}
      expanded={frame?.expanded}
      glyph="run"
      kind={
        run.kind === "workflow"
          ? t("runs.detail.workflow", { name: run.owner })
          : `${t("bridge.sheet.kind.run")} · ${run.kind}`
      }
      moreActions={<RunHeaderActions part="more" run={run} />}
      onClose={onClose}
      onTitleClick={() => router.push(`/activity/runs/${run.runId}` as Route)}
      onToggleExpand={() => frame?.onExpandedChange(!frame.expanded)}
      title={run.title || run.taskTitle || run.runId}
      tones={[
        {
          tone: RUN_TONE[RUN_STATE[run.status].badge] ?? "idle",
          label: t(`runs.state.${run.status}`),
          loud: RUN_STATE[run.status].badge === "warn",
        },
      ]}
    >
      <RunDetail
        embedded
        onOpenApproval={openApproval}
        onOpenIssue={
          onOpen && ((projectId, itemId) => onOpen(selectionFor("issue", `${projectId}/${itemId}`)))
        }
        onOpenPr={onOpen && ((url) => onOpen(selectionFor("pr", url)))}
        run={run}
      />
    </AnchoredSheet>
  );
}
