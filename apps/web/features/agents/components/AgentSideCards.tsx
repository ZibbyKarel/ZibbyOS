"use client";

import { type ReactNode, useState } from "react";
import { useTranslations } from "next-intl";
import { useDetailT } from "../useDetailT";
import {
  Button,
  ButtonGroup,
  Container,
  Grid,
  type IconName,
  IconTile,
  Panel,
  Stack,
  TextInputField,
  ToggleChip,
  Typography,
} from "@zibby/design-system";
import { type Category, MODEL_TIERS, type ModelTier } from "@zibby/contracts";
import {
  type Control,
  Controller,
  FormSegmentPicker,
  FormSelect,
  FormTextArea,
  FormTextInput,
  FormToggle,
  useWatch,
} from "@zibby/forms";
import {
  AiEngineModelPicker,
  useAiEnginesQuery,
  useThinkingHint,
  useTierLabel,
} from "../../ai-providers";
import { useSystemConfigQuery } from "../../system";
import { useDepartmentLookup } from "../../departments/useDepartmentLookup";
import { AGENT_GLYPHS, AGENT_TOOLS, THINKING_OPTIONS } from "../../../state/config";
import { AgentDetailScreenTestId as TestId } from "../agentTestIds";
import { type AgentEditValues, ROUTING_LIMIT } from "./agentEditValues";

interface SideCardProps {
  title: string;
  summary?: ReactNode;
  /** The card has unsaved changes. */
  dirty?: boolean;
  children: ReactNode;
}

function SideCard({ title, summary, dirty, children }: SideCardProps) {
  const t = useDetailT();
  return (
    <Panel
      header={
        <Stack align="center" direction="row" gap="75">
          <Typography size="sm" type="note" weight="bold">
            {title}
          </Typography>
          {dirty && (
            <Typography aria-label={t("cardChanged")} role="img" size="2xs" type="note">
              ●
            </Typography>
          )}
        </Stack>
      }
      headerEnd={
        summary && (
          <Typography mono size="xs" type="note" variant="tertiary">
            {summary}
          </Typography>
        )
      }
      padding="200"
    >
      <Stack gap="150">{children}</Stack>
    </Panel>
  );
}

export interface AgentSideCardProps {
  control: Control<AgentEditValues>;
  dirty: boolean;
}

export interface IdentityCardProps extends AgentSideCardProps {
  categories: Category[];
  /** Inline error under the name field (e.g. "taken by another agent"). */
  nameError?: string;
  /** The file name / id can only change while the agent is new. */
  nameLocked: boolean;
}

/** Identity: file name, display name, role, category, department and icon. */
export function IdentityCard({
  control,
  dirty,
  categories,
  nameError,
  nameLocked,
}: IdentityCardProps) {
  const t = useTranslations("agents");
  const td = useDetailT();
  const departments = useDepartmentLookup();
  const [name, category] = useWatch({ control, name: ["name", "category"] });
  const categoryOptions = categories.map((c) => ({ value: c.name, label: c.name }));
  if (category && !categoryOptions.some((o) => o.value === category))
    categoryOptions.push({ value: category, label: category });

  return (
    <SideCard dirty={dirty} summary={name} title={td("identity")}>
      <Grid cols={2} gap="150">
        <FormTextInput<AgentEditValues>
          disabled={nameLocked}
          error={nameError}
          hint={nameError ? undefined : td("nameHint")}
          label={t("fields.name")}
          name="name"
          placeholder={t("fields.namePlaceholder")}
        />
        <FormTextInput<AgentEditValues>
          label={t("fields.displayName")}
          name="displayName"
          placeholder={t("fields.displayNamePlaceholder")}
        />
        <FormTextInput<AgentEditValues>
          label={td("role")}
          name="title"
          placeholder={t("fields.jobTitlePlaceholder")}
        />
        <FormSelect<string, AgentEditValues>
          label={t("fields.category")}
          name="category"
          options={categoryOptions}
        />
        <FormSelect<string, AgentEditValues>
          label={t("fields.department")}
          name="department"
          options={departments.list.map((s) => ({ value: s.id, label: s.name }))}
          placeholder={t("departmentPlaceholder")}
        />
      </Grid>
      <Controller<AgentEditValues, "glyph">
        control={control}
        name="glyph"
        render={({ field }) => (
          <Stack gap="75">
            <Typography size="sm" type="note" variant="secondary">
              {t("fields.icon")}
            </Typography>
            <Stack wrap direction="row" gap="75">
              {AGENT_GLYPHS.map((g: IconName) => (
                <IconTile
                  interactive
                  aria-label={g}
                  aria-pressed={field.value === g}
                  as="button"
                  glyph={g}
                  key={g}
                  onClick={() => field.onChange(g)}
                  radius="default"
                  size="sm"
                  tone={field.value === g ? "accent" : "neutral"}
                />
              ))}
            </Stack>
          </Stack>
        )}
      />
    </SideCard>
  );
}

