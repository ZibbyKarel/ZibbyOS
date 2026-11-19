"use client";

import type { Agent } from "@zibby/contracts";
import {
  Button,
  CardSkeleton,
  Container,
  EmptyState,
  Grid,
  ListHeader,
  type ListHeaderTone,
  ListSection,
  ListToolbar,
  type ListToolbarChip,
  Stack,
} from "@zibby/design-system";
import type { Route } from "next";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { QueryError } from "../../../components/LoadError/QueryError";
import { PageContainer } from "../../../components/PageContainer/PageContainer";
import { useEngineBadge } from "../../ai-providers";
import { useDepartmentLookup } from "../../departments/useDepartmentLookup";
import { registryHref } from "../../registries/registryKinds";
import { useRunsQuery } from "../../runs";
import { useWorkflowsQuery } from "../../workflows/queries";
import { agentMatches, agentPresence, agentWeekStats } from "../agentListModel";
import { workflowsUsingAgent } from "../components/agentWorkflows";
import { AgentPortraitCard } from "../components/AgentPortraitCard";
import { groupAgentsByDepartment } from "../components/groupAgentsByDepartment";
import { useAgentsQuery } from "../queries";

export enum AgentsScreenTestId {
  /** Suffixed with the department id, or `none` for the trailing section. */
  Section = "agents-screen-section",
  Skeletons = "agents-screen-skeletons",
  Empty = "agents-screen-empty",
  NoMatch = "agents-screen-no-match",
  Create = "agents-screen-create",
}

const ENGINE_ORDER = ["claude", "openai", "opencode"] as const;

/** `/workforce/agents`: department-grouped portrait cards with live status, filter chips and search. */
export function AgentsScreen() {
  const t = useTranslations("agents");
  const locale = useLocale();
  const router = useRouter();
  const departments = useDepartmentLookup();
  const engineBadge = useEngineBadge();
  const tEngine = useTranslations("aiEngine.badge");
  const query = useAgentsQuery();
  const { runs, isPending: runsPending } = useRunsQuery();
  const { data: workflows = [] } = useWorkflowsQuery();
  const [search, setSearch] = useState("");
  const [engine, setEngine] = useState("all");
  const [now] = useState(() => Date.now());

  const agents = query.data;
  const engineOf = (a: Agent) => engineBadge(a).engine;

  const live = useMemo(
    () => new Map((agents ?? []).map((a) => [a.id, agentPresence(runs, a.id)] as const)),
    [agents, runs],
  );

  const chips: ListToolbarChip[] = useMemo(() => {
    const all = agents ?? [];
    const counts = new Map<string, number>();
    for (const a of all) counts.set(engineOf(a), (counts.get(engineOf(a)) ?? 0) + 1);
    return [
      { id: "all", label: t("list.all"), count: all.length },
      ...ENGINE_ORDER.filter((e) => counts.has(e)).map((e) => ({
        id: e,
        label: tEngine(e),
        count: counts.get(e) ?? 0,
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- engineOf/engineBadge are stable per render
  }, [agents, t, tEngine]);

  const create = (
    <Button
      data-testid={AgentsScreenTestId.Create}
      icon="plus"
      intent="ink"
      onClick={() => router.push("/workforce/agents/new" as Route)}
    >
      {t("list.newAgent")}
    </Button>
  );

  const filtered = (agents ?? []).filter(
    (a) => (engine === "all" || engineOf(a) === engine) && agentMatches(a, search),
  );
  const sections = groupAgentsByDepartment(filtered, [...departments.list], locale);

  const working = [...live.values()].filter((l) => l.presence === "working").length;
  const failing = [...live.values()].filter((l) => l.presence === "error").length;
  const count: ListHeaderTone[] = [];
  if (agents) {
    const deptCount = new Set(agents.map((a) => a.department).filter(Boolean)).size;
    count.push({
      text: t("list.count", { count: agents.length, depts: Math.max(1, deptCount) }),
      tone: "plain",
    });
    if (working > 0) count.push({ text: t("list.working", { count: working }), tone: "run" });
    if (failing > 0) count.push({ text: t("list.failing", { count: failing }), tone: "bad" });
  }

  let body;
  if (query.isPending) {
    body = (
      <Grid cols={2} data-testid={AgentsScreenTestId.Skeletons} gap="150" lg={4} md={3}>
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} shape="portrait" />
        ))}
      </Grid>
    );
  } else if (query.isError) {
    body = <QueryError onRetry={() => void query.refetch()} />;
  } else if ((agents ?? []).length === 0) {
    body = (
      <EmptyState
        action={create}
        body={t("emptyDescription")}
        data-testid={AgentsScreenTestId.Empty}
        icon="bot"
        title={t("emptyTitle")}
      />
    );
  } else if (sections.length === 0) {
    body = (
      <EmptyState
        body={t("list.noMatchBody")}
        data-testid={AgentsScreenTestId.NoMatch}
        icon="search"
        title={t("list.noMatchTitle")}
      />
    );
  } else {
    body = (
      <Stack gap="300">
        {sections.map(({ departmentId, agents: inSection }) => {
          const department = departmentId ? departments.get(departmentId) : undefined;
          return (
            <Container
              data-testid={`${AgentsScreenTestId.Section}-${departmentId ?? "none"}`}
              key={departmentId ?? "none"}
            >
              <ListSection
                code={department?.code}
                count={inSection.length}
                icon={department ? undefined : "users"}
                title={department?.name ?? t("noDepartment")}
              >
                <Grid cols={2} gap="150" lg={4} md={3}>
                  {inSection.map((agent) => (
                    <AgentPortraitCard
                      agent={agent}
                      department={department}
                      key={agent.id}
                      onOpen={(a) => router.push(registryHref("agents", a.id) as Route)}
                      presence={live.get(agent.id)?.presence ?? "idle"}
                      stats={runsPending ? undefined : agentWeekStats(runs, agent.id, now)}
                      task={live.get(agent.id)?.task}
                      workflowCount={workflowsUsingAgent(workflows, agent).length}
                    />
                  ))}
                </Grid>
              </ListSection>
            </Container>
          );
        })}
      </Stack>
    );
  }

  return (
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="250">
          <ListHeader
            actions={create}
            count={count}
            route="/workforce/agents"
            section={t("list.section")}
            title={t("title")}
          />
          {(agents ?? []).length > 0 && (
            <ListToolbar
              activeChip={engine}
              chips={chips}
              onChipChange={setEngine}
              search={{
                value: search,
                onChange: setSearch,
                placeholder: t("list.searchPlaceholder"),
              }}
            />
          )}
          {body}
        </Stack>
      </PageContainer>
    </Container>
  );
}
