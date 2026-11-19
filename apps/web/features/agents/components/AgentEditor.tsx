"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDetailT } from "../useDetailT";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import {
  Alert,
  Button,
  Container,
  Dialog,
  Grid,
  Stack,
  type SubNavLinkComponent,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Tag,
  Typography,
  UnsavedBar,
} from "@zibby/design-system";
import type { Agent, GateRuleInput } from "@zibby/contracts";
import { useFormControls } from "@zibby/forms";
import { PageBreadcrumb } from "../../../components/layout/PageBreadcrumb";
import { PageContainer } from "../../../components/PageContainer/PageContainer";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { apiErrorMessage } from "../../../state/apiErrorMessage";
import { isOperatorTokenError } from "../../../state/operatorToken";
import { slug } from "../../../utils/slug";
import { OperatorTokenNotice, useEngineBadge } from "../../ai-providers";
import { useDepartmentLookup } from "../../departments/useDepartmentLookup";
import { RuleModal } from "../../gates/components/RuleModal";
import { PinButton } from "../../pins";
import { useRunsQuery } from "../../runs";
import { useNewTask } from "../../tasks";
import { useWorkflowsQuery } from "../../workflows";
import { aggregateAgentRuns } from "../agentRunStats";
import { agentFile } from "../agentDraft";
import { AgentDetailScreenTestId as TestId } from "../agentTestIds";
import { useLeaveGuard } from "../useLeaveGuard";
import {
  useCreateAgentMutation,
  useDeleteAgentMutation,
  useUpdateAgentMutation,
} from "../mutations";
import { useAgentsQuery, useCategoriesQuery } from "../queries";
import { AgentDeleteDialog } from "./AgentDeleteDialog";
import { AgentHero } from "./AgentHero";
import { AgentInstructionsCard } from "./AgentInstructionsCard";
import { AgentRulesSection } from "./AgentRulesSection";
import { AgentRunsTab } from "./AgentRunsTab";
import { EngineCard, IdentityCard, RoutingCard, ToolsCard } from "./AgentSideCards";
import { AgentUsedInTab } from "./AgentUsedInTab";
import { workflowsUsingAgent } from "./agentWorkflows";
import {
  type AgentEditValues,
  type AgentSection,
  ROUTING_LIMIT,
  applyFormValues,
  dirtySections,
  ownRuleToInitial,
  toFormValues,
} from "./agentEditValues";

/** The Markdown skeleton a new agent starts with (the body is never synthesised server-side). */
const NEW_AGENT_BODY = `You are … (one sentence: who you are and what you own).

## Do
- …

## Don't
- …

## Output
Describe the exact shape of your final answer.
`;

export interface AgentEditorProps {
  /** The saved agent — or the blank draft when `isNew`. */
  agent: Agent;
  isNew?: boolean;
}

/**
 * The agent profile, shared by `/workforce/agents/:id` and `/workforce/agents/new`: hero,
 * instructions as the main column, four sticky settings cards, and tabs below (Rules,
 * Used in workflows, Runs & stats). One react-hook-form instance owns every field; the
 * unsaved bar, dirty dots, Cmd+S and the leave guard all derive from comparing it with the
 * last saved values. Below the `md` breakpoint it collapses to Instructions / Settings /
 * Rules / Usage tabs.
 */
