"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Button,
  CardSkeleton,
  Container,
  EmptyState,
  GoalLoopCard,
  Grid,
  ListHeader,
  type ListHeaderTone,
  ListToolbar,
  Stack,
  type StateTone,
} from "@zibby/design-system";
import type { Goal, TaskRun } from "@zibby/contracts";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useAgentsQuery } from "../../agents";
import { useRunsQuery, useStopTaskRunMutation } from "../../runs";
import { useCreateTaskMutation } from "../../tasks/mutations";
import { useResumeGoalRunMutation } from "../mutations";
import { useGoalsQuery } from "../queries";
import { goalRunTaskBody, goalStateTone } from "../goal";
import { type GoalFilter, goalFilterOf, goalVerdict } from "../goalListModel";

export enum GoalsListScreenTestId {
  New = "goals-list-new",
  Empty = "goals-list-empty",
  Skeleton = "goals-list-skeleton",
}

/** The most recent run for a goal — running/parked first, else the newest by start time. */
function latestRunFor(goalId: string, runs: readonly TaskRun[]): TaskRun | undefined {
  const forGoal = runs.filter((r) => r.kind === "goal" && r.goalId === goalId);
  const live = forGoal.find((r) => r.status === "running" || r.status === "parked");
  if (live) return live;
  return [...forGoal].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

const FILTERS: GoalFilter[] = ["all", "active", "parked", "done", "error"];

/**
 * `/work/goals` — Seznamy "Cíle": a live count line, status filter chips and a 2-up grid of
 * {@link GoalLoopCard}s (segmented iteration ring, maker ⇄ verifier pair, last verdict, actions),
 * one per goal definition, enriched with its most recent run. A goal that never ran is idle.
 */
export function GoalsListScreen() {
  const t = useTranslations("goals");
  const tl = useTranslations("goals.list");
  const router = useRouter();
  const [filter, setFilter] = useState<GoalFilter>("all");

  const goalsQuery = useGoalsQuery();
  const { data: agents = [] } = useAgentsQuery();
  const { runs, isPending: runsPending } = useRunsQuery();
  const resumeRun = useResumeGoalRunMutation();
  const stopRun = useStopTaskRunMutation();
  const createTask = useCreateTaskMutation();

  const goals: Goal[] = goalsQuery.data ?? [];
  const agentName = (id: string) => {
    const a = agents.find((x) => x.id === id);
    return a?.displayName ?? a?.name ?? id;
  };

  const rows = goals.map((goal) => {
    const run = latestRunFor(goal.id, runs);
    const tone = goalStateTone(run?.status);
    return { goal, run, tone, bucket: goalFilterOf(tone) };
  });
  const countOf = (f: GoalFilter) =>
    f === "all" ? rows.length : rows.filter((r) => r.bucket === f).length;
  const shown = filter === "all" ? rows : rows.filter((r) => r.bucket === filter);

  const count: ListHeaderTone[] = [
    { text: tl("count.total", { count: rows.length }), tone: "plain" },
  ];
  if (countOf("active") > 0)
    count.push({ text: tl("count.active", { count: countOf("active") }), tone: "run" });
  if (countOf("parked") > 0)
    count.push({ text: tl("count.parked", { count: countOf("parked") }), tone: "warn" });
  if (countOf("error") > 0)
    count.push({ text: tl("count.error", { count: countOf("error") }), tone: "bad" });
  if (countOf("done") > 0)
    count.push({ text: tl("count.done", { count: countOf("done") }), tone: "plain" });

  const openGoal = (id: string) => router.push(`/work/goals/${id}` as Route);
  const loading = goalsQuery.isPending || runsPending;

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="250">
        <ListHeader
          actions={
            <Button
              data-testid={GoalsListScreenTestId.New}
              icon="plus"
              intent="ink"
              onClick={() => router.push("/work/goals/new" as Route)}
            >
              {t("newGoal")}
            </Button>
          }
          count={loading ? [] : count}
          route="/work/goals"
          section={tl("section")}
          title={tl("title")}
        />

        {!loading && !goalsQuery.isError && goals.length > 0 && (
          <ListToolbar
            activeChip={filter}
            chips={FILTERS.map((f) => ({ id: f, label: tl(`filter.${f}`), count: countOf(f) }))}
            onChipChange={(id) => setFilter(id as GoalFilter)}
          />
        )}

        {loading ? (
          <Grid cols={1} gap="200" lg={2}>
            {[0, 1, 2, 3].map((i) => (
              <span data-testid={GoalsListScreenTestId.Skeleton} key={i}>
                <CardSkeleton shape="wide" />
              </span>
            ))}
          </Grid>
        ) : goalsQuery.isError ? (
          <QueryError onRetry={() => void goalsQuery.refetch()} />
        ) : goals.length === 0 ? (
          <EmptyState
            action={
              <Button
                icon="plus"
                intent="ink"
                onClick={() => router.push("/work/goals/new" as Route)}
              >
                {t("newGoal")}
              </Button>
            }
            body={t("emptyBody")}
            data-testid={GoalsListScreenTestId.Empty}
            icon="flow"
            title={t("emptyTitle")}
          />
        ) : (
          <Grid cols={1} gap="200" lg={2}>
            {shown.map(({ goal, run, tone }) => {
              const used = run?.iterations?.length ?? 0;
              const max = goal.maxIterations;
              const verdict = goalVerdict(run);
              const verdictTone =
                tone === "blocked"
                  ? "blocked"
                  : tone === "error"
                    ? "error"
                    : tone === "done"
                      ? "done"
                      : "idle";
              const makerName =
                goal.maker.kind === "agent" ? agentName(goal.maker.id) : goal.maker.id;
              const start = () => createTask.mutate({ body: goalRunTaskBody(goal) });
              const open = () => openGoal(goal.id);
              return (
                <GoalLoopCard
                  actions={goalActions({
                    tone,
                    run,
                    labels: {
                      stop: t("stop"),
                      openRun: tl("action.openRun"),
                      resume: t("resume"),
                      edit: tl("action.edit"),
                      openError: tl("action.openError"),
                      retry: tl("action.retry"),
                      history: tl("action.history"),
                      start: tl("action.start"),
                    },
                    onOpen: open,
                    onStop: () => run && stopRun.mutate({ params: { runId: run.runId }, body: {} }),
                    onResume: () =>
                      run && resumeRun.mutate({ params: { runId: run.runId }, body: {} }),
                    onStart: start,
                  })}
                  budgetLabel={tl("budgetPct", {
                    pct: max > 0 ? Math.round((used / max) * 100) : 0,
                  })}
                  key={goal.id}
                  maker={{ name: makerName, role: tl("maker") }}
                  max={max}
                  onOpen={open}
                  openLabel={tl("openAria", { name: goal.name ?? goal.objective })}
                  ringAriaLabel={tl("ringAria", { used, max })}
                  ringCaption={tl("ringCaption", { max })}
                  state={tone}
                  stateLabel={tl(`state.${tone}`)}
                  title={goal.name ?? goal.objective}
                  used={used}
                  verdict={verdictView(verdict, tl)}
                  verdictTone={verdictTone}
                  verifier={{
                    name: goal.verifier.agent ? agentName(goal.verifier.agent) : goal.verifier.kind,
                    role: tl("verifier"),
                  }}
                />
              );
            })}
          </Grid>
        )}
      </Stack>
    </Container>
  );
}

