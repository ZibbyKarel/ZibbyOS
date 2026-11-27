"use client";

import {
  AgentBadge,
  Card,
  Container,
  CopyableText,
  Dropdown,
  Grid,
  Icon,
  type IconName,
  MetricStrip,
  type MetricStripColumns,
  Pressable,
  Progress,
  SegmentedRing,
  Stack,
  StatePill,
  type StateTone,
  Typography,
} from "@zibby/design-system";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { useAgentSymbol } from "../../agents";
import { useDepartmentLookup } from "../../departments/useDepartmentLookup";
import { prListHref } from "../../inbox/inbox";
import { GOAL_CARD_STATE } from "../../goals/goalView";
import { useGoalsQuery } from "../../goals/queries";
import { useProjectsQuery } from "../../projects";
import { useAssignRunProjectMutation } from "../mutations";
import { formatEngine } from "../../../utils/engine";
import { type RunView, runTitle } from "../run";
import { MODE_TONE, type RunMetric, type RunMode } from "../runDetailModel";

export enum RunDetailHeaderTestId {
  Root = "run-detail-header",
  Back = "run-detail-back",
  TaskLink = "run-detail-task-link",
  Title = "run-detail-title",
  Engine = "run-detail-engine",
  State = "run-detail-state",
  AgentLink = "run-detail-agent-link",
  ProjectLink = "run-detail-project-link",
  GoalLink = "run-detail-goal-link",
  SourcePrLink = "run-detail-source-pr-link",
  SourceIssueLink = "run-detail-source-issue-link",
  OutputPrLink = "run-detail-output-pr-link",
  AssignProject = "run-detail-assign-project",
  Progress = "run-detail-progress",
  Metrics = "run-detail-metrics",
  About = "run-detail-about",
  Summary = "run-detail-summary",
}

export interface RunDetailHeaderProps {
  run: RunView;
  /** The info message under the Summary (what the run left behind). */
  artifactInfo?: ReactNode;
  mode: RunMode;
  metrics: RunMetric[];
  progressPct: number;
  agent?: { id: string; name: string; role?: string; state: StateTone };
  /** The `RunDetailActions` slot, right of the title block. */
  actions: ReactNode;
  /** Inside a detail sheet: the sheet header already carries breadcrumb and title, metrics fold to 3 columns, no progress hairline. */
  compact?: boolean;
  /** The run's one banner (`pickRunBanner`), right under the title / state line. */
  banner?: ReactNode;
  /** Open a PR in place (bridge sheet) instead of navigating to the PR list. */
  onOpenPr?: (url: string) => void;
  /** Open the source issue in place (bridge sheet) instead of navigating to its page. */
  onOpenIssue?: (projectId: string, itemId: string) => void;
}

function Sep() {
  return (
    <Typography as="span" type="labelSm">
      ·
    </Typography>
  );
}

/** GitLab merge requests live on a `gitlab` host or under `/-/merge_requests/`; everything else is GitHub. */
function prIcon(url: string): IconName {
  return /gitlab|\/-\/merge_requests\//i.test(url) ? "gitlab" : "github";
}

/** The run carries no issue source kind — a Jira-shaped key (`CZ-524`) gets the Jira mark. */
function issueIcon(label: string): IconName {
  return /^[A-Z][A-Z0-9]*-\d+$/.test(label) ? "jira" : "checkpoint";
}

/** A header link's label: optional leading icon + mono text. */
function LinkLabel({ icon, text }: { icon?: IconName; text: string }) {
  return (
    <Stack inline align="center" direction="row" gap="50">
      {icon && <Icon name={icon} size="xs" />}
      <Typography as="span" type="code">
        {text}
      </Typography>
    </Stack>
  );
}

/** "What this is about": a card per linked entity (source issue / PR, resulting PR) — opens it. */
function AboutCard({
  label,
  icon,
  text,
  aside,
  leading,
  ...rest
}: {
  label: string;
  icon: IconName;
  /** Replaces the icon (the goal's progress ring). */
  leading?: ReactNode;
  text: string;
  aside?: string;
  "aria-label": string;
  "data-testid": string;
  onClick: () => void;
}) {
  return (
    <Card interactive as="button" {...rest}>
      <Container as="span" padding={["100", "150"]}>
        <Stack align="center" as="span" direction="row" gap="100">
          {leading ?? <Icon name={icon} size="sm" />}
          <Stack grow as="span" gap="25">
            <Typography as="span" type="labelSm">
              {label}
            </Typography>
            <Typography as="span" type="code">
              {text}
            </Typography>
          </Stack>
          {aside && (
            <Typography mono as="span" size="xs" type="note" variant="secondary">
              {aside}
            </Typography>
          )}
        </Stack>
      </Container>
    </Card>
  );
}