export interface RoutingCardProps extends AgentSideCardProps {
  error?: string;
}

/** When to use: the routing text with its `n / 512` counter. */
export function RoutingCard({ control, dirty, error }: RoutingCardProps) {
  const t = useDetailT();
  const description = useWatch({ control, name: "description" }) ?? "";
  const over = description.length > ROUTING_LIMIT;
  return (
    <SideCard
      dirty={dirty}
      summary={
        <Typography
          mono
          data-testid={TestId.Counter}
          size="xs"
          tone={over ? "bad" : undefined}
          type="note"
          variant="tertiary"
        >
          {description.length} / {ROUTING_LIMIT}
        </Typography>
      }
      title={t("routing")}
    >
      <FormTextArea<AgentEditValues>
        error={error}
        hint={error ? undefined : t("routingHint")}
        label={t("routing")}
        name="description"
        placeholder={t("routingPlaceholder")}
        rows={4}
      />
    </SideCard>
  );
}

/** Engine & model: tier, thinking, engine override and the exact opencode model. */
export function EngineCard({ control, dirty }: AgentSideCardProps) {
  const t = useTranslations("agents");
  const td = useDetailT();
  const tEngine = useTranslations("aiEngine");
  const tierLabel = useTierLabel();
  const globalEngine = useSystemConfigQuery().data?.aiEngine ?? "claude";
  const engine = useWatch({ control, name: "engine" });
  const [tier, thinking, engineModel] = useWatch({
    control,
    name: ["model", "thinking", "engineModel"],
  });
  const { data: engines } = useAiEnginesQuery();
  const thinkingHint = useThinkingHint({ engine, engineModel, tier: tier as ModelTier, thinking });
  const opencodeModels = engines?.engines.find((e) => e.id === "opencode")?.models ?? [];
  const modelOptions = MODEL_TIERS.map((m) => ({
    value: m,
    label: tierLabel(m, engine || globalEngine),
  }));

  return (
    <SideCard
      dirty={dirty}
      summary={`${engine ? tEngine(`engine.${engine}`) : tEngine("useGlobal")} · ${tier}`}
      title={td("engineModel")}
    >
      <FormSegmentPicker<AgentEditValues>
        label={t("fields.model")}
        name="model"
        options={modelOptions}
      />
      <FormSegmentPicker<AgentEditValues>
        label={t("fields.thinking")}
        name="thinking"
        options={THINKING_OPTIONS}
      />
      {thinkingHint && (
        <Typography
          data-testid="agent-thinking-hint"
          leading="snug"
          size="2xs"
          type="note"
          variant="tertiary"
        >
          {thinkingHint}
        </Typography>
      )}
      <Controller<AgentEditValues, "engine">
        control={control}
        name="engine"
        render={({ field }) => (
          <Stack gap="75">
            <Typography size="sm" type="note" variant="secondary">
              {tEngine("agentField")}
            </Typography>
            <ButtonGroup
              ariaLabel={tEngine("agentField")}
              onChange={(v) => field.onChange(v === "global" ? "" : v)}
              options={[
                { id: "global", label: tEngine("useGlobal") },
                { id: "claude", label: tEngine("engine.claude") },
                { id: "opencode", label: tEngine("engine.opencode") },
              ]}
              value={field.value || "global"}
            />
          </Stack>
        )}
      />
      {!engine && (
        <Typography size="xs" type="note" variant="tertiary">
          {td("globalIs", { engine: tEngine(`engine.${globalEngine}`) })}
        </Typography>
      )}
      {engine === "opencode" && (
        <Controller<AgentEditValues, "engineModel">
          control={control}
          name="engineModel"
          render={({ field }) => (
            <AiEngineModelPicker
              clearable
              label={tEngine("exactModel")}
              loaded={engines !== undefined}
              models={opencodeModels}
              onChange={field.onChange}
              value={field.value}
            />
          )}
        />
      )}
    </SideCard>
  );
}

