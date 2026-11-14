"use client";

import { SheetAction, SheetBanner, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useApproveMutation, useRejectMutation } from "../../../approvals";
import { type DashboardApproval, HIGH_RISK_TYPES, formatWaited } from "../../../approvals/approval";

export enum ApprovalNeedTestId {
  Text = "approval-need-text",
  Diff = "approval-need-diff",
  Rule = "approval-need-rule",
  Approve = "approval-need-approve",
  Deny = "approval-need-deny",
}

/** Mono diff lines of an approval's structured diff preview (`@@` hunk header + `+/-/ ` lines). */
export function approvalDiffLines(a: DashboardApproval): string[] {
  if (a.preview?.kind !== "diff") return [];
  return a.preview.hunks.flatMap((h) => [
    h.h,
    ...h.lines.map(([k, text]) => `${k === "add" ? "+" : k === "del" ? "-" : " "}${text}`),
  ]);
}

/** Payment / deletion approvals need the hold-to-confirm guardrail, which lives on the task page. */
export const isHighRisk = (a: DashboardApproval) =>
  a.riskType !== undefined && HIGH_RISK_TYPES.has(a.riskType);

export interface ApprovalNeedProps {
  approval: DashboardApproval;
}

/**
 * The sheet's amber banner for a pending approval: Approve / Deny wired to the same mutations
 * the approvals queue uses. High-risk kinds (payment / deletion) get Deny only — approving them
 * requires the hold-to-confirm control on the task page, never a single click here.
 */
export function ApprovalNeed({ approval: a }: ApprovalNeedProps) {
  const t = useTranslations();
  const approve = useApproveMutation();
  const reject = useRejectMutation();
  const pending = approve.isPending || reject.isPending;
  const diff = approvalDiffLines(a);
  const text = a.summary ?? a.text ?? a.detail;
  return (
    <SheetBanner
      actions={
        <>
          {isHighRisk(a) ? null : (
            <SheetAction
              data-testid={ApprovalNeedTestId.Approve}
              disabled={pending}
              intent="primary"
              onClick={() => approve.mutate({ params: { id: a.id }, body: {} })}
            >
              {t("bridge.sheet.approve")}
            </SheetAction>
          )}
          <SheetAction
            data-testid={ApprovalNeedTestId.Deny}
            disabled={pending}
            onClick={() => reject.mutate({ params: { id: a.id }, body: {} })}
          >
            {t("bridge.sheet.deny")}
          </SheetAction>
        </>
      }
      icon="shield"
      text={
        <>
          <span data-testid={ApprovalNeedTestId.Text}>{text}</span>
          {isHighRisk(a) ? (
            <span data-testid={ApprovalNeedTestId.Rule}>{` · ${t("bridge.sheet.holdRule")}`}</span>
          ) : null}
          {diff.length > 0 ? (
            <span data-testid={ApprovalNeedTestId.Diff}>
              {diff.map((l, i) => (
                <Typography as="span" key={i} type="code" variant="secondary">
                  <br />
                  {l}
                </Typography>
              ))}
            </span>
          ) : null}
        </>
      }
      title={`${t("bridge.sheet.needsYou", { kind: a.kind })} · ${t("bridge.sheet.waiting", { wait: formatWaited(a.requestedAt) })}`}
      tone="blocked"
    />
  );
}
