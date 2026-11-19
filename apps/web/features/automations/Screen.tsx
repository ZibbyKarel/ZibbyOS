"use client";

import { type Automation, automationTakesPrompt } from "@zibby/contracts";
import {
  Alert,
  Button,
  CardSkeleton,
  Container,
  DenseRowList,
  EmptyState,
  Grid,
  type IconName,
  ListHeader,
  type ListHeaderTone,
  ListSection,
  ListToolbar,
  Stack,
  TextLink,
  Typography,
} from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NavLink } from "../../components/layout/AppShell/NavLink";
import { QueryError } from "../../components/LoadError/QueryError";
import { PageContainer } from "../../components/PageContainer/PageContainer";
import { useApprovalsQuery } from "../approvals/queries";
import { useAgentsQuery } from "../agents/queries";
import { useWorkflowsQuery } from "../workflows/queries";
import { AutomationCard } from "./components/AutomationCard";
import { AutomationFormDialog } from "./components/AutomationFormDialog";
import { AutomationSystemRow } from "./components/AutomationSystemRow";
import { RunAutomationDialog } from "./components/RunAutomationDialog";
import { type AutomationFilter, automationMatches, nextRunMs } from "./automationListModel";
import {
  useCreateAutomationMutation,
  useTriggerAutomationMutation,
  useUpdateAutomationMutation,
} from "./mutations";
import { useAutomationsQuery } from "./queries";
import { relativeLabel } from "./schedule";

export enum ScreenTestId {
  Skeletons = "automations-skeletons",
  Empty = "automations-empty",
  NoMatch = "automations-no-match",
  Approvals = "automations-approvals-note",
  CronSection = "automations-cron-section",
  EventSection = "automations-event-section",
  SystemSection = "automations-system-section",
}