export function AgentEditor({ agent, isNew = false }: AgentEditorProps) {
  const t = useTranslations("agents");
  const td = useDetailT();
  const router = useRouter();
  const phone = useIsPhone();
  const departments = useDepartmentLookup();
  const engineBadge = useEngineBadge();
  const { open: openNewTask } = useNewTask();
  const { data: categories = [] } = useCategoriesQuery();
  const { data: workflows = [] } = useWorkflowsQuery();
  const { data: agents = [] } = useAgentsQuery();
  const { runs, isPending: runsPending } = useRunsQuery();
  const createAgent = useCreateAgentMutation();
  const updateAgent = useUpdateAgentMutation();
  const deleteAgent = useDeleteAgentMutation();

  const [confirmDelete, setConfirmDelete] = useState(false);
  /** The API refused the save with 401 (engine writes need the operator token). */
  const [tokenRefused, setTokenRefused] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();
  /** The own-rule being edited: an index, "new", or null when the editor is closed. */
  const [editingRule, setEditingRule] = useState<number | "new" | null>(null);
  const [tab, setTab] = useState("rules");
  const [phoneTab, setPhoneTab] = useState("instructions");
  /** Bumped on Discard so uncontrolled-by-form widgets (CSV drafts, editor) remount clean. */
  const [formKey, setFormKey] = useState(0);
  /** Whether the file name still follows the display name (new agents only). */
  const [nameManual, setNameManual] = useState(false);

  const initial = useMemo<AgentEditValues>(
    () =>
      isNew
        ? { ...toFormValues(agent), instructions: NEW_AGENT_BODY, name: "", department: "dev" }
        : toFormValues(agent),
    // The editor is keyed by agent id; the initial values are captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [saved, setSaved] = useState(initial);

  const { renderForm, submit, form } = useFormControls<AgentEditValues>({
    defaultValues: initial,
    onSubmit: (values) => {
      setTokenRefused(false);
      setSaveError(undefined);
      if (isNew) {
        const id = slug(values.name, { maxLength: 128 });
        createAgent.mutate(
          { body: { ...applyFormValues(agent, values), id } },
          {
            onSuccess: () => {
              setSaved(values);
              router.push(`/workforce/agents/${id}`);
            },
            onError: (e) => setSaveError(apiErrorMessage(e) ?? td("saveFailed")),
          },
        );
        return;
      }
      const { id, ...body } = applyFormValues(agent, values);
      // `null` (not absent) is what clears the override back to the global engine.
      updateAgent.mutate(
        {
          params: { id },
          body: { ...body, engine: body.engine ?? null, engineModel: body.engineModel ?? null },
        },
        {
          onSuccess: () => {
            setSaved(values);
            form.reset(values);
          },
          onError: (error) => {
            if (isOperatorTokenError(error)) {
              // A refused write must not leave the form showing an engine the server never took.
              setTokenRefused(true);
              form.setValue("engine", agent.engine ?? "");
              form.setValue("engineModel", agent.engineModel ?? "");
            } else setSaveError(apiErrorMessage(error) ?? td("saveFailed"));
          },
        },
      );
    },
  });

  const values = form.watch();
  const sections = useMemo(() => dirtySections(saved, values), [saved, values]);
  const dirtyAt = (s: AgentSection) => sections.includes(s);
  const dirty = sections.length > 0;
  const pending = createAgent.isPending || updateAgent.isPending;

  // New agents: the file name follows the display name until it is edited by hand.
  const displayName = values.displayName;
  const currentName = values.name;
  const derivedName = useRef("");
  useEffect(() => {
    if (!isNew || nameManual) return;
    const next = slug(displayName, { maxLength: 128 });
    if (currentName === next) return;
    if (currentName === derivedName.current) {
      derivedName.current = next;
      form.setValue("name", next);
    } else setNameManual(true);
  }, [isNew, nameManual, displayName, currentName, form]);

  const newId = slug(values.name ?? "", { maxLength: 128 });
  const nameTaken = isNew && newId !== "" && agents.some((a) => a.id === newId);
  const nameError = nameTaken ? td("nameTaken") : undefined;
  const routingError =
    values.description.length > ROUTING_LIMIT
      ? td("routingOver", { count: values.description.length - ROUTING_LIMIT, max: ROUTING_LIMIT })
      : undefined;
  const hasContent = values.instructions.trim().length > 0 && values.name.trim().length > 0;
  const canSubmit = hasContent && !nameError && !routingError && values.department.length > 0;

  const trigger = () => {
    if (canSubmit && (isNew || dirty) && !pending) void submit();
  };
  // Cmd/Ctrl+S saves (or creates) without leaving the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        trigger();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const leave = useLeaveGuard(dirty && !pending);
  const discard = () => {
    form.reset(saved);
    setFormKey((k) => k + 1);
    setSaveError(undefined);
    setTokenRefused(false);
  };

  const gates = values.gates ?? [];
  const setGates = (next: GateRuleInput[]) => form.setValue("gates", next, { shouldDirty: true });
  const saveRule = (gate: GateRuleInput) => {
    setGates(
      editingRule === "new"
        ? [...gates, gate]
        : gates.map((g, i) => (i === editingRule ? gate : g)),
    );
    setEditingRule(null);
  };

  const id = agent.id;
  const uses = useMemo(
    () => workflowsUsingAgent(workflows, { id, name: agent.name }),
    [workflows, id, agent.name],
  );
  const stats = useMemo(() => aggregateAgentRuns(runs, id), [runs, id]);

  const title = values.displayName || values.name;
  const fileName = `${isNew ? newId || "new" : id}.agent.md`;
  const globalEngineBadge = engineBadge({
    engine: values.engine || undefined,
    engineModel: values.engineModel,
    model: values.model,
  });
  const dept = values.department
    ? { id: values.department, name: departments.name(values.department) }
    : undefined;

  const duplicate = () => {
    const base = agent.name ?? agent.id;
    const taken = new Set(agents.map((a) => a.id));
    let n = 1;
    let copyId = slug(`${base}-copy`, { maxLength: 128 });
    while (taken.has(copyId)) copyId = slug(`${base}-copy-${++n}`, { maxLength: 128 });
    createAgent.mutate(
      {
        body: {
          ...agent,
          id: copyId,
          name: copyId,
          displayName: agent.displayName ? `${agent.displayName} (copy)` : undefined,
        },
      },
      { onSuccess: () => router.push(`/workforce/agents/${copyId}`) },
    );
  };

  const instructions = (
    <AgentInstructionsCard
      dirty={dirtyAt("instructions")}
      fileName={fileName}
      key={formKey}
      value={values.instructions}
    />
  );
  const settings = (
    <Stack gap="150" key={formKey}>
      <IdentityCard
        categories={categories}
        control={form.control}
        dirty={dirtyAt("identity")}
        nameError={nameError}
        nameLocked={!isNew}
      />
      <RoutingCard control={form.control} dirty={dirtyAt("routing")} error={routingError} />
      <EngineCard control={form.control} dirty={dirtyAt("engine")} />
      <ToolsCard control={form.control} dirty={dirtyAt("tools")} />
    </Stack>
  );

  const rulesCount = gates.length + values.gateRuleIds.length;
  const rules = (
    <AgentRulesSection
      agentName={title || t("newAgent")}
      gateRuleIds={values.gateRuleIds}
      gates={gates}
      onAddRule={() => setEditingRule("new")}
      onDeleteRule={(i) => setGates(gates.filter((_, j) => j !== i))}
      onEditRule={(i) => setEditingRule(i)}
      onLinkedChange={(ids) => form.setValue("gateRuleIds", ids, { shouldDirty: true })}
    />
  );
  const used = <AgentUsedInTab uses={uses} />;
  const runsTab = <AgentRunsTab loading={runsPending} stats={stats} />;

  const label = (text: string, n: number) => (
    <Stack align="center" direction="row" gap="75">
      {text}
      <Tag>{n}</Tag>
    </Stack>
  );

  const body = phone ? (
    <Tabs onValueChange={setPhoneTab} value={phoneTab}>
      <TabList>
        <Tab value="instructions">{td("tabInstructions")}</Tab>
        <Tab value="settings">{td("tabSettings")}</Tab>
        <Tab value="rules">{label(t("tabRules"), rulesCount)}</Tab>
        {!isNew && <Tab value="usage">{td("tabUsage")}</Tab>}
      </TabList>
      <Container padding={["150", "0", "0", "0"]}>
        <TabPanel value="instructions">{instructions}</TabPanel>
        <TabPanel value="settings">{settings}</TabPanel>
        <TabPanel value="rules">{rules}</TabPanel>
        <TabPanel value="usage">
          <Stack gap="250">
            {used}
            {runsTab}
          </Stack>
        </TabPanel>
      </Container>
    </Tabs>
  ) : (
    <Stack gap="250">
      <Grid align="start" gap="250" sidebar="right">
        {instructions}
        <Container position="sticky" top="16px">
          {settings}
        </Container>
      </Grid>
      <Tabs onValueChange={setTab} value={tab}>
        <TabList>
          <Tab value="rules">{label(t("tabRules"), rulesCount)}</Tab>
          {!isNew && <Tab value="used">{label(t("usedInWorkflows"), uses.length)}</Tab>}
          {!isNew && <Tab value="runs">{label(td("tabRuns"), stats.runs)}</Tab>}
        </TabList>
        <Container padding={["200", "0", "0", "0"]}>
          <TabPanel value="rules">{rules}</TabPanel>
          <TabPanel value="used">{used}</TabPanel>
          <TabPanel value="runs">{runsTab}</TabPanel>
        </Container>
      </Tabs>
    </Stack>
  );

  return renderForm(
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="250">
          <Stack align="center" direction="row" gap="150" justify="between">
            <PageBreadcrumb
              items={[
                { label: t("title"), href: "/workforce/agents" },
                { label: isNew ? t("newAgent") : title },
              ]}
              linkComponent={Link as SubNavLinkComponent}
            />
            {!isNew && <PinButton id={agent.id} kind="agent" />}
          </Stack>

          <AgentHero
            avatar={agent.avatar}
            canSubmit={canSubmit}
            chips={{
              model: values.model,
              thinking: td("thinkingChip", { level: values.thinking }),
              engine: globalEngineBadge.label,
            }}
            department={isNew ? undefined : dept}
            dirty={dirty}
            engineBadge={globalEngineBadge}
            fileName={fileName}
            glyph={values.glyph || "bot"}
            isNew={isNew}
            onCancel={() => router.push("/workforce/agents")}
            onDelete={() => setConfirmDelete(true)}
            onDuplicate={duplicate}
            onRun={() =>
              openNewTask(undefined, { kind: "agent", id: agent.id, name: title, glyph: "bot" })
            }
            onSubmit={trigger}
            role={values.title}
            saving={pending}
            title={title}
          />

          {tokenRefused && <OperatorTokenNotice />}
          {isNew && saveError && (
            <Alert severity="error" title={td("createFailed")}>
              {saveError}
            </Alert>
          )}

          {body}
        </Stack>
      </PageContainer>

      {!isNew && dirty && (
        <UnsavedBar
          discardLabel={td("discard")}
          error={saveError}
          items={sections.map((s) => td(`section.${s}`))}
          onDiscard={discard}
          onSave={trigger}
          saveDisabled={!canSubmit}
          saveLabel={td("save")}
          saving={pending}
          shortcut="⌘S"
          title={td("unsavedCount", { count: sections.length })}
        />
      )}

      {confirmDelete && (
        <AgentDeleteDialog
          breaks={uses}
          file={agentFile(agent.id)}
          name={title}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            deleteAgent.mutate(
              { params: { id: agent.id } },
              { onSuccess: () => router.push("/workforce/agents") },
            )
          }
          pending={deleteAgent.isPending}
        />
      )}

      {leave.pending && (
        <Dialog
          open
          actions={
            <>
              <Button data-testid={TestId.LeaveStay} intent="ghost" onClick={leave.stay}>
                {td("stay")}
              </Button>
              <Button
                data-testid={TestId.LeaveDiscard}
                intent="danger"
                onClick={() => {
                  const to = leave.pending!;
                  // Reset first: the guard disarms once nothing is dirty, so the push is not re-caught.
                  setSaved(values);
                  leave.stay();
                  router.push(to as Route);
                }}
              >
                {td("discardLeave")}
              </Button>
            </>
          }
          onClose={leave.stay}
          title={td("leaveTitle")}
          width="sm"
        >
          <Typography data-testid={TestId.LeaveDialog} size="base" type="note" variant="secondary">
            {td("leaveBody", { count: sections.length })}
          </Typography>
        </Dialog>
      )}

      {editingRule !== null && (
        <RuleModal
          initial={
            typeof editingRule === "number" ? ownRuleToInitial(gates[editingRule]!) : undefined
          }
          onClose={() => setEditingRule(null)}
          onSave={(rule) =>
            saveRule({
              match: rule.match,
              decision: rule.decision,
              ...(rule.resolve ? { resolve: rule.resolve } : {}),
            })
          }
        />
      )}
    </Container>,
  );
}
