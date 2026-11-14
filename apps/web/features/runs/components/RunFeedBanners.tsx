"use client";

import type { Diffstat } from "@zibby/contracts";
import {
  Button,
  Card,
  Container,
  DiffstatList,
  Divider,
  HoldButton,
  IconTile,
  Panel,
  Pressable,
  Stack,
  StatusDot,
  TextAreaField,
  TextInputField,
  Typography,
} from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDeleteDialog } from "../../../components/ConfirmDeleteDialog/ConfirmDeleteDialog";
import { resumeEta } from "../../../utils/time";
import {
  useAnswerApprovalMutation,
  useApproveMutation,
  useRejectMutation,
  useReviseMutation,
} from "../../approvals";
import { type DashboardApproval, RISK_META } from "../../approvals/approval";
import type { RunView } from "../run";
import type { StageRailRow } from "../runDetailModel";
import type { RunArtifact } from "../useRunArtifacts";

export enum RunFeedBannersTestId {
  Approval = "run-banner-approval",
  Question = "run-banner-question",
  Parked = "run-banner-parked",
  Error = "run-banner-error",
  Hold = "run-banner-hold",
  Revise = "run-banner-revise",
  ReviseNote = "run-banner-revise-note",
  ReviseSend = "run-banner-revise-send",
  Reject = "run-banner-reject",
  Diff = "run-banner-diff",
  Title = "run-banner-title",
  Output = "run-banner-output",
  Answer = "run-banner-answer",
  AnswerSend = "run-banner-answer-send",
  Rerun = "run-banner-rerun",
}

/** Spec §5: the approval hold takes 1.2 s (G-270, per use — the DS default stays 0.9 s). */
const APPROVAL_HOLD_MS = 1200;

/** What the approval asks for, as one line of plain text (agent content is data, never markup). */
function approvalTitle(approval: DashboardApproval): string {
  return approval.summary ?? approval.action;
}

export interface RunApprovalBannerProps {
  approval: DashboardApproval;
  diffstat?: Diffstat;
  reviseOpen: boolean;
  onToggleRevise: () => void;
  onApproved?: () => void;
  /** Opens the full approval detail sheet — given, the whole card is its click target. */
  onOpenDetail?: () => void;
  /** What the gated work produced (PR, phase file, run folder) — the card's "open output" button. */
  output?: RunArtifact;
}

