"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Goal } from "@zibby/contracts";
import {
  Alert,
  Button,
  Container,
  Panel,
  Stack,
  type SubNavLinkComponent,
  Toggle,
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
import { GoalForm } from "./components/GoalForm";
import { GoalInstancesPanel } from "./components/GoalInstancesPanel";
import { GoalPlanPanel } from "./components/GoalPlanPanel";
import { GoalSettingsPanel } from "./components/GoalSettingsPanel";
import { GoalStatusBadge } from "./components/GoalStatusBadge";
import { GoalTimelinePanel } from "./components/GoalTimelinePanel";
import { buildUpdateGoalInput, goalToFormValues } from "./goalForm";
import {
  useDeleteGoalMutation,
  useResumeGoalInstanceMutation,
  useUpdateGoalMutation,
  useWakeGoalMutation,
} from "./mutations";
import { useGoalQuery, useGoalStateQuery } from "./queries";

export enum GoalDetailScreenTestId {
  Toggle = "goal-detail-toggle",
  Wake = "goal-detail-wake",
  Edit = "goal-detail-edit",
  Delete = "goal-detail-delete",
  Error = "goal-detail-error",
}

export interface GoalDetailScreenProps {
  goalId: string;
}

/**
 * `/work/goals/:id`. Edit is top-right and swaps the settings panel for the same
 * {@link GoalForm} the create dialog uses; dialogs only create and confirm.
 */
export function GoalDetailScreen({ goalId }: GoalDetailScreenProps) {
  const query = useGoalQuery(goalId);
  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;
  if (query.isPending) return <QueryLoading />;
  if (!query.data) return null;
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
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resuming, setResuming] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fail = (e: unknown) => setActionError(apiErrorMessage(e) ?? t("actionFailed"));

  const names = {
    projectName: (id: string) => projects.find((p) => p.id === id)?.name ?? id,
    companyName: (id: string) => companies.find((c) => c.id === id)?.name ?? id,
  };
  const state = stateQuery.data?.state;
  const rollup = stateQuery.data?.rollup;
  const instances = state?.instances ?? {};
  const instanceKeys = Object.keys(instances);
  const plans = Object.entries(instances).flatMap(([key, instance]) =>
    instance.planNoteId
      ? [
          {
            noteId: instance.planNoteId,
            label: key === "_" ? t("instances.noProject") : names.projectName(key),
          },
        ]
      : [],
  );

  const resumeInstance = (instance: string) => {
    setResuming(instance);
    resume.mutate(
      { params: { id: goal.id, instance }, body: {} },
      { onError: fail, onSettled: () => setResuming(null) },
    );
  };

  return (
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="250">
          <PageBreadcrumb
            items={[{ label: t("title"), href: "/work/goals" }, { label: goal.name }]}
            linkComponent={Link as SubNavLinkComponent}
          />

          <Stack wrap align="center" direction="row" gap="150" justify="between">
            <Stack wrap align="center" direction="row" gap="150">
              <Typography type="h1">{goal.name}</Typography>
              {rollup && <GoalStatusBadge status={rollup.status} />}
            </Stack>
            <Stack wrap align="center" direction="row" gap="100">
              <Toggle
                checked={goal.enabled}
                data-testid={GoalDetailScreenTestId.Toggle}
                label={t("toggleLabel", { name: goal.name })}
                onChange={(enabled) =>
                  update.mutate({ params: { id: goal.id }, body: { enabled } })
                }
                size="md"
              />
              <Button
                data-testid={GoalDetailScreenTestId.Wake}
                icon="play"
                intent="ghost"
                loading={wake.isPending}
                onClick={() =>
                  wake.mutate({ params: { id: goal.id }, body: {} }, { onError: fail })
                }
                size="sm"
              >
                {t("detail.wake")}
              </Button>
              {!editing && (
                <Button
                  data-testid={GoalDetailScreenTestId.Edit}
                  icon="edit"
                  intent="ghost"
                  onClick={() => {
                    update.reset();
                    setEditing(true);
                  }}
                  size="sm"
                >
                  {tk("common.edit")}
                </Button>
              )}
              <Button
                data-testid={GoalDetailScreenTestId.Delete}
                icon="trash"
                intent="danger"
                onClick={() => setConfirmDelete(true)}
                size="sm"
              >
                {tk("common.delete")}
              </Button>
            </Stack>
          </Stack>

          {actionError && (
            <Alert
              data-testid={GoalDetailScreenTestId.Error}
              onClose={() => setActionError(null)}
              severity="error"
            >
              {actionError}
            </Alert>
          )}

          <Panel header={t("detail.settingsTitle")} padding="200">
            {editing ? (
              <GoalForm
                error={
                  update.isError ? (apiErrorMessage(update.error) ?? t("actionFailed")) : undefined
                }
                initial={goalToFormValues(goal)}
                onCancel={() => setEditing(false)}
                onSubmit={(values) =>
                  update.mutate(
                    { params: { id: goal.id }, body: buildUpdateGoalInput(values) },
                    { onSuccess: () => setEditing(false) },
                  )
                }
                pending={update.isPending}
                submitLabel={tk("common.save")}
              />
            ) : (
              <GoalSettingsPanel goal={goal} names={names} />
            )}
          </Panel>

          <Panel header={t("detail.instancesTitle")} padding="200">
            {stateQuery.isError ? (
              <QueryError onRetry={() => void stateQuery.refetch()} />
            ) : (
              <GoalInstancesPanel
                instances={instances}
                names={names}
                onResume={resumeInstance}
                resuming={resuming}
              />
            )}
          </Panel>

          <Panel header={t("detail.planTitle")} padding="200">
            <GoalPlanPanel plans={plans} />
          </Panel>

          <Panel header={t("detail.timelineTitle")} padding="200">
            <GoalTimelinePanel
              goalId={goal.id}
              instances={instanceKeys}
              names={names}
              standing={goal.cadence !== undefined}
            />
          </Panel>
        </Stack>
      </PageContainer>

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
    </Container>
  );
}