type Tl = ReturnType<typeof useTranslations<"goals.list">>;

function verdictView(v: ReturnType<typeof goalVerdict>, tl: Tl) {
  if (v.outcome === "none") return { head: tl("verdict.none"), text: tl("verdict.noneText") };
  return {
    head: tl("verdict.head", { n: v.iteration ?? 0 }),
    status: tl(`verdict.outcome.${v.outcome}`),
    text: v.text ?? tl("verdict.noText"),
  };
}

interface GoalActionsArgs {
  tone: StateTone;
  run?: TaskRun;
  labels: Record<
    "stop" | "openRun" | "resume" | "edit" | "openError" | "retry" | "history" | "start",
    string
  >;
  onOpen: () => void;
  onStop: () => void;
  onResume: () => void;
  onStart: () => void;
}

/** The action row per state — the design's buttons over the app's existing goal actions. */
function goalActions({ tone, run, labels, onOpen, onStop, onResume, onStart }: GoalActionsArgs) {
  if (tone === "blocked" && run?.status === "parked")
    return (
      <>
        <Button icon="play" onClick={onResume} size="sm">
          {labels.resume}
        </Button>
        <Button intent="ghost" onClick={onOpen} size="sm">
          {labels.edit}
        </Button>
      </>
    );
  if (tone === "working" || tone === "thinking")
    return (
      <>
        {run?.status === "running" && (
          <Button icon="stop" intent="secondary" onClick={onStop} size="sm">
            {labels.stop}
          </Button>
        )}
        <Button intent="ghost" onClick={onOpen} size="sm">
          {labels.openRun}
        </Button>
      </>
    );
  if (tone === "error")
    return (
      <>
        <Button intent="secondary" onClick={onOpen} size="sm">
          {labels.openError}
        </Button>
        <Button icon="retry" intent="ghost" onClick={onStart} size="sm">
          {labels.retry}
        </Button>
      </>
    );
  if (tone === "done")
    return (
      <Button intent="ghost" onClick={onOpen} size="sm">
        {labels.history}
      </Button>
    );
  return (
    <Button icon="play" intent="secondary" onClick={onStart} size="sm">
      {labels.start}
    </Button>
  );
}