/** NEEDS YOU — hold to approve, revise (stage approvals only) or reject; the run's pending diffstat underneath. */
export function RunApprovalBanner({
  approval,
  diffstat,
  reviseOpen,
  onToggleRevise,
  onApproved,
  onOpenDetail,
  output,
}: RunApprovalBannerProps) {
  const t = useTranslations("runs.detail");
  const tApprovals = useTranslations("approvals");
  const tk = useTranslations();
  const tArtifacts = useTranslations("runs.artifacts");
  const locale = useLocale();
  const approve = useApproveMutation();
  const reject = useRejectMutation();
  const revise = useReviseMutation();
  const [confirmReject, setConfirmReject] = useState(false);
  const [note, setNote] = useState("");
  const closeRevise = () => {
    setNote("");
    onToggleRevise();
  };

  const title = approvalTitle(approval);
  const risk = approval.riskType ? RISK_META[approval.riskType].label : approval.action;
  const consequence = approval.consequence ?? approval.text;
  const at = new Date(approval.requestedAt).toLocaleTimeString(locale);

  return (
    <Card
      data-testid={RunFeedBannersTestId.Approval}
      edge="blocked"
      edgeSize="lg"
      interactive={Boolean(onOpenDetail)}
      onClick={onOpenDetail}
    >
      <Container padding={["150", "200"]}>
        <Stack direction="row" gap="250">
          <Container grow minW0>
            <Stack gap="100">
              <Stack align="center" direction="row" gap="100">
                <StatusDot tone="blocked" />
                <Typography as="span" type="labelSm" variant="primary">
                  {t("banner.approvalHead", {
                    sev: approval.risk,
                    risk: risk,
                  })}
                </Typography>
              </Stack>
              {onOpenDetail ? (
                <Pressable
                  data-testid={RunFeedBannersTestId.Title}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail();
                  }}
                >
                  <Typography type="title">{title}</Typography>
                </Pressable>
              ) : (
                <Typography type="title">{title}</Typography>
              )}
              {consequence && (
                <Typography type="bodySm" variant="secondary">
                  {consequence}
                </Typography>
              )}
              <Typography as="span" type="labelSm">
                {t("banner.approvalMeta", {
                  at,
                  via: approval.via ?? approval.skill,
                })}
              </Typography>
            </Stack>
          </Container>
          {/* Its own click zone — the buttons and the (portalled) reject dialog never open the detail. */}
          <Container
            cursor="auto"
            onClick={(e) => e.stopPropagation()}
            shrink={false}
            width="280px"
          >
            <Stack gap="75" justify="center">
              <HoldButton
                block
                armedLabel={tApprovals("holdArmed")}
                data-testid={RunFeedBannersTestId.Hold}
                disabled={approve.isPending}
                doneLabel={tApprovals("holdDone")}
                durationMs={APPROVAL_HOLD_MS}
                label={t("banner.hold")}
                onConfirm={() =>
                  approve.mutate(
                    { params: { id: approval.id }, body: {} },
                    { onSuccess: onApproved },
                  )
                }
              />
              <Stack direction="row" gap="75">
                {output && (
                  <Button
                    block
                    data-testid={RunFeedBannersTestId.Output}
                    intent="ghost"
                    onClick={() =>
                      output.kind === "pr"
                        ? window.open(output.href, "_blank", "noopener,noreferrer")
                        : output.open()
                    }
                    size="sm"
                  >
                    {output.kind === "pr"
                      ? tArtifacts("openPr")
                      : output.kind === "folder"
                        ? tArtifacts("openFolder")
                        : tArtifacts("openFile", { name: output.label })}
                  </Button>
                )}
                {approval.action === "stage-approval" && (
                  <Button
                    block
                    aria-pressed={reviseOpen}
                    data-testid={RunFeedBannersTestId.Revise}
                    intent="secondary"
                    onClick={onToggleRevise}
                    size="sm"
                  >
                    {t("banner.revise")}
                  </Button>
                )}
                <Button
                  block
                  data-testid={RunFeedBannersTestId.Reject}
                  intent="danger"
                  onClick={() => setConfirmReject(true)}
                  size="sm"
                >
                  {t("banner.reject")}
                </Button>
              </Stack>
            </Stack>
            {confirmReject && (
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
                  reject.mutate({ params: { id: approval.id }, body: {} });
                }}
                pending={reject.isPending}
                title={t("confirm.rejectTitle")}
              />
            )}
          </Container>
        </Stack>
      </Container>
      {reviseOpen && (
        <Container
          cursor="auto"
          onClick={(e) => e.stopPropagation()}
          padding={["0", "200", "150", "200"]}
        >
          <Stack gap="100">
            <TextAreaField
              autoFocus
              data-testid={RunFeedBannersTestId.ReviseNote}
              hint={tApprovals("reviseHint")}
              label={tApprovals("reviseLabel")}
              onChange={(e) => setNote(e.target.value)}
              value={note}
            />
            <Stack direction="row" gap="100" justify="end">
              <Button intent="secondary" onClick={closeRevise} size="sm">
                {tk("common.cancel")}
              </Button>
              <Button
                data-testid={RunFeedBannersTestId.ReviseSend}
                disabled={!note.trim()}
                intent="primary"
                loading={revise.isPending}
                onClick={() =>
                  revise.mutate(
                    { params: { id: approval.id }, body: { note: note.trim() } },
                    { onSuccess: closeRevise },
                  )
                }
                size="sm"
              >
                {tApprovals("confirmRevise")}
              </Button>
            </Stack>
          </Stack>
        </Container>
      )}
      {diffstat && diffstat.files.length > 0 && (
        <>
          <Divider />
          <Container data-testid={RunFeedBannersTestId.Diff} padding={["100", "200"]}>
            <Stack gap="50">
              <Typography as="span" type="labelSm">
                {t("banner.wouldPublish", {
                  files: String(diffstat.files.length).padStart(2, "0"),
                  add: diffstat.additions,
                  del: diffstat.deletions,
                })}
              </Typography>
              <DiffstatList density="compact" files={diffstat.files} />
            </Stack>
          </Container>
        </>
      )}
    </Card>
  );
}

export interface RunQuestionBannerProps {
  question: string;
  agentName: string;
  /** The question's approval — given, the banner answers it inline. */
  approvalId?: string;
}

