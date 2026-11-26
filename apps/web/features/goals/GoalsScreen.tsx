"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { CreateGoalInput, GoalPreset } from "@zibby/contracts";
import {
  Button,
  CardSkeleton,
  Container,
  EmptyState,
  Grid,
  ListHeader,
  type ListHeaderTone,
  ListToolbar,
  Stack,
} from "@zibby/design-system";
import { QueryError } from "../../components/LoadError/QueryError";
import { PageContainer } from "../../components/PageContainer/PageContainer";
import { useCompaniesQuery } from "../companies/queries";
import { useProjectsQuery } from "../projects/queries";
import { GoalCard } from "./components/GoalCard";
import { GoalFormDialog } from "./components/GoalFormDialog";
import { GoalPresets } from "./components/GoalPresets";
import { GOAL_FILTERS, type GoalFilter, goalMatchesFilter, presetToCreateBody } from "./goalView";
import { useCreateGoalMutation, useUpdateGoalMutation } from "./mutations";
import { getGoalsQueryKey, useGoalsQuery } from "./queries";

export enum GoalsScreenTestId {
  Skeletons = "goals-skeletons",
  Empty = "goals-empty",
  NoMatch = "goals-no-match",
  List = "goals-list",
}

/** Message of a failed create, when the server explains it (duplicate id, invalid body). */
function createErrorMessage(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "body" in err) {
    const body = (err as { body?: { message?: unknown } }).body;
    if (typeof body?.message === "string") return body.message;
  }
  return undefined;
}

/**
 * `/work/goals`: the operator's mandates with their roll-up, plus the "Připravené cíle"
 * presets. The dialog only births a goal (created paused) and navigates to its detail page,
 * where editing lives.
 */
export function GoalsScreen() {
  const t = useTranslations("goals");
  const router = useRouter();
  const queryClient = useQueryClient();
  const goalsQuery = useGoalsQuery();
  const goals = useMemo(() => goalsQuery.data ?? [], [goalsQuery.data]);
  const projects = useProjectsQuery().data ?? [];
  const companies = useCompaniesQuery().data ?? [];
  const create = useCreateGoalMutation();
  const update = useUpdateGoalMutation();
  const [filter, setFilter] = useState<GoalFilter>("all");
  const [creating, setCreating] = useState(false);
  const [presetPending, setPresetPending] = useState<string | null>(null);

  const names = {
    projectName: (id: string) => projects.find((p) => p.id === id)?.name ?? id,
    companyName: (id: string) => companies.find((c) => c.id === id)?.name ?? id,
  };
  const existingIds = useMemo(() => new Set(goals.map((g) => g.id)), [goals]);
  const visible = goals.filter((g) => goalMatchesFilter(g.rollup.status, filter));
  const needsYou = goals.reduce((sum, g) => sum + g.rollup.needsYou, 0);

  const open = (id: string) => router.push(`/work/goals/${encodeURIComponent(id)}`);

  const onCreate = (body: CreateGoalInput) =>
    create.mutate({ body }, { onSuccess: () => open(body.id) });

  const addPreset = (preset: GoalPreset) => {
    setPresetPending(preset.id);
    create.mutate(
      { body: presetToCreateBody(preset) },
      {
        onSuccess: () => open(preset.id),
        // A 409 means the preset's id is already taken: refetch so the row reads "Přidáno".
        onError: () => void queryClient.invalidateQueries({ queryKey: getGoalsQueryKey() }),
        onSettled: () => setPresetPending(null),
      },
    );
  };

  const count: ListHeaderTone[] = [];
  if (goalsQuery.data) {
    count.push({ text: t("list.total", { count: goals.length }), tone: "plain" });
    if (needsYou > 0) count.push({ text: t("list.needsYou", { count: needsYou }), tone: "warn" });
  }

  const addButton = (
    <Button
      icon="plus"
      intent="ink"
      onClick={() => {
        create.reset();
        setCreating(true);
      }}
    >
      {t("list.newGoal")}
    </Button>
  );

  const body = goalsQuery.isPending ? (
    <Grid cols={1} data-testid={GoalsScreenTestId.Skeletons} gap="150" lg={2}>
      {[0, 1, 2, 3].map((i) => (
        <CardSkeleton key={i} shape="card" />
      ))}
    </Grid>
  ) : goalsQuery.isError ? (
    <QueryError onRetry={() => void goalsQuery.refetch()} />
  ) : goals.length === 0 ? (
    <EmptyState
      action={addButton}
      body={t("emptyBody")}
      data-testid={GoalsScreenTestId.Empty}
      icon="compass"
      title={t("emptyTitle")}
    />
  ) : visible.length === 0 ? (
    <EmptyState
      body={t("list.noMatchBody")}
      data-testid={GoalsScreenTestId.NoMatch}
      icon="search"
      title={t("list.noMatchTitle")}
    />
  ) : (
    <Grid cols={1} data-testid={GoalsScreenTestId.List} gap="150" lg={2}>
      {visible.map((goal) => (
        <GoalCard
          goal={goal}
          key={goal.id}
          names={names}
          onOpen={() => open(goal.id)}
          onToggle={() =>
            update.mutate({ params: { id: goal.id }, body: { enabled: !goal.enabled } })
          }
        />
      ))}
    </Grid>
  );

  return (
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="300">
          <ListHeader
            actions={addButton}
            count={count}
            route="/work/goals"
            section={t("list.section")}
            title={t("title")}
          />
          {goals.length > 0 && (
            <ListToolbar
              activeChip={filter}
              chips={GOAL_FILTERS.map((id) => ({
                id,
                label: t(`list.filter.${id}`),
                count: goals.filter((g) => goalMatchesFilter(g.rollup.status, id)).length,
              }))}
              onChipChange={(id) => setFilter(id as GoalFilter)}
            />
          )}
          {body}
          {!goalsQuery.isPending && !goalsQuery.isError && (
            <GoalPresets existingIds={existingIds} onAdd={addPreset} pendingId={presetPending} />
          )}
        </Stack>
      </PageContainer>

      {creating && (
        <GoalFormDialog
          error={create.isError ? createErrorMessage(create.error) : undefined}
          onClose={() => setCreating(false)}
          onCreate={onCreate}
          pending={create.isPending}
        />
      )}
    </Container>
  );
}
