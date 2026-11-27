"use client";

import {
  type Automation,
  type CreateGoalInput,
  GOAL_PRESETS,
  PROPOSAL_TEXT_MAX,
  type Proposal,
} from "@zibby/contracts";
import {
  BoardLine,
  BoardRow,
  BoardText,
  Button,
  Container,
  DecisionCard,
  HoldButton,
  Stack,
  type SubNavLinkComponent,
  TextAreaField,
  TextLink,
} from "@zibby/design-system";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useNow } from "../../../hooks/useNow";
import { compactAgo } from "../../../utils/time";
import {
  AutomationFormDialog,
  type AutomationFormDialogProps,
} from "../../automations/components/AutomationFormDialog";
import {
  useCreateAutomationMutation,
  useUpdateAutomationMutation,
} from "../../automations/mutations";
import { useAutomationsQuery } from "../../automations/queries";
import { useCreateGoalMutation } from "../../goals/mutations";
import { useGoalsQuery } from "../../goals/queries";
import { useDecideProposalMutation } from "../../proposals/mutations";
import { useProposalsQuery } from "../../proposals/queries";
import { toClientTarget } from "../../tasks/task";
import { useTaskQuery } from "../../tasks/queries";
import type { BridgeWidgetProps } from "./registry";
import { PRIORITY_WEIGHT } from "../grid/priority";
import { useWidgetReport } from "./useWidgetReport";

export enum ProposalsWidgetTestId {
  Row = "proposals-widget-row",
  Source = "proposals-widget-source",
  Kind = "proposals-widget-kind",
  Confidence = "proposals-widget-confidence",
  Expiry = "proposals-widget-expiry",
  Provenance = "proposals-widget-provenance",
  Dismiss = "proposals-widget-dismiss",
  Approve = "proposals-widget-approve",
  Edit = "proposals-widget-edit",
  Editor = "proposals-widget-editor",
  Save = "proposals-widget-save",
  Cancel = "proposals-widget-cancel",
  RowError = "proposals-widget-row-error",
  Empty = "proposals-widget-empty",
  DisabledHint = "proposals-widget-disabled-hint",
  Enable = "proposals-widget-enable",
}

const DAY_MS = 86_400_000;

/**
 * What the approve dialog prefills when no sample task is available: the stored sample, else the
 * first `("…")` quoted group of the proposal text (older proposals), `task created:` stripped.
 */
export const proposalPrompt = (p: Pick<Proposal, "text" | "provenance">): string | undefined =>
  p.provenance.sample ||
  /\("([^"]+)"\)/.exec(p.text)?.[1]?.replace(/^task created:\s*/i, "") ||
  undefined;

/** Whole days until `expiresAt` (rounded up, never negative). */
export const proposalExpiryDays = (expiresAt: string, now: number): number =>
  Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / DAY_MS));

/**
 * The PAUSED goal an accepted `goal` proposal creates: the preset's scope/cadence/ceiling when it
 * names one, otherwise a weekday-morning standing goal. Never enabled — the operator reviews first.
 */
export function proposalGoalBody(
  goal: NonNullable<Proposal["goal"]>,
  takenIds: ReadonlySet<string> = new Set(),
): CreateGoalInput {
  const preset = GOAL_PRESETS.find((p) => p.id === goal.presetId);
  // `group` is UI-only and the create body is strict, so it is dropped here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { group: _group, ...base } = preset ?? {
    id: goal.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60),
    scope: { kind: "none" as const },
    cadence: { every: "weekday" as const, hour: 9 },
    ceiling: "tier2" as const,
    group: "pr-ci" as const,
    name: goal.name,
    outcome: goal.outcome,
    enabled: false,
  };
  // Id collision (the goal already exists): derive a free id instead of failing.
  let id = base.id;
  for (let n = 2; takenIds.has(id); n++) id = `${base.id}-${n}`;
  return {
    ...base,
    id,
    name: goal.name,
    outcome: goal.outcome,
    predicate: goal.predicate,
    enabled: false,
  };
}

type Provenance = { kind: "note" | "agent" | "approval"; href: Route };

