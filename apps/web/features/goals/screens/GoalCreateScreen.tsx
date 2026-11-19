"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Button,
  Container,
  DetailTable,
  Dropdown,
  Field,
  Grid,
  Icon,
  LoopDiagram,
  LoopDiagramNode,
  Panel,
  SegmentPickerField,
  SelectField,
  Stack,
  type SubNavLinkComponent,
  TextAreaField,
  TextInputField,
  Typography,
} from "@zibby/design-system";
import { PageBreadcrumb } from "../../../components/layout/PageBreadcrumb";
import { useAgentsQuery } from "../../agents";
import { useProjectsQuery } from "../../projects";
import { useRunsQuery } from "../../runs";
import { useCreateTaskMutation } from "../../tasks/mutations";
import { useWorkflowsQuery } from "../../workflows";
import { GoalLimitsFields } from "../components/GoalLimitsFields";
import { avgCostPerIteration, goalRunTaskBody, makeGoalId } from "../goal";
import { EMPTY_DRAFT, type GoalDraft, draftToCreate, isDraftValid } from "../goalDraft";
import { useCreateGoalMutation } from "../mutations";
import { useGoalsQuery } from "../queries";

/** `/work/goals/new` — the create form (objective, maker, verifier, limits, instructions) with a live loop preview. */
export function GoalCreateScreen() {
  const t = useTranslations("goalPage");
  const router = useRouter();
  const { data: agents = [] } = useAgentsQuery();
  const { data: workflows = [] } = useWorkflowsQuery();
  const { data: projects = [] } = useProjectsQuery();
  const { data: goals = [] } = useGoalsQuery();
  const { runs } = useRunsQuery();
  const createGoal = useCreateGoalMutation();
  const createTask = useCreateTaskMutation();
  const [draft, setDraft] = useState<GoalDraft>(EMPTY_DRAFT);
  const patch = (p: Partial<GoalDraft>) => setDraft((d) => ({ ...d, ...p }));

  const agentOptions = agents.map((a) => ({ value: a.id, label: a.displayName ?? a.name ?? a.id }));
  const workflowOptions = workflows.map((w) => ({ value: w.id, label: w.name }));
  const nameOf = (list: { value: string; label: string }[], id: string) =>
    list.find((o) => o.value === id)?.label ?? t("pick");

  const busy = createGoal.isPending || createTask.isPending;
  const valid = isDraftValid(draft);
  const submit = (startNow: boolean) => {
    const id = makeGoalId(draft.name || draft.objective, Date.now());
    const body = draftToCreate(draft, id);
    createGoal.mutate(
      { body },
      {
        onSuccess: () => {
          const open = () => router.push(`/work/goals/${id}` as Route);
          if (startNow) createTask.mutate({ body: goalRunTaskBody(body) }, { onSuccess: open });
          else open();
        },
      },
    );
  };

  const avg = draft.makerId ? avgCostPerIteration(runs, goals, draft.makerId) : undefined;
  const worstCase =
    avg !== undefined && draft.maxIterations
      ? `${t("iterationCount", { n: draft.maxIterations })} · ~$${(avg * draft.maxIterations).toFixed(2)}`
      : undefined;
  const makerOptions = draft.makerKind === "agent" ? agentOptions : workflowOptions;

  const sectionHeader = (icon: "shield" | "dollar", title: string) => (
    <Stack align="center" direction="row" gap="100">
      <Icon name={icon} size="sm" />
      {title}
    </Stack>
  );

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="250">
        <PageBreadcrumb
          items={[{ label: t("goals"), href: "/work/goals" }, { label: t("newGoal") }]}
          linkComponent={Link as SubNavLinkComponent}
        />
        <Grid gap="400" sidebar="right">
          <Stack gap="200">
            <Stack gap="50">
              <Typography type="h1">{t("newGoal")}</Typography>
              <Typography size="sm" type="bodySm" variant="tertiary">
                {t("newGoalIntro")}
              </Typography>
            </Stack>
            <TextAreaField
              hint={t("objectiveHint")}
              label={t("objective")}
              onChange={(e) => patch({ objective: e.target.value })}
              rows={3}
              size="sm"
              value={draft.objective}
            />
            <TextInputField
              hint={t("nameHint")}
              label={t("name")}
              onChange={(e) => patch({ name: e.target.value })}
              size="sm"
              value={draft.name}
            />
            <Grid cols={1} gap="300" md={2}>
              <Field label={t("project")}>
                {({ id }) => (
                  <Dropdown
                    plain
                    id={id}
                    onChange={(v) => patch({ projectId: v })}
                    options={[
                      { value: "", label: t("noProject") },
                      ...projects.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    value={draft.projectId}
                    variant="inline"
                  />
                )}
              </Field>
              <Stack gap="100">
                <SegmentPickerField
                  compact
                  label={t("maker")}
                  onValueChange={(v) =>
                    patch({ makerKind: v as GoalDraft["makerKind"], makerId: "" })
                  }
                  options={[
                    { value: "agent", label: t("kindAgent") },
                    { value: "workflow", label: t("kindWorkflow") },
                  ]}
                  value={draft.makerKind}
                />
                <Dropdown
                  plain
                  aria-label={t(draft.makerKind === "agent" ? "kindAgent" : "kindWorkflow")}
                  onChange={(v) => patch({ makerId: v })}
                  options={makerOptions}
                  placeholder={t("pick")}
                  value={draft.makerId}
                  variant="inline"
                />
              </Stack>
            </Grid>
            <Panel
              header={sectionHeader("shield", t("verifier"))}
              headerEnd={t("freshEachIteration")}
              headerRule={false}
              padding="200"
            >
              <Stack gap="150">
                <SelectField
                  label={t("verifierAgent")}
                  onValueChange={(v) => patch({ verifierAgent: v })}
                  options={agentOptions}
                  placeholder={t("pick")}
                  size="xs"
                  value={draft.verifierAgent}
                />
                <Grid cols={1} gap="150" md={2}>
                  <SegmentPickerField
                    compact
                    label={t("modelTier")}
                    onValueChange={(v) => patch({ verifierModel: v as GoalDraft["verifierModel"] })}
                    options={[
                      { value: "", label: t("agentDefault") },
                      { value: "sonnet", label: "sonnet" },
                      { value: "opus", label: "opus" },
                      { value: "fable", label: "fable" },
                    ]}
                    value={draft.verifierModel}
                  />
                  <SegmentPickerField
                    compact
                    label={t("thinking")}
                    onValueChange={(v) =>
                      patch({ verifierThinking: v as GoalDraft["verifierThinking"] })
                    }
                    options={[
                      { value: "", label: t("agentDefault") },
                      { value: "low", label: "low" },
                      { value: "medium", label: "medium" },
                      { value: "high", label: "high" },
                    ]}
                    value={draft.verifierThinking}
                  />
                </Grid>
              </Stack>
            </Panel>
            <Panel header={sectionHeader("dollar", t("limits"))} headerRule={false} padding="200">
              <GoalLimitsFields columns={3} draft={draft} onChange={patch} />
            </Panel>
            <TextAreaField
              hint={t("instructionsHint")}
              label={t("instructionsForMaker")}
              onChange={(e) => patch({ instructions: e.target.value })}
              rows={3}
              size="sm"
              value={draft.instructions}
            />
            <Stack wrap align="center" direction="row" gap="100" justify="end">
              <Button intent="ghost" onClick={() => router.push("/work/goals" as Route)}>
                {t("cancel")}
              </Button>
              <Button disabled={!valid || busy} intent="ghost" onClick={() => submit(false)}>
                {t("create")}
              </Button>
              <Button
                disabled={!valid || busy}
                icon="play"
                intent="ink"
                onClick={() => submit(true)}
              >
                {t("createAndStart")}
              </Button>
            </Stack>
          </Stack>
          <Stack gap="150">
            <Typography uppercase size="xs" type="note" variant="tertiary">
              {t("preview")}
            </Typography>
            <LoopDiagram
              board
              mini
              backLabel={t("verdictRetry")}
              count={`0 / ${draft.maxIterations ?? "?"}`}
              countLabel={t("iteration")}
              forwardLabel={t("resultJudge")}
              maker={
                <LoopDiagramNode
                  mini
                  kicker={t("maker")}
                  leading={<Icon name={draft.makerKind === "agent" ? "bot" : "flow"} size="sm" />}
                  title={nameOf(makerOptions, draft.makerId)}
                />
              }
              verifier={
                <LoopDiagramNode
                  mini
                  kicker={t("verifier")}
                  leading={<Icon name="shield" size="sm" />}
                  subtitle={t("freshVerifier")}
                  title={nameOf(agentOptions, draft.verifierAgent)}
                />
              }
            />
            <Panel padding="200">
              <DetailTable
                rows={[
                  ...(worstCase ? [{ cells: [t("worstCase"), worstCase] }] : []),
                  { cells: [t("parksWhen"), t("parksWhenBody")] },
                ]}
              />
            </Panel>
          </Stack>
        </Grid>
      </Stack>
    </Container>
  );
}
