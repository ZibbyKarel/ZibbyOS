"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Button,
  Container,
  Dialog,
  Divider,
  EmptyState,
  Grid,
  Stack,
  type SubNavLinkComponent,
  TextInputField,
  Typography,
} from "@zibby/design-system";
import { PageBreadcrumb } from "../../../components/layout/PageBreadcrumb";
import { QueryError } from "../../../components/LoadError/QueryError";
import { QueryLoading } from "../../../components/LoadingState/QueryLoading";
import { useAgentsQuery } from "../../agents";
import { useProjectsQuery } from "../../projects";
import { useRunsQuery, useStopTaskRunMutation } from "../../runs";
import { useCreateTaskMutation } from "../../tasks/mutations";
import { useWorkflowsQuery } from "../../workflows";
import { GoalHero } from "../components/GoalHero";
import { GoalIterations } from "../components/GoalIterations";
import { GoalLoop } from "../components/GoalLoop";
import { type GoalNode, GoalNodeDialog } from "../components/GoalNodeDialog";
import { GoalErrorNotice, GoalSidePanels } from "../components/GoalSidePanels";
import { GoalToolbar } from "../components/GoalToolbar";
import { GoalWaitingCard } from "../components/GoalWaitingCard";
import {
  activeLoopArrow,
  defaultGoalRun,
  formatDuration,
  goalRunTaskBody,
  goalRunsFor,
  goalStateTone,
  iterationDurationMs,
  makeGoalId,
} from "../goal";
import {
  type GoalDraft,
  draftFromGoal,
  draftToCreate,
  draftToUpdate,
  isDraftValid,
} from "../goalDraft";
import { useCreateGoalMutation, useDeleteGoalMutation, useUpdateGoalMutation } from "../mutations";
import { useGoalQuery } from "../queries";

export interface GoalDetailScreenProps {
  goalId: string;
}

/**
 * `/work/goals/[id]` — the goal as a loop made visible: hero (objective, iteration gauge,
 * budget meters), maker ⇄ verifier diagram (the edit surface in edit mode), iteration
 * timeline with a run selector, and a side column (instructions, limits, parked/error cards).
 */