/** A comma-separated list input that only commits on blur (so typing a trailing comma sticks). */
function CsvField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string[];
  onCommit: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState(value.join(", "));
  return (
    <TextInputField
      label={label}
      onBlur={() =>
        onCommit(
          draft
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
      onChange={(e) => setDraft(e.target.value)}
      value={draft}
    />
  );
}

/** Tools: toggle chips plus an Advanced disclosure for the fields the agent schema carries. */
export function ToolsCard({ control, dirty }: AgentSideCardProps) {
  const t = useDetailT();
  const [open, setOpen] = useState(false);
  const [tools, plugins, risk, requiresApproval] = useWatch({
    control,
    name: ["tools", "plugins", "risk", "requiresApproval"],
  });
  const advSummary = [
    t("riskValue", { risk: risk || "low" }),
    requiresApproval ? t("needsApproval") : t("noApproval"),
    t("pluginCount", { count: plugins.length }),
  ].join(" · ");

  return (
    <SideCard
      dirty={dirty}
      summary={t("toolCount", { n: tools.length, total: AGENT_TOOLS.length })}
      title={t("tools")}
    >
      <Controller<AgentEditValues, "tools">
        control={control}
        name="tools"
        render={({ field }) => (
          <Stack wrap aria-label={t("allowedTools")} direction="row" gap="75" role="group">
            {AGENT_TOOLS.map((tool) => (
              <ToggleChip
                key={tool}
                onClick={() =>
                  field.onChange(
                    field.value.includes(tool)
                      ? field.value.filter((x) => x !== tool)
                      : [...field.value, tool],
                  )
                }
                pressed={field.value.includes(tool)}
              >
                {tool}
              </ToggleChip>
            ))}
          </Stack>
        )}
      />
      <Button
        aria-expanded={open}
        icon={open ? "collapse" : "expand"}
        intent="ghost"
        onClick={() => setOpen((o) => !o)}
        size="sm"
      >
        {t("advanced")}
        {!open && (
          <Typography as="span" size="2xs" type="note" variant="tertiary">
            {advSummary}
          </Typography>
        )}
      </Button>
      {open && (
        <Container padding={["0", "0", "0", "100"]}>
          <Stack gap="150">
            <Controller<AgentEditValues, "optionalTools">
              control={control}
              name="optionalTools"
              render={({ field }) => (
                <CsvField
                  label={t("optionalTools")}
                  onCommit={field.onChange}
                  value={field.value}
                />
              )}
            />
            <Controller<AgentEditValues, "plugins">
              control={control}
              name="plugins"
              render={({ field }) => (
                <CsvField label={t("plugins")} onCommit={field.onChange} value={field.value} />
              )}
            />
            <FormSegmentPicker<AgentEditValues>
              label={t("risk")}
              name="risk"
              options={[
                { value: "low", label: "low" },
                { value: "medium", label: "medium" },
                { value: "high", label: "high" },
              ]}
            />
            <FormToggle<AgentEditValues>
              hint={t("requiresApprovalHint")}
              label={t("requiresApproval")}
              labelCase="normal"
              name="requiresApproval"
            />
          </Stack>
        </Container>
      )}
    </SideCard>
  );
}
