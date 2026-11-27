"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Goal } from "@zibby/contracts";
import {
  Alert,
  Button,
  Container,
  Divider,
  Grid,
  Panel,
  SelectField,
  Stack,
  type SubNavLinkComponent,
  Typography,
} from "@zibby/design-system";
import { apiErrorMessage } from "../../state/apiErrorMessage";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog/ConfirmDeleteDialog";
import { PageBreadcrumb } from "../../components/layout/PageBreadcrumb";
import { QueryError } from "../../components/LoadError/QueryError";
import { QueryLoading } from "../../components/LoadingState/QueryLoading";
import { PageContainer } from "../../components/PageContainer/PageContainer";
import { useCompaniesQuery } from "../companies/queries";
import { useProjectsQuery } from "../projects/queries";
import { GoalCycleTimeline } from "./components/GoalCycleTimeline";
import { GoalDetailActions } from "./components/GoalDetailActions";
import { GoalDirectionalPanel } from "./components/GoalDirectionalPanel";
import { GoalForm } from "./components/GoalForm";
import { GoalHero } from "./components/GoalHero";
import { GoalInstancesPanel } from "./components/GoalInstancesPanel";
import { GoalLoop } from "./components/GoalLoop";
import { GoalMergeGrantPanel } from "./components/GoalMergeGrantPanel";
import { GoalPlanPanel } from "./components/GoalPlanPanel";
import { GoalSettingsPanel } from "./components/GoalSettingsPanel";
import { GoalUpcoming } from "./components/GoalUpcoming";
import { GoalWaitingCard } from "./components/GoalWaitingCard";
import { buildUpdateGoalInput, goalToFormValues } from "./goalForm";
import { isGoalNotFound } from "./goalView";
import {
  useDeleteGoalMutation,
  useResumeGoalInstanceMutation,
  useUpdateGoalMutation,
  useWakeGoalMutation,
} from "./mutations";
import { useGoalQuery, useGoalStateQuery } from "./queries";

export enum GoalDetailScreenTestId {
  Gone = "goal-detail-gone",
  Error = "goal-detail-error",
  StateError = "goal-detail-state-error",
  SettingsEdit = "goal-detail-settings-edit",
  Projects = "goal-detail-projects",
}

export interface GoalDetailScreenProps {
  goalId: string;
}

/** The page frame (breadcrumb in the context bar + padding) every state renders inside. */
function Frame({ title, children }: { title: string; children: ReactNode }) {
  const t = useTranslations("goals");
  return (
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="250">
          <PageBreadcrumb
            items={[{ label: t("title"), href: "/work/goals" }, { label: title }]}
            linkComponent={Link as SubNavLinkComponent}
          />
          {children}
        </Stack>
      </PageContainer>
    </Container>
  );
}

/**
 * `/work/goals/:id`, the mandate made visible: context-bar actions, a hero (outcome, tags,
 * projects gauge, real budget meters), then the loop + "Co se dělo" / "Co bude" on the left
 * and the side cards on the right. Edit swaps the left column for the {@link GoalForm}.
 */
export function GoalDetailScreen({ goalId }: GoalDetailScreenProps) {
  const query = useGoalQuery(goalId);
  const t = useTranslations();
  if (query.isError && isGoalNotFound(query.error)) {
    return (
      <Frame title={goalId}>
        <Typography data-testid={GoalDetailScreenTestId.Gone} type="body">
          {t("bridge.widgets.goals.gone")}
        </Typography>
      </Frame>
    );
  }
  if (query.isError || query.isPending || !query.data) {
    return (
      <Frame title={goalId}>
        {query.isError ? <QueryError onRetry={() => void query.refetch()} /> : <QueryLoading />}
      </Frame>
    );
  }
  return <GoalDetail goal={query.data} key={query.data.id} />;
}