/** NEEDS YOU · QUESTION — the agent's question as plain text, answered right in the banner (or the composer). */
export function RunQuestionBanner({ question, agentName, approvalId }: RunQuestionBannerProps) {
  const t = useTranslations("runs.detail.banner");
  const tComposer = useTranslations("runs.detail.composer");
  const answer = useAnswerApprovalMutation();
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const submit = () => {
    if (!approvalId || !trimmed || answer.isPending) return;
    answer.mutate(
      { params: { id: approvalId }, body: { answer: trimmed } },
      { onSuccess: () => setText("") },
    );
  };
  return (
    <Card data-testid={RunFeedBannersTestId.Question} edge="blocked" edgeSize="lg">
      <Container padding={["150", "200"]}>
        <Stack gap="100">
          <Stack align="center" direction="row" gap="100">
            <StatusDot tone="blocked" />
            <Typography as="span" type="labelSm" variant="primary">
              {t("questionHead", { agent: agentName })}
            </Typography>
          </Stack>
          <Typography type="bodyLg">{question}</Typography>
          {approvalId && (
            <Stack align="end" direction="row" gap="75">
              <Container grow minW0>
                <TextInputField
                  hideLabel
                  data-testid={RunFeedBannersTestId.Answer}
                  label={tComposer("inputLabel")}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={tComposer("ph.question", { agent: agentName })}
                  value={text}
                />
              </Container>
              <Button
                data-testid={RunFeedBannersTestId.AnswerSend}
                disabled={!trimmed || answer.isPending}
                intent="primary"
                onClick={submit}
              >
                {tComposer("send.answer")}
              </Button>
            </Stack>
          )}
          <Typography as="span" type="labelSm">
            {t("questionHint")}
          </Typography>
        </Stack>
      </Container>
    </Card>
  );
}

export interface RunErrorBannerProps {
  /** Why it failed, from the task outcome; absent when the run recorded none. */
  reason?: string;
  /** Re-run fresh — the same action as the header's. */
  onRerun?: () => void;
  rerunning?: boolean;
}

/** ERROR — why the run failed (a run that died before any phase has no log to show it) + Re-run. */
export function RunErrorBanner({ reason, onRerun, rerunning }: RunErrorBannerProps) {
  const t = useTranslations("runs.detail.banner");
  const tActions = useTranslations("runs.detail.action");
  return (
    <Card data-testid={RunFeedBannersTestId.Error} edge="error" edgeSize="lg">
      <Container padding={["150", "200"]}>
        <Stack gap="100">
          <Stack align="center" direction="row" gap="100">
            <StatusDot size="75" tone="error" />
            <Typography as="span" type="labelSm" variant="primary">
              {t("errorHead")}
            </Typography>
          </Stack>
          {reason && <Typography type="bodyLg">{reason}</Typography>}
          {onRerun && (
            <Stack direction="row">
              <Button
                data-testid={RunFeedBannersTestId.Rerun}
                intent="primary"
                loading={rerunning}
                onClick={onRerun}
                size="sm"
              >
                {tActions("rerun")}
              </Button>
            </Stack>
          )}
        </Stack>
      </Container>
    </Card>
  );
}

export interface RunParkedBannerProps {
  run: RunView;
  stage?: StageRailRow;
}

/** PARKED · retries exhausted on a stage. The failure text lives in a file the API does not expose, so no error sentence. */
export function RunParkedBanner({ run, stage }: RunParkedBannerProps) {
  const t = useTranslations("runs.detail.banner");
  const attempts = String(run.parked?.attempts ?? stage?.retries ?? 0).padStart(2, "0");
  return (
    <Card data-testid={RunFeedBannersTestId.Parked} edge="blocked" edgeSize="lg">
      <Container padding={["150", "200"]}>
        <Stack gap="75">
          <Stack align="center" direction="row" gap="100">
            <StatusDot size="75" tone="blocked" />
            <Typography as="span" type="labelSm" variant="primary">
              {t("parkedHead", {
                n: stage?.n ?? "—",
                name: stage?.name ?? run.parked?.phaseId ?? "",
                att: `${attempts}/${attempts}`,
              })}
            </Typography>
          </Stack>
          <Typography as="span" type="labelSm">
            {t("parkedHint")}
          </Typography>
        </Stack>
      </Container>
    </Card>
  );
}

/**
 * The "paused on a usage limit" notice — a pause, not a failure (Phase 9). Shows the
 * reset ETA and, when present, how many auto-resume cycles have been spent.
 */
export function LimitPausedPanel({ run, now }: { run: RunView; now?: number }) {
  const t = useTranslations("runs");
  const locale = useLocale();
  // Without a ticking parent clock, the ETA is computed from mount time.
  const [mountedAt] = useState(Date.now);
  return (
    <Panel padding="300" tone="warn">
      <Stack align="start" direction="row" gap="150">
        <IconTile glyph="pause" size="md" />
        <Stack gap="50">
          <Typography type="note" weight="semibold">
            {t("limitPausedTitle")}
          </Typography>
          <Typography leading="snug" size="sm" type="text" variant="secondary">
            {t("limitPausedBody", { eta: resumeEta(run.resumeAt, now ?? mountedAt, locale) })}
          </Typography>
          {run.limitResumeCycles != null && run.limitResumeCycles > 0 && (
            <Typography mono size="2xs" type="note" variant="tertiary">
              {t("limitResumeCycles", { n: run.limitResumeCycles })}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Panel>
  );
}