/** The goal this run works for: its name (opens the goal) beside the goal's progress ring (done of total projects). */
function GoalAbout({ goalId }: { goalId: string }) {
  const t = useTranslations("runs");
  const tGoals = useTranslations("goals");
  const router = useRouter();
  const goal = useGoalsQuery().data?.find((g) => g.id === goalId);
  const name = goal?.name ?? goalId;
  const counts = goal?.rollup.counts;
  const ran = !!counts && counts.total > 0;
  return (
    <AboutCard
      aria-label={t("detail.goalLink", { name })}
      data-testid={RunDetailHeaderTestId.GoalLink}
      icon="flow"
      label={t("detail.about.goal")}
      leading={
        goal && counts ? (
          <SegmentedRing
            ariaLabel={
              ran
                ? tGoals("card.ringAria", { done: counts.done, total: counts.total })
                : tGoals("card.notRun")
            }
            max={Math.max(counts.total, 1)}
            size={40}
            tone={GOAL_CARD_STATE[goal.rollup.status]}
            used={counts.done}
            value={ran ? undefined : "–"}
          />
        ) : undefined
      }
      onClick={() => router.push(`/work/goals/${encodeURIComponent(goalId)}`)}
      text={name}
    />
  );
}

/** Pick a project for a project-less run; renders nothing on an empty registry. */
function AssignProject({ runId }: { runId: string }) {
  const t = useTranslations("runs.detail");
  const { data: projects = [] } = useProjectsQuery();
  const assign = useAssignRunProjectMutation();
  if (projects.length === 0) return null;
  return (
    <Container as="span" data-testid={RunDetailHeaderTestId.AssignProject}>
      <Dropdown
        aria-label={t("assignProject")}
        onChange={(projectId) => {
          if (projectId) assign.mutate({ params: { runId }, body: { projectId } });
        }}
        options={[
          { value: "", label: t("assignProject") },
          ...projects.map((p) => ({ value: p.id, label: p.name })),
        ]}
        size="sm"
        value=""
      />
    </Container>
  );
}

