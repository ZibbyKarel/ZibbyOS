"use client";

import { type ReactNode, useState } from "react";
import { useTranslations } from "next-intl";
import { useDetailT } from "../useDetailT";
import {
  Grid,
  InspectorSection,
  Panel,
  SegmentPickerField,
  Stack,
  TextInputField,
  ToggleChip,
  Typography,
} from "@zibby/design-system";
import type { IconName } from "@zibby/design-system";
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
import { AiEngineModelPicker, useAiEnginesQuery, useThinkingHint } from "../../ai-providers";
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
      padding="150"
    >
      <Stack gap="100">{children}</Stack>
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
  const [name, category, glyph] = useWatch({ control, name: ["name", "category", "glyph"] });
  const categoryOptions = categories.map((c) => ({ value: c.name, label: c.name }));
  if (category && !categoryOptions.some((o) => o.value === category))
    categoryOptions.push({ value: category, label: category });

  const glyphOptions = [
    { value: "", label: td("iconInitials") },
    ...[
      ...AGENT_GLYPHS,
      ...(glyph && !AGENT_GLYPHS.includes(glyph as IconName) ? [glyph] : []),
    ].map((g) => ({ value: g, label: g })),
  ];

  return (
    <SideCard dirty={dirty} summary={name} title={td("identity")}>
      <Grid cols={2} gap="100">
        <FormTextInput<AgentEditValues>
          disabled={nameLocked}
          error={nameError}
          hint={nameError ? undefined : td("nameHint")}
          label={t("fields.name")}
          name="name"
          placeholder={t("fields.namePlaceholder")}
          size="sm"
        />
        <FormTextInput<AgentEditValues>
          label={t("fields.displayName")}
          name="displayName"
          placeholder={t("fields.displayNamePlaceholder")}
          size="sm"
        />
        <FormTextInput<AgentEditValues>
          label={td("role")}
          name="title"
          placeholder={t("fields.jobTitlePlaceholder")}
          size="sm"
        />
        <FormSelect<string, AgentEditValues>
          label={t("fields.category")}
          name="category"
          options={categoryOptions}
          size="xs"
        />
        <FormSelect<string, AgentEditValues>
          label={t("fields.department")}
          name="department"
          options={departments.list.map((s) => ({ value: s.id, label: s.name }))}
          placeholder={t("departmentPlaceholder")}
          size="xs"
        />
        <FormSelect<string, AgentEditValues>
          label={t("fields.icon")}
          name="glyph"
          options={glyphOptions}
          size="xs"
        />
      </Grid>
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
        hideLabel
        error={error}
        hint={error ? undefined : t("routingHint")}
        label={t("routing")}
        name="description"
        placeholder={t("routingPlaceholder")}
        rows={3}
        size="sm"
      />
    </SideCard>
  );
}

/** Engine & model: tier, thinking, engine override and the exact opencode model. */
export function EngineCard({ control, dirty }: AgentSideCardProps) {
  const t = useTranslations("agents");
  const td = useDetailT();
  const tEngine = useTranslations("aiEngine");
  const globalEngine = useSystemConfigQuery().data?.aiEngine ?? "claude";
  const engine = useWatch({ control, name: "engine" });
  const [tier, thinking, engineModel] = useWatch({
    control,
    name: ["model", "thinking", "engineModel"],
  });
  const { data: engines } = useAiEnginesQuery();
  const thinkingHint = useThinkingHint({ engine, engineModel, tier: tier as ModelTier, thinking });
  const opencodeModels = engines?.engines.find((e) => e.id === "opencode")?.models ?? [];
  // Compact segments carry the plain tier names (the resolved model is the exact-model field below).
  const modelOptions = MODEL_TIERS.map((m) => ({ value: m, label: m }));
  const thinkingOptions = ["low", "medium", "high"]
    .map((v) => THINKING_OPTIONS.find((o) => o.value === v))
    .filter((o) => o !== undefined);

  return (
    <SideCard
      dirty={dirty}
      summary={`${engine ? tEngine(`engine.${engine}`) : tEngine("useGlobal")} · ${tier}`}
      title={td("engineModel")}
    >
      <FormSegmentPicker<AgentEditValues>
        compact
        label={t("fields.model")}
        name="model"
        options={modelOptions}
      />
      <FormSegmentPicker<AgentEditValues>
        compact
        label={t("fields.thinking")}
        name="thinking"
        options={thinkingOptions}
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
          <SegmentPickerField
            compact
            label={tEngine("agentField")}
            onValueChange={(v) => field.onChange(v === "global" ? "" : v)}
            options={[
              { value: "global", label: td("engineGlobal") },
              { value: "claude", label: tEngine("engine.claude") },
              { value: "opencode", label: tEngine("engine.opencode") },
            ]}
            value={field.value || "global"}
          />
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
              size="xs"
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
      size="sm"
      value={draft}
    />
  );
}

/** Tool ids match case-insensitively: agent files say `Read`, the chip list says `read`. */
export const sameTool = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The built-in chips plus any tool the agent already has that is not one of them. */
export function toolChips(current: readonly string[]): string[] {
  const extras = current.filter((v) => !AGENT_TOOLS.some((t) => sameTool(t, v)));
  return [...AGENT_TOOLS, ...new Set(extras)];
}

/** Tools: toggle chips plus an Advanced disclosure for the fields the agent schema carries. */
export function ToolsCard({ control, dirty }: AgentSideCardProps) {
  const t = useDetailT();
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
      summary={t("toolCount", { n: tools.length, total: toolChips(tools).length })}
      title={t("tools")}
    >
      <Controller<AgentEditValues, "tools">
        control={control}
        name="tools"
        render={({ field }) => (
          <Stack wrap aria-label={t("allowedTools")} direction="row" gap="75" role="group">
            {toolChips(field.value).map((tool) => {
              const on = field.value.some((v) => sameTool(v, tool));
              return (
                <ToggleChip
                  key={tool}
                  leading={
                    on ? (
                      <Typography aria-hidden="true" as="span" size="2xs" tone="ok" type="note">
                        ●
                      </Typography>
                    ) : undefined
                  }
                  onClick={() =>
                    field.onChange(
                      on ? field.value.filter((v) => !sameTool(v, tool)) : [...field.value, tool],
                    )
                  }
                  pressed={on}
                >
                  {tool}
                </ToggleChip>
              );
            })}
          </Stack>
        )}
      />
      <InspectorSection hideSummaryWhenOpen summary={advSummary} title={t("advanced")}>
        <Controller<AgentEditValues, "optionalTools">
          control={control}
          name="optionalTools"
          render={({ field }) => (
            <CsvField label={t("optionalTools")} onCommit={field.onChange} value={field.value} />
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
          compact
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
      </InspectorSection>
    </SideCard>
  );
}