function GoalDetail({ goal }: { goal: Goal }) {
  const t = useTranslations("goals");
  const tk = useTranslations();
  const router = useRouter();
  const stateQuery = useGoalStateQuery(goal.id);
  const projects = useProjectsQuery().data ?? [];
  const companies = useCompaniesQuery().data ?? [];
  const update = useUpdateGoalMutation();
  const remove = useDeleteGoalMutation();
  const wake = useWakeGoalMutation();
  const resume = useResumeGoalInstanceMutation();
  // A coarse clock: the deadline meter, merge-grant tag and next cycle advance on an open page.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fail = (e: unknown) => setActionError(apiErrorMessage(e) ?? t("actionFailed"));

  const names = {
    projectName: (id: string) => projects.find((p) => p.id === id)?.name ?? id,
    companyName: (id: string) => companies.find((c) => c.id === id)?.name ?? id,
  };
  const scope = goal.scope;
  const scopeProjectIds =
    scope.kind === "none"
      ? []
      : scope.kind === "projects"
        ? scope.projectIds
        : projects
            .filter((p) => scope.kind === "all" || p.companyId === scope.companyId)
            .map((p) => p.id);
  // A failed refetch keeps the last good state; only a state that never loaded is an error.
  const state = stateQuery.data?.state;
  const rollup = stateQuery.data?.rollup;
  const instances = state?.instances ?? {};
  const instanceKeys = Object.keys(instances);
  const instanceLabel = (key: string) =>
    key === "_" ? t("instances.noProject") : names.projectName(key);
  const plans = Object.entries(instances).flatMap(([key, instance]) =>
    instance.planNoteId ? [{ noteId: instance.planNoteId, label: instanceLabel(key) }] : [],
  );
  const parked = Object.entries(instances).filter(([, i]) => i.status === "parked");
  const stateError = stateQuery.isError && !state && (
    <div data-testid={GoalDetailScreenTestId.StateError}>
      <QueryError onRetry={() => void stateQuery.refetch()} />
    </div>
  );

  const startEdit = () => {
    update.reset();
    setEditing(true);
  };
  const resumeInstance = (instance: string) => {
    setResuming(instance);
    resume.mutate(
      { params: { id: goal.id, instance }, body: {} },
      { onError: fail, onSettled: () => setResuming(null) },
    );
  };

  const readColumn = (
    <>
      {state && rollup ? (
        <GoalLoop goal={goal} rollup={rollup} state={state} />
      ) : (
        stateError || (stateQuery.isPending && <QueryLoading />)
      )}
      {state && <GoalUpcoming goal={goal} names={names} now={now} state={state} />}
      <GoalCycleTimeline
        goalId={goal.id}
        instances={instanceKeys}
        liveIndex={state?.cycle.index}
        names={names}
        standing={goal.cadence !== undefined}
        status={rollup?.status}
      />
    </>
  );

  const sideColumn = (
    <Stack gap="150">
      {parked.map(([key, instance]) => (
        <GoalWaitingCard
          instance={instance}
          instanceKey={key}
          key={key}
          onResume={() => resumeInstance(key)}
          project={key === "_" ? undefined : names.projectName(key)}
          resuming={resuming === key}
        />
      ))}
      <Panel
        header={t("detail.settingsTitle")}
        headerEnd={
          editing ? undefined : (
            <Button
              data-testid={GoalDetailScreenTestId.SettingsEdit}
              icon="edit"
              intent="ghost"
              onClick={startEdit}
              size="sm"
            >
              {tk("common.edit")}
            </Button>
          )
        }
        headerRule={false}
        padding="200"
      >
        <GoalSettingsPanel goal={goal} names={names} />
      </Panel>
      <Panel header={t("detail.instancesTitle")} headerRule={false} padding="200">
        <Stack gap="200">
          {/* Editing turns a company / all scope into an explicit list; emptying it unties the goal. */}
          <div data-testid={GoalDetailScreenTestId.Projects}>
            <SelectField
              multi
              label={t("form.scopeProjectsPick")}
              onValueChange={(ids) =>
                update.mutate(
                  {
                    params: { id: goal.id },
                    body: {
                      scope:
                        ids.length > 0 ? { kind: "projects", projectIds: ids } : { kind: "none" },
                    },
                  },
                  { onError: fail },
                )
              }
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder={t("form.scopeProjectsPlaceholder")}
              removeLabel={tk("common.delete")}
              value={scopeProjectIds}
            />
          </div>
          {/* Without a loaded state there is nothing to list; the retry sits once, in the left column. */}
          {state && <GoalInstancesPanel instances={instances} names={names} />}
        </Stack>
      </Panel>
      <Panel header={t("detail.planTitle")} headerRule={false} padding="200">
        <GoalPlanPanel plans={plans} />
      </Panel>
      <Panel header={t("mergeGrant.title")} headerRule={false} padding="200">
        <GoalMergeGrantPanel goal={goal} names={names} projectIds={scopeProjectIds} />
      </Panel>
      {goal.directional && (
        <Panel header={t("directional.title")} headerRule={false} padding="200">
          <GoalDirectionalPanel instances={instances} names={names} />
        </Panel>
      )}
    </Stack>
  );

  return (
    <Frame title={goal.name}>
      <GoalDetailActions
        cycleIndex={goal.cadence && state ? state.cycle.index : undefined}
        editing={editing}
        enabled={goal.enabled}
        name={goal.name}
        onDelete={() => setConfirmDelete(true)}
        onEdit={startEdit}
        onToggle={() =>
          update.mutate(
            { params: { id: goal.id }, body: { enabled: !goal.enabled } },
            { onError: fail },
          )
        }
        onWake={() => wake.mutate({ params: { id: goal.id }, body: {} }, { onError: fail })}
        toggling={update.isPending && !editing}
        waking={wake.isPending}
      />

      {actionError && (
        <Alert
          data-testid={GoalDetailScreenTestId.Error}
          onClose={() => setActionError(null)}
          severity="error"
        >
          {actionError}
        </Alert>
      )}

      {editing ? (
        <GoalForm
          error={update.isError ? (apiErrorMessage(update.error) ?? t("actionFailed")) : undefined}
          initial={goalToFormValues(goal)}
          layout={({ identity, settings, actions }) => (
            <Stack gap="250">
              <GoalHero
                goal={goal}
                identity={identity}
                names={names}
                now={now}
                rollup={rollup}
                state={state}
              />
              <Divider />
              <Grid align="start" cols={1} gap="250" lg={2}>
                <Panel header={t("detail.settingsTitle")} padding="200">
                  <Stack gap="200">
                    {settings}
                    {actions}
                  </Stack>
                </Panel>
                {sideColumn}
              </Grid>
            </Stack>
          )}
          onCancel={() => setEditing(false)}
          onSubmit={(values) =>
            update.mutate(
              { params: { id: goal.id }, body: buildUpdateGoalInput(values, goal.directional) },
              { onSuccess: () => setEditing(false) },
            )
          }
          pending={update.isPending}
          submitLabel={tk("common.save")}
        />
      ) : (
        <>
          <GoalHero goal={goal} names={names} now={now} rollup={rollup} state={state} />
          <Divider />
          <Grid align="start" cols={1} gap="250" lg={2}>
            <Stack gap="300">{readColumn}</Stack>
            {sideColumn}
          </Grid>
        </>
      )}

      {confirmDelete && (
        <ConfirmDeleteDialog
          body={t("detail.deleteBody", { name: goal.name })}
          cancelLabel={tk("common.cancel")}
          confirmLabel={tk("common.delete")}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            remove.mutate(
              { params: { id: goal.id } },
              {
                onSuccess: () => router.push("/work/goals"),
                onError: (e) => {
                  setConfirmDelete(false);
                  fail(e);
                },
              },
            )
          }
          pending={remove.isPending}
          title={t("detail.deleteTitle")}
        />
      )}
    </Frame>
  );
}
