"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { type ChatWidget, OPERATOR_QUESTION_ACTION } from "@zibby/contracts";
import { Button, HoldButton, Typography } from "@zibby/design-system";
import { useNow } from "../../../hooks/useNow";
import { compactAgo } from "../../../utils/time";
import { useApprovalsQuery, useApproveMutation, useRejectMutation } from "../../approvals";
import { type DashboardApproval, HIGH_RISK_TYPES } from "../../approvals/approval";
import { useRunsQuery } from "../../runs/queries/useRunsQuery";
import { ChatWidgetFrame, ChatWidgetRow, takeRows, widgetStatus } from "./ChatWidgetFrame";

export enum ApprovalsWidgetCardTestId {
  Root = "approvals-widget-card",
  Approve = "approvals-widget-approve",
  Reject = "approvals-widget-reject",
  Settled = "approvals-widget-settled",
}

export interface ApprovalsWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "approvals" }>;
}

type Outcome = "approved" | "rejected";

/** Same hold as the run sheet's banner / the dashboard Runs widget (spec §5, G-270). */
const APPROVAL_HOLD_MS = 1200;

/** The queue title: the enriched summary / first detail line, else `skill · action`. */
function approvalTitle(a: DashboardApproval): string {
  const line = (a.summary ?? a.text ?? a.detail).split("\n")[0]?.trim();
  return line ? line : `${a.skill} · ${a.action}`;
}

/**
 * `approvals` — pending approvals with inline Approve / Reject. The buttons call the very
 * same mutations the dashboard and the run sheet use (`useApproveMutation` /
 * `useRejectMutation` -> the gated `POST /approvals/:id/approve|reject`), nothing new. A
 * payment / deletion approval keeps its hold-to-confirm guard. A decided row settles in
 * place ("Schváleno" / "Zamítnuto", dimmed, buttons gone) while the queue refetches — it
 * does not vanish under the operator's finger. An operator question has no approve/reject
 * (it needs an answer) — its row only leads to the approval.
 */
export function ApprovalsWidgetCard({ widget }: ApprovalsWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const now = useNow(60_000);
  const query = useApprovalsQuery();
  const runs = useRunsQuery();
  const approve = useApproveMutation();
  const reject = useRejectMutation();
  const [settled, setSettled] = useState<Record<string, { a: DashboardApproval; o: Outcome }>>({});
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(() => {
    const projectOf = new Map(runs.runs.map((r) => [r.runId, r.projectId]));
    const inScope = (a: DashboardApproval) =>
      !widget.projectId || projectOf.get(a.runId) === widget.projectId;
    const pending = (query.data ?? []).filter(inScope);
    const pendingIds = new Set(pending.map((a) => a.id));
    const kept = Object.values(settled)
      .map((s) => s.a)
      .filter((a) => !pendingIds.has(a.id));
    return [...pending, ...kept].sort(
      (a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt),
    );
  }, [query.data, runs.runs, settled, widget.projectId]);

  const { shown, hiddenCount } = takeRows(rows, widget.limit);
  const pendingCount = rows.filter((a) => !settled[a.id]).length;

  const decide = (a: DashboardApproval, outcome: Outcome) => {
    const mutation = outcome === "approved" ? approve : reject;
    setBusy((s) => new Set(s).add(a.id));
    mutation.mutate(
      { params: { id: a.id }, body: {} },
      {
        onSuccess: () => setSettled((s) => ({ ...s, [a.id]: { a, o: outcome } })),
        onSettled: () =>
          setBusy((s) => {
            const next = new Set(s);
            next.delete(a.id);
            return next;
          }),
      },
    );
  };

  return (
    <ChatWidgetFrame
      count={pendingCount}
      emptyText={t("approvals.empty")}
      hiddenCount={hiddenCount}
      onRetry={() => void query.refetch()}
      openHref="/activity/approvals"
      rootTestId={ApprovalsWidgetCardTestId.Root}
      status={widgetStatus({
        isPending: query.isPending,
        isError: query.isError,
        count: rows.length,
      })}
      title={widget.title ?? t("approvals.title")}
    >
      {shown.map((a) => {
        const title = approvalTitle(a);
        const outcome = settled[a.id]?.o;
        const isQuestion = a.action === OPERATOR_QUESTION_ACTION;
        const deciding = busy.has(a.id);
        const highRisk = a.riskType !== undefined && HIGH_RISK_TYPES.has(a.riskType);
        const meta = [a.skill, compactAgo(a.requestedAt, now)].join(" · ");

        let trailing = null;
        if (outcome) {
          trailing = (
            <Typography
              data-testid={`${ApprovalsWidgetCardTestId.Settled}-${a.id}`}
              role="status"
              size="xs"
              type="note"
              variant="secondary"
              weight="medium"
            >
              {t(`approvals.${outcome}`)}
            </Typography>
          );
        } else if (!isQuestion) {
          trailing = (
            <>
              {highRisk ? (
                <HoldButton
                  aria-label={t("approvals.approveAria", { title })}
                  armedLabel={t("approvals.approve")}
                  data-testid={`${ApprovalsWidgetCardTestId.Approve}-${a.id}`}
                  disabled={deciding}
                  doneLabel={t("approvals.approved")}
                  durationMs={APPROVAL_HOLD_MS}
                  label={t("approvals.approve")}
                  onConfirm={() => decide(a, "approved")}
                  size="sm"
                />
              ) : (
                <Button
                  aria-label={t("approvals.approveAria", { title })}
                  data-testid={`${ApprovalsWidgetCardTestId.Approve}-${a.id}`}
                  disabled={deciding}
                  intent="primary"
                  loading={deciding && approve.isPending}
                  onClick={() => decide(a, "approved")}
                  size="sm"
                >
                  {t("approvals.approve")}
                </Button>
              )}
              <Button
                aria-label={t("approvals.rejectAria", { title })}
                data-testid={`${ApprovalsWidgetCardTestId.Reject}-${a.id}`}
                disabled={deciding}
                intent="secondary"
                loading={deciding && reject.isPending}
                onClick={() => decide(a, "rejected")}
                size="sm"
              >
                {t("approvals.reject")}
              </Button>
            </>
          );
        }

        return (
          <ChatWidgetRow
            dim={outcome !== undefined}
            href={`/activity/approvals?approval=${encodeURIComponent(a.id)}`}
            itemKey={a.id}
            key={a.id}
            linkLabel={t("approvals.openAria", { title })}
            meta={meta}
            statusLabel={
              outcome
                ? t(`approvals.${outcome}`)
                : deciding
                  ? t("approvals.deciding")
                  : isQuestion
                    ? t("approvals.question")
                    : t("approvals.pending")
            }
            title={title}
            tone={outcome === "approved" ? "done" : outcome === "rejected" ? "idle" : "wait"}
            trailing={trailing}
          />
        );
      })}
    </ChatWidgetFrame>
  );
}