/**
 * The one provenance link a row shows: note, then agent, then approval. An agent-factory
 * candidate with an approval links to the approvals page instead — that is where it is decided.
 */
export function proposalProvenance(
  p: Proposal["provenance"],
  source?: Proposal["source"],
): Provenance | null {
  if (source === "agent-factory" && p.approvalId) {
    return { kind: "approval", href: "/activity/approvals" as Route };
  }
  if (p.noteId) {
    return {
      kind: "note",
      href: `/knowledge/vault?note=${encodeURIComponent(p.noteId)}` as Route,
    };
  }
  if (p.agentId) {
    return { kind: "agent", href: `/workforce/agents/${encodeURIComponent(p.agentId)}` as Route };
  }
  if (p.approvalId) return { kind: "approval", href: "/activity/approvals" as Route };
  return null;
}

/**
 * Proposals: suggestions the automations produced (pattern extraction, automation ideas, agent
 * factory) for the operator to review — dismiss, approve an automation idea (opens the create
 * automation dialog prefilled from its sample task), or edit a pattern's wording (agent-factory
 * candidates are edited on the agent page). Collapses to the header when nothing is open.
 */
export function ProposalsWidget({ onEmptyChange, onCountChange }: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.proposals");
  const now = useNow(60_000);
  const query = useProposalsQuery();
  const proposals = useMemo(() => query.data ?? [], [query.data]);
  const loading = query.isPending;
  const failed = query.isError;
  const offProducers = (useAutomationsQuery().data ?? []).filter(
    (a) => PRODUCER_IDS.includes(a.id) && !a.enabled,
  );

  useWidgetReport(
    {
      loading,
      count: loading ? undefined : proposals.length,
      you: 0,
      // Every listed proposal is still open — waiting on the operator's decision.
      urgency: PRIORITY_WEIGHT.proposal * proposals.length,
      failed,
      // Stay open while a producer is off, so its "Zapnout" hint is reachable.
      keepOpen: offProducers.length > 0,
    },
    { onEmptyChange, onCountChange },
  );

  if (failed) return <QueryError onRetry={() => void query.refetch()} />;
  if (!loading && proposals.length === 0) {
    return (
      <>
        <BoardRow shape="list" tone="neutral">
          <span data-testid={ProposalsWidgetTestId.Empty}>
            <BoardText kind="rowMeta">{t("empty")}</BoardText>
          </span>
        </BoardRow>
        <DisabledProducers off={offProducers} />
      </>
    );
  }
  return (
    <>
      {proposals.map((p) => (
        <ProposalRow key={p.id} now={now} proposal={p} />
      ))}
    </>
  );
}

/** System automations that write proposals; both are deterministic (no model call, no token cost). */
const PRODUCER_IDS = ["gap-detect", "nightly-patterns"];

/**
 * Empty-state hint: which proposal producers are switched off, each with a "Zapnout" action —
 * the operator decides, nothing is enabled behind their back.
 */
function DisabledProducers({ off }: { off: readonly Automation[] }) {
  const t = useTranslations("bridge.widgets.proposals");
  const update = useUpdateAutomationMutation();
  if (off.length === 0) return null;
  return (
    <Container data-testid={ProposalsWidgetTestId.DisabledHint}>
      <BoardText kind="rowMeta">
        {t("disabled", { names: off.map((a) => a.name ?? a.id).join(", ") })}
      </BoardText>
      {off.map((a) => (
        <BoardLine wrap gap="6" key={a.id}>
          <BoardText kind="rowMeta">
            {a.name ?? a.id} · {t("noModel")}
          </BoardText>
          <Button
            aria-label={t("enableLabel", { name: a.name ?? a.id })}
            data-testid={ProposalsWidgetTestId.Enable}
            disabled={update.isPending}
            intent="secondary"
            onClick={() => update.mutate({ params: { id: a.id }, body: { enabled: true } })}
            size="sm"
          >
            {t("enable")}
          </Button>
        </BoardLine>
      ))}
    </Container>
  );
}

interface ProposalRowProps {
  proposal: Proposal;
  now: number;
}

