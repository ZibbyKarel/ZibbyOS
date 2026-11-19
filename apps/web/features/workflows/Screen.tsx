"use client";

import {
  Button,
  CardSkeleton,
  Container,
  EmptyState,
  ListHeader,
  type ListHeaderTone,
  ListSection,
  ListToolbar,
  type ListToolbarChip,
  Stack,
} from "@zibby/design-system";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { QueryError } from "../../components/LoadError/QueryError";
import { QueryLoading } from "../../components/LoadingState/QueryLoading";
import { useRunsQuery } from "../runs";
import { PageContainer } from "../../components/PageContainer/PageContainer";
import { useAgentsQuery } from "../agents";
import { useDepartmentLookup } from "../departments/useDepartmentLookup";
import { NewWorkflowDialog } from "./components/NewWorkflowDialog/NewWorkflowDialog";
import { WorkflowDetailScreen } from "./components/WorkflowEditor/WorkflowDetailScreen";
import { WorkflowListCard } from "./components/WorkflowListCard";
import { latestWorkflowRun, workflowMatches } from "./workflowListModel";
import { useCreateWorkflowMutation } from "./mutations";
import { groupWorkflowsByDepartment } from "./groupWorkflowsByDepartment";
import { useWorkflowsQuery } from "./queries";

export enum ScreenTestId {
  Group = "workflows-group",
  Skeletons = "workflows-skeletons",
  Empty = "workflows-empty",
  NoMatch = "workflows-no-match",
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
  const { runs } = useRunsQuery();
  const [now] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const latest = useMemo(
    () => new Map(list.map((w) => [w.id, latestWorkflowRun(runs, w.id)] as const)),
    [list, runs],
  );
  const groups = useMemo(
    () =>
      groupWorkflowsByDepartment(
        list.filter(
          (w) =>
            (dept === "all" || (w.department ?? "none") === dept) &&
            workflowMatches(w, search, agents),
        ),
        (id) => departments.get(id)?.name,
        t("workflows.noDepartment"),
      ),
    [list, departments, t, search, dept, agents],
  );
  const chips: ListToolbarChip[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of list)
      counts.set(w.department ?? "none", (counts.get(w.department ?? "none") ?? 0) + 1);
    return [
      { id: "all", label: t("workflows.list.all"), count: list.length },
      ...[...counts].map(([id, count]) => ({
        id,
        label: departments.get(id)?.code ?? t("workflows.noDepartment"),
        count,
      })),
    ];
  }, [list, departments, t]);
  const runningCount = [...latest.values()].filter((r) => r?.status === "running").length;
  const waitingCount = [...latest.values()].filter(
    (r) => r && ["awaiting-approval", "held", "parked", "paused"].includes(r.status),
  ).length;
  const count: ListHeaderTone[] = [
    { text: t("workflows.list.count", { count: list.length }), tone: "plain" },
  ];
  if (runningCount > 0)
    count.push({ text: t("workflows.list.runningCount", { count: runningCount }), tone: "run" });
  if (waitingCount > 0)
    count.push({ text: t("workflows.list.waitingCount", { count: waitingCount }), tone: "warn" });
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
  const addButton = (
    <Button icon="plus" intent="ink" onClick={() => setAdding(true)}>
      {t("workflows.list.newWorkflow")}
    </Button>
  );
  const body = workflowsQuery.isPending ? (
    <Stack data-testid={ScreenTestId.Skeletons} gap="150">
      {[0, 1, 2].map((i) => (
        <CardSkeleton key={i} shape="wide" />
      ))}
    </Stack>
  ) : workflowsQuery.isError ? (
    <QueryError onRetry={() => void workflowsQuery.refetch()} />
  ) : list.length === 0 ? (
    <EmptyState
      action={addButton}
      body={t("workflows.emptyDescription")}
      data-testid={ScreenTestId.Empty}
      icon="flow"
      title={t("workflows.emptyTitle")}
    />
  ) : groups.length === 0 ? (
    <EmptyState
      body={t("workflows.list.noMatchBody")}
      data-testid={ScreenTestId.NoMatch}
      icon="search"
      title={t("workflows.list.noMatchTitle")}
    />
  ) : (
    <Stack gap="300">
      {groups.map((group) => (
        <Container data-testid={ScreenTestId.Group} key={group.department ?? ""}>
          <ListSection
            code={group.department ? departments.get(group.department)?.code : undefined}
            count={group.workflows.length}
            icon={group.department ? undefined : "flow"}
            title={group.label}
          >
            <Stack gap="150">
              {group.workflows.map((p) => (
                <WorkflowListCard
                  agents={agents}
                  departmentCode={p.department ? departments.get(p.department)?.code : undefined}
                  key={p.id}
                  now={now}
                  onOpen={(id: string) => router.push(`${basePath}/${id}` as Route)}
                  run={latest.get(p.id) ?? null}
                  workflow={p}
                />
              ))}
            </Stack>
          </ListSection>
        </Container>
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
          <ListHeader
            actions={addButton}
            count={count}
            route={basePath}
            section={t("workflows.list.section")}
            title={t("workflows.title")}
          />
          {list.length > 0 && (
            <ListToolbar
              activeChip={dept}
              chips={chips}
              onChipChange={setDept}
              search={{
                value: search,
                onChange: setSearch,
                placeholder: t("workflows.list.searchPlaceholder"),
              }}
            />
          )}
          {body}
        </Stack>
      </PageContainer>

      {addModal}
    </Container>
  );
}
