"use client";

import { Button, Container, Grid, SectionLabel, Stack, Typography } from "@zibby/design-system";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { QueryError } from "../../components/LoadError/QueryError";
import { QueryLoading } from "../../components/LoadingState/QueryLoading";
import { PageContainer } from "../../components/PageContainer/PageContainer";
import { useAgentsQuery } from "../agents";
import { useDepartmentLookup } from "../departments/useDepartmentLookup";
import { NewWorkflowDialog } from "./components/NewWorkflowDialog/NewWorkflowDialog";
import { WorkflowDetailScreen } from "./components/WorkflowEditor/WorkflowDetailScreen";
import { WorkflowCard } from "./components/WorkflowCard/WorkflowCard";
import { useCreateWorkflowMutation } from "./mutations";
import { groupWorkflowsByDepartment } from "./groupWorkflowsByDepartment";
import { useWorkflowsQuery } from "./queries";

export enum ScreenTestId {
  Group = "workflows-group",
}

export interface ScreenProps {
  /** Pre-selected workflow id from the [id] route segment. */
  selectedId?: string;
  /**
   * ZB-03 — the list/detail route prefix. Defaults to `/work/workflows`; a
   * department's Workflows tab hosts this same screen at
   * `/workforce/departments/[id]/workflows` so its editor opens under the
   * department instead of the global catalog.
   */
  basePath?: string;
}

/**
 * The `/workflows` and `/workflows/[id]` routes share this one Screen. Without an id it is the
 * department-grouped card grid; `routeId` (the `[id]` route segment) renders that workflow's
 * full-page editor instead, and its breadcrumb navigates back to `basePath`.
 */
export function Screen({ selectedId: routeId, basePath = "/work/workflows" }: ScreenProps) {
  const t = useTranslations();
  const workflowsQuery = useWorkflowsQuery();
  const workflows = workflowsQuery.data ?? [];
  const createWorkflow = useCreateWorkflowMutation();
  const { data: agents = [] } = useAgentsQuery();
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  const departments = useDepartmentLookup();

  const list = workflows;
  const selected = routeId ? list.find((p) => p.id === routeId) : undefined;
  const groups = useMemo(
    () =>
      groupWorkflowsByDepartment(
        list,
        (id) => departments.get(id)?.name,
        t("workflows.noDepartment"),
      ),
    [list, departments, t],
  );

  const addModal = adding && (
    <NewWorkflowDialog
      agents={agents}
      error={createWorkflow.error}
      isPending={createWorkflow.isPending}
      onClose={() => setAdding(false)}
      onCreate={(body) =>
        createWorkflow.mutate(
          { body },
          {
            onSuccess: () => {
              setAdding(false);
              router.push(`${basePath}/${body.id}` as Route);
            },
          },
        )
      }
    />
  );

  // Honest load states (F5 consolidation, mirroring automations/Screen.tsx
  // from F4): a pending/failed fetch must never read as an empty workspace.
  const body = workflowsQuery.isPending ? (
    <QueryLoading />
  ) : workflowsQuery.isError ? (
    <QueryError onRetry={() => void workflowsQuery.refetch()} />
  ) : list.length === 0 ? (
    <EmptyState
      actionLabel={t("workflows.addWorkflow")}
      description={t("workflows.emptyDescription")}
      glyph="flow"
      hint={t("workflows.emptyHint")}
      onAction={() => setAdding(true)}
      title={t("workflows.emptyTitle")}
    />
  ) : (
    <Stack gap="300">
      {groups.map((group) => (
        <Stack data-testid={ScreenTestId.Group} gap="150" key={group.department ?? ""}>
          <SectionLabel
            action={
              <Typography mono size="xs" type="note" variant="tertiary">
                {group.workflows.length}
              </Typography>
            }
            aria-level={2}
            role="heading"
          >
            {group.label}
          </SectionLabel>
          <Grid cols={1} gap="150" lg={3} md={2}>
            {group.workflows.map((p) => (
              <WorkflowCard
                agents={agents}
                key={p.id}
                onSelect={(id: string) => router.push(`${basePath}/${id}` as Route)}
                workflow={p}
              />
            ))}
          </Grid>
        </Stack>
      ))}
    </Stack>
  );

  // The full-page editor replaces the list while a workflow is open.
  if (routeId && workflowsQuery.isPending) return <QueryLoading />;
  if (selected) return <WorkflowDetailScreen basePath={basePath} workflow={selected} />;

  return (
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="250">
          <Stack wrap align="center" direction="row" gap="150" justify="between">
            <Typography type="h1">{t("workflows.title")}</Typography>
            <Button icon="plus" intent="primary" onClick={() => setAdding(true)}>
              {t("workflows.addWorkflow")}
            </Button>
          </Stack>

          {body}
        </Stack>
      </PageContainer>

      {addModal}
    </Container>
  );
}