export function Screen() {
  const t = useTranslations("automations");
  const router = useRouter();
  const automationsQuery = useAutomationsQuery();
  // One list for everything: the operator's own automations as cards, the
  // server-seeded system ones in their own block below.
  const all = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);
  const automations = all.filter((a) => !a.system);
  const systemAutomations = all.filter((a) => a.system);
  const locale = useLocale();
  const { data: agents = [] } = useAgentsQuery();
  const approvals = useApprovalsQuery().data;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AutomationFilter>("all");
  const [now] = useState(() => Date.now());
  const { data: workflows = [] } = useWorkflowsQuery();
  const create = useCreateAutomationMutation();
  const update = useUpdateAutomationMutation();
  const trigger = useTriggerAutomationMutation();
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  /** Prompt-taking targets ask for an optional one-off prompt first; the rest fire at once. */
  const runAutomation = (automation: Automation) =>
    automationTakesPrompt(automation.target)
      ? setRunningId(automation.id)
      : trigger.mutate({ params: { id: automation.id }, body: {} });

  /** Resolve a target id to its display name + glyph for the card. */
  const resolveTarget = (automation: Automation): { name?: string; glyph?: IconName } => {
    const { target } = automation;
    if (target.type === "agent") {
      const agent = agents.find((a) => a.id === target.agentId);
      return { name: agent?.name ?? target.agentId, glyph: (agent?.glyph as IconName) ?? "bot" };
    }
    if (target.type === "workflow") {
      const workflow = workflows.find((p) => p.id === target.workflowId);
      return { name: workflow?.name ?? target.workflowId, glyph: "flow" };
    }
    if (target.type === "memory-distill") return { glyph: "brain" };
    if (target.type === "self-knowledge") return { glyph: "brain" };
    if (target.type === "vault-lint") return { glyph: "brain" };
    if (target.type === "slack-digest") return { glyph: "chat" };
    if (target.type === "security-scan") return { glyph: "shield" };
    if (target.type === "arch-audit") return { glyph: "code" };
    if (target.type === "task") {
      const kind = target.target?.kind;
      const glyph: IconName = kind === "agent" ? "bot" : kind === "workflow" ? "flow" : "spark";
      return { name: target.target?.name ?? t("targetTask"), glyph };
    }
    return { glyph: "spark" };
  };

  // Grammar (N4f): the dialog only births the automation; editing lives on the
  // detail page — navigate straight to it after the create lands.
  const onCreate = (body: Omit<Automation, "lastFiredAt" | "system">) => {
    create.mutate(
      { body },
      {
        onSuccess: () => {
          setCreating(false);
          router.push(`/work/automations/${body.id}`);
        },
      },
    );
  };

  const renderCard = (automation: Automation) => {
    const { name, glyph } = resolveTarget(automation);
    return (
      <AutomationCard
        automation={automation}
        key={automation.id}
        onEdit={() => router.push(`/work/automations/${automation.id}`)}
        onToggle={() =>
          update.mutate({ params: { id: automation.id }, body: { enabled: !automation.enabled } })
        }
        onTrigger={() => runAutomation(automation)}
        targetGlyph={glyph}
        targetName={name}
        triggering={trigger.isPending}
      />
    );
  };

  const visible = (list: Automation[]) => list.filter((a) => automationMatches(a, filter, search));
  const cronAutomations = visible(automations.filter((a) => a.trigger.type === "cron"));
  // Signal triggers fire on an outside event too, so they share the event section.
  const eventAutomations = visible(automations.filter((a) => a.trigger.type !== "cron"));
  const systemVisible = visible(systemAutomations);
  const matched = cronAutomations.length + eventAutomations.length + systemVisible.length;

  const chips = useMemo(
    () => [
      { id: "all", label: t("list.all"), count: all.length },
      { id: "on", label: t("list.on"), count: all.filter((a) => a.enabled).length },
      { id: "off", label: t("list.off"), count: all.filter((a) => !a.enabled).length },
    ],
    [all, t],
  );

  const nextMs = useMemo(() => {
    const times = all
      .map((a) => nextRunMs(a, new Date(now)))
      .filter((n): n is number => n !== null);
    return times.length ? Math.min(...times) : null;
  }, [all, now]);
  const count: ListHeaderTone[] = [];
  if (automationsQuery.data) {
    count.push({ text: t("list.triggers", { count: automations.length }), tone: "plain" });
    count.push({
      text: t("list.enabledCount", { count: all.filter((a) => a.enabled).length }),
      tone: "plain",
    });
    if (systemAutomations.length > 0)
      count.push({
        text: t("list.systemCount", { count: systemAutomations.length }),
        tone: "plain",
      });
    if (nextMs !== null)
      count.push({
        text: t("list.nextRunIn", { when: relativeLabel(nextMs, now, locale) }),
        tone: "plain",
      });
  }

  const addButton = (
    <Button icon="plus" intent="ink" onClick={() => setCreating(true)}>
      {t("list.newAutomation")}
    </Button>
  );

  // Honest load states (Phase 18.2): a pending/failed automations fetch must never
  // read as an empty workspace.
  const body = automationsQuery.isPending ? (
    <Grid cols={1} data-testid={ScreenTestId.Skeletons} gap="150" lg={2}>
      {[0, 1, 2, 3].map((i) => (
        <CardSkeleton key={i} shape="card" />
      ))}
    </Grid>
  ) : automationsQuery.isError ? (
    <QueryError onRetry={() => void automationsQuery.refetch()} />
  ) : all.length === 0 ? (
    <EmptyState
      action={addButton}
      body={t("emptyDescription")}
      data-testid={ScreenTestId.Empty}
      icon="clock"
      title={t("emptyTitle")}
    />
  ) : matched === 0 ? (
    <EmptyState
      body={t("list.noMatchBody")}
      data-testid={ScreenTestId.NoMatch}
      icon="search"
      title={t("list.noMatchTitle")}
    />
  ) : (
    <Stack gap="300">
      {cronAutomations.length > 0 && (
        <Container data-testid={ScreenTestId.CronSection}>
          <ListSection
            count={cronAutomations.length}
            hint="cron"
            icon="clock"
            title={t("list.cronTitle")}
          >
            <Grid cols={1} gap="150" lg={2}>
              {cronAutomations.map(renderCard)}
            </Grid>
          </ListSection>
        </Container>
      )}
      {eventAutomations.length > 0 && (
        <Container data-testid={ScreenTestId.EventSection}>
          <ListSection
            count={eventAutomations.length}
            hint="event"
            icon="bolt"
            title={t("list.eventTitle")}
          >
            <Grid cols={1} gap="150" lg={2}>
              {eventAutomations.map(renderCard)}
            </Grid>
          </ListSection>
        </Container>
      )}
      {systemVisible.length > 0 && (
        <Container data-testid={ScreenTestId.SystemSection}>
          <ListSection count={systemVisible.length} icon="gear" title={t("list.systemTitle")}>
            <Stack gap="100">
              <Typography leading="snug" size="caption" type="note" variant="tertiary">
                {t("systemHint")}
              </Typography>
              <DenseRowList>
                {systemVisible.map((automation) => (
                  <AutomationSystemRow
                    automation={automation}
                    key={automation.id}
                    onEdit={() => router.push(`/work/automations/${automation.id}`)}
                    onToggle={() =>
                      update.mutate({
                        params: { id: automation.id },
                        body: { enabled: !automation.enabled },
                      })
                    }
                    onTrigger={() => runAutomation(automation)}
                    triggering={trigger.isPending}
                  />
                ))}
              </DenseRowList>
            </Stack>
          </ListSection>
        </Container>
      )}
    </Stack>
  );

  return (
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="250">
          <ListHeader
            actions={addButton}
            count={count}
            route="/work/automations"
            section={t("list.section")}
            title={t("title")}
          />
          {all.length > 0 && (
            <ListToolbar
              activeChip={filter}
              chips={chips}
              onChipChange={(id) => setFilter(id as AutomationFilter)}
              search={{
                value: search,
                onChange: setSearch,
                placeholder: t("list.searchPlaceholder"),
              }}
            />
          )}
          {!automationsQuery.isPending && !automationsQuery.isError && all.length > 0 && (
            <Container data-testid={ScreenTestId.Approvals}>
              <Alert severity="warn">
                <Stack align="center" direction="row" gap="150" justify="between">
                  <Typography size="caption" type="note" variant="secondary">
                    {t("list.approvalsNote")}
                  </Typography>
                  <TextLink href="/governance/approvals" linkComponent={NavLink}>
                    <Typography size="caption" tone="accent" type="note" weight="semibold">
                      {approvals && approvals.length > 0
                        ? t("list.approvalsLinkCount", { count: approvals.length })
                        : t("list.approvalsLink")}{" "}
                      →
                    </Typography>
                  </TextLink>
                </Stack>
              </Alert>
            </Container>
          )}
          {body}
        </Stack>
      </PageContainer>

      {creating && <AutomationFormDialog onClose={() => setCreating(false)} onCreate={onCreate} />}
      {runningId && (
        <RunAutomationDialog automationId={runningId} onClose={() => setRunningId(null)} />
      )}
    </Container>
  );
}