export function GoalDetailScreen({ goalId }: GoalDetailScreenProps) {
  const t = useTranslations("goalPage");
  const tTone = useTranslations("goals.stateTone");
  const router = useRouter();
  const goalQuery = useGoalQuery(goalId);
  const { data: projects = [] } = useProjectsQuery();
  const { data: agents = [] } = useAgentsQuery();
  const { data: workflows = [] } = useWorkflowsQuery();
  const { runs, isPending: runsPending } = useRunsQuery();
  const updateGoal = useUpdateGoalMutation();
  const deleteGoal = useDeleteGoalMutation();
  const createGoal = useCreateGoalMutation();
  const createTask = useCreateTaskMutation();
  const stopRun = useStopTaskRunMutation();

  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [node, setNode] = useState<GoalNode | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  if (goalQuery.isPending || runsPending) return <QueryLoading />;
  if (goalQuery.isError || !goalQuery.data) {
    return <QueryError onRetry={() => void goalQuery.refetch()} />;
  }
  const goal = goalQuery.data;
  const goalRuns = goalRunsFor(goal.id, runs);
  const run = goalRuns.find((r) => r.runId === selectedRunId) ?? defaultGoalRun(goalRuns);
  const editing = draft !== null;
  const view = draft ?? draftFromGoal(goal);

  const agentName = (id: string) => {
    const a = agents.find((x) => x.id === id);
    return a?.displayName ?? a?.name ?? id;
  };
  const maker =
    view.makerKind === "agent"
      ? (() => {
          const a = agents.find((x) => x.id === view.makerId);
          return {
            name: agentName(view.makerId),
            sub: [t("kindAgent"), a?.model, a?.thinking].filter(Boolean).join(" · "),
          };
        })()
      : (() => {
          const w = workflows.find((x) => x.id === view.makerId);
          return {
            name: w?.name ?? view.makerId,
            sub: [t("kindWorkflow"), w ? t("phasesN", { n: w.phases.length }) : null]
              .filter(Boolean)
              .join(" · "),
          };
        })();
  const verifier = {
    name: agentName(view.verifierAgent),
    sub: [t("freshVerifier"), view.verifierModel, view.verifierThinking]
      .filter(Boolean)
      .join(" · "),
  };

  const arrow = activeLoopArrow(run);
  const parked = run?.status === "parked";
  const tone = arrow === "back" ? "thinking" : goalStateTone(run?.status);
  const pillLabel = parked
    ? t("waitingForYou")
    : arrow === "back"
      ? t("verifierJudging")
      : tTone(tone === "thinking" ? "idle" : tone);
  const used = run?.iterations?.length ?? 0;
  const project = goal.projectId ? projects.find((p) => p.id === goal.projectId) : undefined;

  const iterations = run?.iterations ?? [];
  const finished = iterations.filter((it) => it.status !== "running");
  const perIteration =
    finished.length > 0
      ? [
          formatDuration(
            finished.reduce((s, it) => s + iterationDurationMs(it, nowMs), 0) / finished.length,
          ),
          ...(run?.costUsd !== undefined
            ? [`$${(run.costUsd / iterations.length).toFixed(2)}`]
            : []),
        ]
          .reverse()
          .join(" · ")
      : undefined;

  const patch = (p: Partial<GoalDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const start = () =>
    createTask.mutate(
      { body: goalRunTaskBody(goal) },
      { onSuccess: () => setSelectedRunId(undefined) },
    );
  const save = () => {
    if (!draft) return;
    updateGoal.mutate(
      { params: { id: goal.id }, body: draftToUpdate(draft) },
      { onSuccess: () => setDraft(null) },
    );
  };
  const duplicate = () => {
    const name = `${goal.name ?? goal.objective.slice(0, 60)} ${t("copySuffix")}`;
    const id = makeGoalId(name, Date.now());
    createGoal.mutate(
      { body: draftToCreate({ ...draftFromGoal(goal), name }, id) },
      { onSuccess: () => router.push(`/work/goals/${id}` as Route) },
    );
  };

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="250">
        <PageBreadcrumb
          items={[
            { label: t("goals"), href: "/work/goals" },
            { label: goal.name ?? goal.objective.slice(0, 60) },
          ]}
          linkComponent={Link as SubNavLinkComponent}
        />
        <GoalToolbar
          canSave={isDraftValid(view)}
          editing={editing}
          onCancel={() => setDraft(null)}
          onDelete={() => setDeleting(true)}
          onDuplicate={duplicate}
          onEdit={() => setDraft(draftFromGoal(goal))}
          onRename={() => setRenaming(goal.name ?? "")}
          onSave={save}
          onSelectRun={setSelectedRunId}
          onStart={start}
          onStop={() => run && stopRun.mutate({ params: { runId: run.runId }, body: {} })}
          run={run}
          runs={goalRuns}
          saving={updateGoal.isPending}
          selectedRunId={run?.runId}
          starting={createTask.isPending}
        />
        <GoalHero
          editing={editing}
          goal={goal}
          goalRuns={goalRuns}
          makerLabel={`${t("maker")}: ${maker.name}`}
          nowMs={nowMs}
          objective={view.objective}
          onObjectiveChange={(objective) => patch({ objective })}
          pillLabel={pillLabel}
          projectLabel={project?.name}
          run={run}
          tone={tone}
          verifierLabel={`${t("verifier")}: ${verifier.sub}`}
        />
        <Divider />
        <Grid gap="250" sidebar="right">
          <Stack gap="200">
            {run && parked ? <GoalWaitingCard run={run} /> : null}
            <GoalLoop
              active={arrow}
              makerKind={view.makerKind}
              makerName={maker.name}
              makerSub={maker.sub}
              max={goal.maxIterations}
              onEditMaker={editing ? () => setNode("maker") : undefined}
              onEditVerifier={editing ? () => setNode("verifier") : undefined}
              parked={parked}
              used={used}
              verifierName={verifier.name}
              verifierSub={verifier.sub}
            />
            {run ? (
              <GoalIterations makerId={goal.maker.id} nowMs={nowMs} run={run} />
            ) : (
              <EmptyState
                action={
                  <Button disabled={createTask.isPending} icon="play" onClick={start}>
                    {t("startGoal")}
                  </Button>
                }
                body={t("noRunsBody")}
                title={t("noRunsTitle")}
              />
            )}
          </Stack>
          <Stack gap="150">
            {run?.status === "error" ? (
              <GoalErrorNotice
                onSwitchMaker={() => {
                  setDraft((d) => d ?? draftFromGoal(goal));
                  setNode("maker");
                }}
              />
            ) : null}
            <GoalSidePanels
              draft={view}
              editing={editing}
              goal={goal}
              onChange={patch}
              perIteration={perIteration}
            />
          </Stack>
        </Grid>
      </Stack>

      <GoalNodeDialog
        agents={agents.map((a) => ({ value: a.id, label: a.displayName ?? a.name ?? a.id }))}
        draft={view}
        node={node}
        onChange={patch}
        onClose={() => setNode(null)}
        workflows={workflows.map((w) => ({ value: w.id, label: w.name }))}
      />
      <Dialog
        actions={
          <Button
            disabled={updateGoal.isPending}
            onClick={() =>
              updateGoal.mutate(
                { params: { id: goal.id }, body: { name: renaming?.trim() || undefined } },
                { onSuccess: () => setRenaming(null) },
              )
            }
          >
            {t("save")}
          </Button>
        }
        onClose={() => setRenaming(null)}
        open={renaming !== null}
        title={t("rename")}
        width="sm"
      >
        <TextInputField
          label={t("name")}
          onChange={(e) => setRenaming(e.target.value)}
          value={renaming ?? ""}
        />
      </Dialog>
      <Dialog
        actions={
          <Button
            disabled={deleteGoal.isPending}
            intent="danger"
            onClick={() =>
              deleteGoal.mutate(
                { params: { id: goal.id } },
                { onSuccess: () => router.push("/work/goals" as Route) },
              )
            }
          >
            {t("delete")}
          </Button>
        }
        onClose={() => setDeleting(false)}
        open={deleting}
        title={t("deleteTitle")}
        width="sm"
      >
        <Typography size="sm" type="bodySm">
          {t("deleteBody")}
        </Typography>
      </Dialog>
    </Container>
  );
}