/** Breadcrumb, title, state/agent/department/project meta line, actions, progress hairline, metrics. */
export function RunDetailHeader({
  run,
  mode,
  metrics,
  progressPct,
  agent,
  actions,
  compact,
  banner,
  onOpenPr,
  onOpenIssue,
  artifactInfo,
}: RunDetailHeaderProps) {
  const t = useTranslations("runs");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const departments = useDepartmentLookup();
  const symbolOf = useAgentSymbol();
  const { taskId, projectId, department, sourcePr } = run;
  const sourcePrRef = sourcePr ? `${sourcePr.repo}#${sourcePr.number}` : "";
  const openPr = (url: string) =>
    onOpenPr ? onOpenPr(url) : router.push(prListHref(url) as Route);
  // An implementation run's own PR (the source PR is the one a review-type run acts on).
  const outputPr = run.prOutput && run.prOutput.url !== sourcePr?.url ? run.prOutput : undefined;
  const outputPrRef = outputPr
    ? `#${outputPr.url.match(/\/(?:pull|merge_requests)\/(\d+)/)?.[1] ?? "PR"}`
    : "";
  const issueLabel = run.roadmapItemLabel ?? run.roadmapItemId ?? "";
  const isPhone = useIsPhone();
  const columns = Math.max(
    2,
    Math.min(metrics.length, isPhone ? 2 : compact ? 5 : 6),
  ) as MetricStripColumns;
  // A finished run's outcome is the one sentence of what it did; while it works there is none (G: summary).
  const summary = mode === "done" ? run.taskOutcomeSummary : undefined;
  const about = [
    run.goalId ? <GoalAbout goalId={run.goalId} key="goal" /> : null,
    projectId && run.roadmapItemId ? (
      <AboutCard
        aria-label={t("detail.sourceIssue", { ref: issueLabel })}
        data-testid={RunDetailHeaderTestId.SourceIssueLink}
        icon={issueIcon(issueLabel)}
        key="issue"
        label={t("detail.about.source")}
        onClick={() =>
          onOpenIssue
            ? onOpenIssue(projectId, run.roadmapItemId as string)
            : router.push(`/dashboard/inbox/issues/${projectId}/${run.roadmapItemId}` as Route)
        }
        text={issueLabel}
      />
    ) : null,
    sourcePr ? (
      <AboutCard
        aria-label={t("detail.sourcePr", { ref: sourcePrRef })}
        data-testid={RunDetailHeaderTestId.SourcePrLink}
        icon={prIcon(sourcePr.url)}
        key="source-pr"
        label={t("detail.about.source")}
        onClick={() => openPr(sourcePr.url)}
        text={sourcePrRef}
      />
    ) : null,
    outputPr ? (
      <AboutCard
        aria-label={t("detail.outputPr", { ref: outputPrRef })}
        aside={`+${outputPr.additions} −${outputPr.deletions}`}
        data-testid={RunDetailHeaderTestId.OutputPrLink}
        icon={prIcon(outputPr.url)}
        key="output-pr"
        label={t("detail.about.result")}
        onClick={() => openPr(outputPr.url)}
        text={outputPrRef}
      />
    ) : null,
  ].filter(Boolean);

  return (
    <Stack data-testid={RunDetailHeaderTestId.Root} gap="0">
      <Container padding={["250", "300", "150", "300"]}>
        {/* Wraps: on a narrow screen the actions drop below the title instead of squeezing it. */}
        <Stack wrap align="start" direction="row" gap="300">
          <Stack grow gap="150">
            {!compact && (
              <Stack wrap align="center" direction="row" gap="100">
                <Pressable
                  data-testid={RunDetailHeaderTestId.Back}
                  onClick={() => router.push("/activity/runs")}
                  underline="hover"
                >
                  <Typography as="span" type="labelSm" variant="secondary">
                    {t("detail.backToRuns")}
                  </Typography>
                </Pressable>
                <Typography as="span" type="labelSm">
                  /
                </Typography>
                <Typography as="span" type="code">
                  <CopyableText
                    copiedLabel={tCommon("copied")}
                    copyFailedLabel={tCommon("copyFailed")}
                    copyLabel={tCommon("copyId")}
                    text={run.runId}
                  />
                </Typography>
                <Sep />
                <Typography as="span" type="labelSm">
                  {t(`kind.${run.kind}`)}
                </Typography>
                {taskId && (
                  <>
                    <Sep />
                    <Pressable
                      data-testid={RunDetailHeaderTestId.TaskLink}
                      onClick={() => router.push(`/work/tasks/${taskId}`)}
                      underline="hover"
                    >
                      <LinkLabel text={taskId} />
                    </Pressable>
                  </>
                )}
              </Stack>
            )}
            {!compact && (
              <Typography data-testid={RunDetailHeaderTestId.Title} type="h1">
                {runTitle(run)}
              </Typography>
            )}
            <Stack wrap align="center" direction="row" gap="150">
              <StatePill
                data-testid={RunDetailHeaderTestId.State}
                label={t(`detail.mode.${mode}`)}
                state={MODE_TONE[mode]}
              />
              {agent && (
                <Pressable
                  data-testid={RunDetailHeaderTestId.AgentLink}
                  onClick={() => router.push(`/workforce/agents/${agent.id}`)}
                  underline="hover"
                >
                  <Stack inline align="center" direction="row" gap="75">
                    <AgentBadge {...symbolOf(agent.id)} size="xs" state={agent.state} />
                    <Typography as="span" type="label" variant="primary">
                      {agent.role ? `${agent.name} · ${agent.role}` : agent.name}
                    </Typography>
                  </Stack>
                </Pressable>
              )}
              {department && (
                <>
                  <Sep />
                  <Typography as="span" type="label" variant="secondary">
                    {`${departments.code(department)} · ${departments.name(department)}`}
                  </Typography>
                </>
              )}
              {projectId ? (
                <>
                  <Sep />
                  <Pressable
                    data-testid={RunDetailHeaderTestId.ProjectLink}
                    onClick={() => router.push(`/projects/${projectId}`)}
                    underline="hover"
                  >
                    <Typography as="span" type="label" variant="secondary">
                      {run.project || projectId}
                    </Typography>
                  </Pressable>
                </>
              ) : (
                <AssignProject runId={run.runId} />
              )}
              {run.engine && (
                <>
                  <Sep />
                  <Typography
                    as="span"
                    data-testid={RunDetailHeaderTestId.Engine}
                    type="label"
                    variant="secondary"
                  >
                    {formatEngine(run.engine, run.engineModel)}
                  </Typography>
                </>
              )}
              {run.kind === "workflow" && !compact && (
                <>
                  <Sep />
                  <Typography as="span" type="label" variant="secondary">
                    {t("detail.workflow", { name: run.owner })}
                  </Typography>
                </>
              )}
            </Stack>
          </Stack>
          {actions}
        </Stack>
      </Container>
      {banner && <Container padding={["0", "300", "150", "300"]}>{banner}</Container>}
      {(about.length > 0 || summary) && (
        <Container data-testid={RunDetailHeaderTestId.About} padding={["0", "300", "150", "300"]}>
          <Stack gap="100">
            {about.length > 0 && (
              <Grid cols={1} gap="100" md={about.length > 1 ? 2 : 1}>
                {about}
              </Grid>
            )}
            {summary && (
              <Typography
                data-testid={RunDetailHeaderTestId.Summary}
                type="bodySm"
                variant="secondary"
              >
                {summary}
              </Typography>
            )}
          </Stack>
        </Container>
      )}
      {artifactInfo && <Container padding={["0", "300", "150", "300"]}>{artifactInfo}</Container>}
      {/* In the sheet the PROGRESS metric already says it. */}
      {!compact && (
        <Progress
          data-testid={RunDetailHeaderTestId.Progress}
          height="25"
          label={t("detail.metric.progress")}
          tone={mode === "running" ? "run" : "accent"}
          value={progressPct}
        />
      )}
      <Container data-testid={RunDetailHeaderTestId.Metrics} padding={["0", "300"]}>
        <MetricStrip
          columns={columns}
          items={metrics.map((m) => ({ label: t(`detail.metric.${m.key}`), value: m.value }))}
        />
      </Container>
    </Stack>
  );
}