function ProposalRow({ proposal, now }: ProposalRowProps) {
  const t = useTranslations("bridge.widgets.proposals");
  const decide = useDecideProposalMutation();
  // Lives on the row, not the dialog: the dialog closes on submit, and a mutate-level
  // `onSuccess` never fires once its component has unmounted.
  const createAutomation = useCreateAutomationMutation();
  const createGoal = useCreateGoalMutation();
  const takenGoalIds = new Set((useGoalsQuery().data ?? []).map((g) => g.id));
  const isGoal = proposal.kind === "goal" && proposal.goal !== undefined;
  const shown = proposal.editedText ?? proposal.text;
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  // Set once the goal exists, so a retry after a failed approve never creates a second one.
  const [goalCreated, setGoalCreated] = useState(false);
  const [draft, setDraft] = useState(shown);
  const provenance = proposalProvenance(proposal.provenance, proposal.source);
  const approvable = proposal.source === "gap-detect";
  const editable = proposal.source === "pattern-extract";
  const dismissable = proposal.source !== "agent-factory";
  const trimmed = draft.trim();

  const dismiss = () => decide.mutate({ params: { id: proposal.id }, body: { action: "dismiss" } });
  const save = () =>
    decide.mutate(
      { params: { id: proposal.id }, body: { action: "edit", text: trimmed } },
      { onSuccess: () => setEditing(false) },
    );
  const cancelEdit = () => {
    decide.reset();
    setEditing(false);
  };
  const startEdit = () => {
    setDraft(shown);
    setEditing(true);
  };

  const actions = (
    <>
      {approvable ? (
        <Button
          aria-label={t(isGoal ? "approveGoalLabel" : "approveLabel", { text: shown })}
          data-testid={ProposalsWidgetTestId.Approve}
          disabled={decide.isPending || createGoal.isPending}
          intent="primary"
          onClick={() => {
            if (!isGoal || !proposal.goal) return setApproving(true);
            const approve = () =>
              decide.mutate({ params: { id: proposal.id }, body: { action: "approve" } });
            if (goalCreated) return approve();
            // Paused goal first, then mark the proposal approved.
            createGoal.mutate(
              { body: proposalGoalBody(proposal.goal, takenGoalIds) },
              {
                onSuccess: () => {
                  setGoalCreated(true);
                  approve();
                },
              },
            );
          }}
          size="sm"
        >
          {isGoal ? t("approveGoal") : t("approve")}
        </Button>
      ) : null}
      {dismissable ? (
        <Button
          aria-label={t("dismissLabel", { text: shown })}
          data-testid={ProposalsWidgetTestId.Dismiss}
          disabled={decide.isPending}
          intent="secondary"
          onClick={dismiss}
          size="sm"
        >
          {t("dismiss")}
        </Button>
      ) : (
        <HoldButton
          aria-label={t("dismissLabel", { text: shown })}
          armedLabel={t("dismissArmed")}
          data-testid={ProposalsWidgetTestId.Dismiss}
          disabled={decide.isPending}
          doneLabel={t("dismissDone")}
          label={t("dismiss")}
          onConfirm={dismiss}
          size="sm"
        />
      )}
      {editable ? (
        <Button
          aria-label={t("editLabel", { text: shown })}
          data-testid={ProposalsWidgetTestId.Edit}
          intent="ghost"
          onClick={startEdit}
          size="sm"
        >
          {t("edit")}
        </Button>
      ) : null}
    </>
  );

  return (
    <div data-testid={ProposalsWidgetTestId.Row}>
      <DecisionCard
        actions={editing ? undefined : actions}
        context={
          <>
            <BoardText data-testid={ProposalsWidgetTestId.Source} kind="rowMeta" tone="ink2">
              {t(`source.${proposal.source}`)}
            </BoardText>
            <BoardText data-testid={ProposalsWidgetTestId.Kind} kind="rowMeta" tone="ink2">
              · {t(`kind.${proposal.kind}`)}
            </BoardText>
            <BoardText kind="rowId">· {compactAgo(proposal.lastSeenAt, now)}</BoardText>
          </>
        }
        title={
          editing ? (
            <Stack gap="100">
              <Stack data-testid={ProposalsWidgetTestId.Editor}>
                <TextAreaField
                  label={t("editor")}
                  maxLength={PROPOSAL_TEXT_MAX}
                  onChange={(e) => setDraft(e.target.value)}
                  value={draft}
                />
              </Stack>
              <Stack align="center" direction="row" gap="100">
                <Button
                  data-testid={ProposalsWidgetTestId.Save}
                  disabled={trimmed === "" || trimmed === shown}
                  intent="secondary"
                  loading={decide.isPending}
                  onClick={save}
                  size="sm"
                >
                  {t("save")}
                </Button>
                <Button
                  data-testid={ProposalsWidgetTestId.Cancel}
                  intent="ghost"
                  onClick={cancelEdit}
                  size="sm"
                >
                  {t("cancel")}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <BoardText kind="cardTitle">{shown}</BoardText>
          )
        }
      >
        {/* The rationale: how often the pattern recurred and how sure the extractor is. */}
        <BoardLine wrap gap="6">
          {proposal.occurrences > 0 ? (
            <BoardText kind="reading">{t("seen", { count: proposal.occurrences })} ·</BoardText>
          ) : null}
          <BoardText data-testid={ProposalsWidgetTestId.Confidence} kind="reading">
            {t(`confidence.${proposal.confidence}`)}
          </BoardText>
        </BoardLine>
        <BoardLine wrap gap="6">
          <BoardText data-testid={ProposalsWidgetTestId.Expiry} kind="rowMeta">
            {t("expires", { days: proposalExpiryDays(proposal.expiresAt, now) })}
          </BoardText>
          {provenance ? (
            <TextLink
              data-testid={ProposalsWidgetTestId.Provenance}
              href={provenance.href}
              linkComponent={Link as SubNavLinkComponent}
            >
              <BoardText underline kind="rowMeta" tone="ink2">
                {t(`provenance.${provenance.kind}`)}
              </BoardText>
            </TextLink>
          ) : null}
        </BoardLine>
        {decide.isError || createAutomation.isError || createGoal.isError ? (
          <span data-testid={ProposalsWidgetTestId.RowError} role="alert">
            <BoardText kind="rowMeta" tone="ink">
              {!createAutomation.isError &&
              !createGoal.isError &&
              decide.variables?.body.action === "edit"
                ? t("error")
                : t("actionError")}
            </BoardText>
          </span>
        ) : null}
      </DecisionCard>
      {approving ? (
        <ApproveProposalDialog
          fallbackText={proposalPrompt(proposal)}
          onClose={() => setApproving(false)}
          onCreate={(body) =>
            createAutomation.mutate(
              { body },
              {
                onSuccess: () =>
                  decide.mutate({ params: { id: proposal.id }, body: { action: "approve" } }),
              },
            )
          }
          taskId={proposal.provenance.taskId}
        />
      ) : null}
    </div>
  );
}

interface ApproveProposalDialogProps {
  /** The proposal's sample task — prefills what to run; absent → an empty dialog. */
  taskId?: string;
  /** Prompt to prefill when the sample task is absent or can't be loaded. */
  fallbackText?: string;
  onClose: () => void;
  onCreate: AutomationFormDialogProps["onCreate"];
}

/** The create-automation dialog, prefilled from the recurring task once it has loaded. */
function ApproveProposalDialog({
  taskId,
  fallbackText,
  onClose,
  onCreate,
}: ApproveProposalDialogProps) {
  const task = useTaskQuery(taskId);
  // Wait for the sample task so CommandLine mounts with its text (it only reads it once);
  // a missing/failed task still opens the dialog, just empty.
  if (taskId && task.isPending) return null;
  const sample = task.data;
  return (
    <AutomationFormDialog
      initialTarget={sample?.target ? toClientTarget(sample.target) : undefined}
      initialText={sample?.text ?? fallbackText}
      onClose={onClose}
      onCreate={onCreate}
    />
  );
}
