"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ChatWidget } from "@zibby/contracts";
import { Button, CodeBlock, Container, HoldButton, Typography } from "@zibby/design-system";
import { useApprovalQuery, useApproveMutation, useRejectMutation } from "../../approvals";
import { HIGH_RISK_TYPES } from "../../approvals/approval";
import { getApprovalQueryKey } from "../../approvals/queries/useApprovalQuery";
import { ChatWidgetFrame, ChatWidgetRow, widgetStatus } from "./ChatWidgetFrame";

export enum ChatApprovalWidgetCardTestId {
  Root = "chat-approval-widget-card",
  Approve = "chat-approval-widget-approve",
  Reject = "chat-approval-widget-reject",
  Settled = "chat-approval-widget-settled",
  HoldHint = "chat-approval-widget-hold-hint",
  Error = "chat-approval-widget-error",
}

export interface ChatApprovalWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "approval" }>;
}

/** Same hold as the other approval surfaces. */
const APPROVAL_HOLD_MS = 1200;

/**
 * `approval` — one inline approval for a held chat tool call. Shows the FULL raw command
 * (the server overwrites `preview.cmd` with it), Approve / Reject through the shared
 * approval mutations, and the decided state afterwards (also after a reload).
 */
export function ChatApprovalWidgetCard({ widget }: ChatApprovalWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const qc = useQueryClient();
  const id = widget.approvalId;
  const query = useApprovalQuery(id);
  const approve = useApproveMutation();
  const reject = useRejectMutation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const a = query.data;

  const decide = (outcome: "approved" | "rejected") => {
    const mutation = outcome === "approved" ? approve : reject;
    setBusy(true);
    setFailed(false);
    mutation.mutate(
      { params: { id }, body: {} },
      {
        onError: () => setFailed(true),
        // Refetch on every outcome: a 409 (already expired or decided) must settle the card too.
        onSettled: () => {
          setBusy(false);
          void qc.invalidateQueries({ queryKey: getApprovalQueryKey(id) });
        },
      },
    );
  };

  const title = widget.title ?? t("approval.title");
  const command = a ? (a.preview?.kind === "command" ? a.preview.cmd : (a.text ?? a.detail)) : "";
  const decided = a !== undefined && a.status !== "pending";
  const outcome = !decided
    ? null
    : a.status === "approved"
      ? "approved"
      : a.reason?.startsWith("Chat turn ended") || a.reason?.startsWith("Expired")
        ? "expired"
        : "rejected";
  const highRisk =
    a?.risk === "high" || (a?.riskType !== undefined && HIGH_RISK_TYPES.has(a.riskType));
  const summary = a?.summary ?? a?.action ?? "";

  return (
    <ChatWidgetFrame
      emptyText={t("approval.empty")}
      onRetry={() => void query.refetch()}
      rootTestId={ChatApprovalWidgetCardTestId.Root}
      status={widgetStatus({
        isPending: query.isPending,
        isError: query.isError,
        count: a ? 1 : 0,
      })}
      title={title}
    >
      {a ? (
        <>
          <ChatWidgetRow
            dim={decided}
            itemKey={id}
            statusLabel={
              outcome
                ? t(`approval.${outcome}`)
                : busy
                  ? t("approval.deciding")
                  : t("approval.pending")
            }
            statusTestId={decided ? ChatApprovalWidgetCardTestId.Settled : undefined}
            title={summary}
            tone={outcome === "approved" ? "done" : outcome ? "idle" : "wait"}
            trailing={
              outcome ? undefined : (
                <>
                  {highRisk ? (
                    <Typography
                      as="span"
                      data-testid={ChatApprovalWidgetCardTestId.HoldHint}
                      size="xs"
                      type="note"
                      variant="tertiary"
                    >
                      {t("approval.holdHint")}
                    </Typography>
                  ) : null}
                  {highRisk ? (
                    <HoldButton
                      aria-label={t("approval.approveAria", { title: summary })}
                      armedLabel={t("approval.approve")}
                      data-testid={ChatApprovalWidgetCardTestId.Approve}
                      disabled={busy}
                      doneLabel={t("approval.approved")}
                      durationMs={APPROVAL_HOLD_MS}
                      label={t("approval.approve")}
                      onConfirm={() => decide("approved")}
                      size="sm"
                    />
                  ) : (
                    <Button
                      aria-label={t("approval.approveAria", { title: summary })}
                      data-testid={ChatApprovalWidgetCardTestId.Approve}
                      disabled={busy}
                      intent="primary"
                      onClick={() => decide("approved")}
                      size="sm"
                    >
                      {t("approval.approve")}
                    </Button>
                  )}
                  <Button
                    aria-label={t("approval.rejectAria", { title: summary })}
                    data-testid={ChatApprovalWidgetCardTestId.Reject}
                    disabled={busy}
                    intent="secondary"
                    onClick={() => decide("rejected")}
                    size="sm"
                  >
                    {t("approval.reject")}
                  </Button>
                </>
              )
            }
          />
          {failed && !decided ? (
            <Container padding={["0", "150", "100", "150"]}>
              <Typography
                as="p"
                data-testid={ChatApprovalWidgetCardTestId.Error}
                role="alert"
                size="xs"
                tone="bad"
                type="note"
              >
                {t("approval.error")}
              </Typography>
            </Container>
          ) : null}
          <Container padding={["0", "150", "100", "150"]}>
            <CodeBlock maxHeight="lg" text={command} />
          </Container>
        </>
      ) : null}
    </ChatWidgetFrame>
  );
}
