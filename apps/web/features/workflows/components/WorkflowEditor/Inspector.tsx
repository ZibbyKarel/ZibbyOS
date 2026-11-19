"use client";
import {
  type Agent,
  type Department,
  MODEL_TIERS,
  OPENAI_TEXT_MODELS,
  type OpenAiTextModel,
} from "@zibby/contracts";
import type { ModelTier } from "@zibby/contracts";
import {
  Button,
  Container,
  Grid,
  InspectorSection,
  MenuButton,
  SegmentedControl,
  SelectField,
  Stack,
  Tag,
  TextAreaField,
  TextInputField,
  ToggleChip,
  ToggleField,
  Typography,
} from "@zibby/design-system";
import { type PointerEvent as ReactPointerEvent, useRef } from "react";
import { stepEngineChoice } from "../../../../utils/engine";
import type { Workflow } from "../../../../domain";
import { AiEngineModelPicker, useAiEnginesQuery, useThinkingHint } from "../../../ai-providers";
import { useProjectsQuery } from "../../../projects/queries";
import { useSkillsQuery } from "../../../skills";
import { CommandLine } from "../../../tasks/components/CommandLine/CommandLine";
import { OutputsEditor } from "../OutputsEditor/OutputsEditor";
import {
  type GraphNode,
  type GraphProblem,
  type PhaseExtra,
  type WorkflowGraph,
  loopOf,
  orderNodes,
  removeNode,
  setLoop,
} from "../WorkflowDialog/workflow-graph";
import { AdvisorFields } from "./AdvisorFields";
import { InspectorHeader } from "./InspectorHeader";
import { LoopFields } from "./LoopFields";
import { PhaseAvatar } from "./PhaseAvatar";
import type { SetGraph } from "./useGraphHistory";
import { usePhaseLabel } from "./usePhaseLabel";
import { useWdT } from "./useWdT";
import type { WorkflowDraft } from "./workflowDraft";

export const PROMPT_LIMIT = 20_000;
export const INSPECTOR_MIN = 320;
export const INSPECTOR_MAX = 640;
/** The design's default inspector width. */
export const INSPECTOR_DEFAULT = 392;

export enum InspectorTestId {
  Root = "wd-inspector",
  Resize = "wd-inspector-resize",
  Close = "wd-inspector-close",
  Delete = "wd-inspector-delete",
  PromptCount = "wd-prompt-count",
  Settings = "wd-workflow-settings",
  Overrides = "wd-inspector-overrides",
  Reset = "wd-inspector-reset",
  Engine = "wd-inspector-engine",
  Tier = "wd-inspector-tier",
  Thinking = "wd-inspector-thinking",
  Who = "wd-inspector-who",
  Change = "wd-inspector-change",
}

export interface InspectorProps {
  workflow: Workflow;
  graph: WorkflowGraph;
  setGraph: SetGraph;
  agents: readonly Agent[];
  departments: readonly Department[];
  workflows: readonly Workflow[];
  selectedId: string | null;
  editing: boolean;
  problems: readonly GraphProblem[];
  draft: WorkflowDraft;
  onDraftChange: (draft: WorkflowDraft) => void;
  width: number;
  onWidthChange: (width: number) => void;
  /** Close the inspector (✕ / Esc): deselects the phase, or hides the workflow settings. */
  onClose: () => void;
}

const COMPLEXITIES = ["light", "standard", "deep"] as const;
const THINKING = ["low", "medium", "high"] as const;
const RUNS_ON = ["default", "claude", "opencode", "openai"] as const;

/** Right inspector: the selected phase's sections, or the workflow-level settings when nothing is. */
export function Inspector(props: InspectorProps) {
  const { width, onWidthChange, selectedId, graph, editing, onClose } = props;
  const t = useWdT("workflowDetail.inspector");
  const tp = useWdT("workflowDetail.parity");
  const node = selectedId ? graph.nodes.find((n) => n.id === selectedId) : undefined;
  const drag = useRef<{ x: number; w: number } | null>(null);
  const clampW = (w: number) => Math.min(INSPECTOR_MAX, Math.max(INSPECTOR_MIN, w));

  const onDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: width };
  };
  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (drag.current) onWidthChange(clampW(drag.current.w + (drag.current.x - e.clientX)));
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <Container
      aria-label={t("title")}
      as="aside"
      data-testid={InspectorTestId.Root}
      height="100%"
      position="relative"
      shrink={false}
      style={{
        width,
        borderLeft: "1px solid var(--color-border)",
        background: "var(--color-background-deep)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        zIndex: 7,
      }}
    >
      <Container
        aria-label={t("resize")}
        aria-orientation="vertical"
        aria-valuemax={INSPECTOR_MAX}
        aria-valuemin={INSPECTOR_MIN}
        aria-valuenow={width}
        data-nopan=""
        data-testid={InspectorTestId.Resize}
        height="100%"
        left="-3px"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onWidthChange(clampW(width + 24));
          if (e.key === "ArrowRight") onWidthChange(clampW(width - 24));
        }}
        onPointerCancel={onUp}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        position="absolute"
        role="separator"
        style={{ width: 6, cursor: "col-resize", zIndex: 2, touchAction: "none" }}
        tabIndex={0}
        top="0"
      />
      {node ? (
        <PhaseInspector {...props} node={node} onClose={onClose} />
      ) : (
        <>
          <InspectorHeader
            closeLabel={t("close")}
            glyph="gear"
            menuLabel={tp("more")}
            onClose={onClose}
            subtitle={tp("nothingSelected")}
            title={t("workflowTitle")}
          />
          <Container grow minHeight="0" overflowY="auto">
            <Container inert={!editing || undefined}>
              <WorkflowSettings {...props} />
            </Container>
          </Container>
        </>
      )}
    </Container>
  );
}

function PhaseInspector({ node, ...p }: InspectorProps & { node: GraphNode }) {
  const t = useWdT("workflowDetail.inspector");
  const tp = useWdT("workflowDetail.parity");
  const label = usePhaseLabel(p.agents);
  const order = orderNodes(p.graph);
  const agent = p.agents.find((a) => a.id === node.agent);
  const kind = tp(`kind_${node.type}`, {
    n: order.findIndex((n) => n.id === node.id) + 1,
    total: order.length,
  });
  return (
    <>
      <InspectorHeader
        closeLabel={t("close")}
        lead={<PhaseAvatar agent={agent} departments={p.departments} node={node} size="lg" />}
        menu={[
          {
            id: "delete",
            label: t("delete"),
            icon: "trash",
            danger: true,
            disabled: !p.editing,
            onSelect: () => {
              p.setGraph((g) => removeNode(g, node.id));
              p.onClose();
            },
          },
        ]}
        menuLabel={tp("more")}
        onClose={p.onClose}
        subtitle={kind}
        title={label(node)}
      />
      <Container grow minHeight="0" overflowY="auto">
        <Container inert={!p.editing || undefined}>
          <PhaseSections {...p} node={node} />
        </Container>
      </Container>
    </>
  );
}

/** A section's number comes from its place in the list, so hidden sections never leave a gap. */
function useCounter() {
  let n = 0;
  return () => ++n;
}

const CLAUDE_LABEL = "Claude Code";

function PhaseSections({ node, ...p }: InspectorProps & { node: GraphNode }) {
  const t = useWdT("workflowDetail.inspector");
  const tp = useWdT("workflowDetail.parity");
  const label = usePhaseLabel(p.agents);
  const { data: skills = [], isSuccess: skillsReady } = useSkillsQuery();
  const { data: engines } = useAiEnginesQuery();
  const { setGraph, graph } = p;
  const order = orderNodes(graph);
  const idx = order.findIndex((n) => n.id === node.id);
  const here = (n: GraphNode) => ({ id: n.id, label: `${label(n)} · ${n.id}` });
  const loop = loopOf(graph, node.id);
  const problemKinds = new Set(p.problems.filter((x) => x.nodeId === node.id).map((x) => x.kind));
  const agent = p.agents.find((a) => a.id === node.agent);
  const patch = (change: Partial<GraphNode>, coalesce?: string) =>
    setGraph(
      (g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === node.id ? { ...n, ...change } : n)) }),
      coalesce,
    );
  const promptLen = node.prompt?.length ?? 0;
  const opencodeModels = engines?.engines.find((e) => e.id === "opencode")?.models ?? [];
  const choice = stepEngineChoice(node, agent);
  const thinkingHint = useThinkingHint({
    engine: choice.engine,
    engineModel: choice.engineModel,
    tier: node.model as ModelTier,
    thinking: node.thinking,
  });
  const runsOn = node.openaiModel ? "openai" : (node.engine ?? "default");
  const cleared = {
    engine: undefined,
    engineModel: undefined,
    openaiModel: undefined,
    include: undefined,
  } satisfies Partial<GraphNode>;
  const setRunsOn = (v: string) => {
    if (v === "claude" || v === "opencode") return patch({ ...cleared, engine: v });
    if (v === "openai") {
      const keep = node.openaiModel ? { include: node.include } : {};
      return patch({
        ...cleared,
        ...keep,
        openaiModel: node.openaiModel ?? (OPENAI_TEXT_MODELS[0]?.id as OpenAiTextModel),
      });
    }
    return patch(cleared);
  };
  const agentDefault = `${agent?.engine === "opencode" ? "opencode" : CLAUDE_LABEL} · ${agent?.model ?? node.model} · ${agent?.thinking ?? node.thinking}`;
  const overridden =
    node.engine !== undefined ||
    node.openaiModel !== undefined ||
    node.engineModel !== undefined ||
    (agent?.model !== undefined && agent.model !== node.model) ||
    (agent?.thinking !== undefined && agent.thinking !== node.thinking);
  const childOptions = p.workflows
    .filter((w) => w.id !== p.workflow.id)
    .map((w) => ({ value: w.id, label: w.name }));
  const setAdvisor = (advisor: PhaseExtra["advisor"]) => {
    const rest = { ...node.extra };
    delete rest.advisor;
    patch({
      extra:
        advisor === undefined
          ? Object.keys(rest).length
            ? rest
            : undefined
          : { ...rest, advisor },
    });
  };
  const advisor = node.extra?.advisor;
  const advisorSummary =
    advisor === false
      ? t("off")
      : advisor
        ? tp("advisorSummary", { model: advisor.model ?? "opus", n: advisor.maxCalls ?? 3 })
        : t("none");
  const num = useCounter();
  const loopTarget = loop ? loop.to : undefined;
  const loopName = loopTarget
    ? loopTarget === "fail"
      ? tp("loopFail")
      : label(order.find((n) => n.id === loopTarget) ?? node)
    : "";

  return (
    <Stack data-testid={`wd-phase-${node.id}`} gap="0">
      {node.type === "agent" && (
        <InspectorSection
          defaultOpen
          hideSummaryWhenOpen
          index={num()}
          invalid={problemKinds.has("agent")}
          summary={`${agent?.name ?? node.agent} · ${node.model} · ${node.thinking}`}
          title={t("who")}
        >
          <Stack data-testid={InspectorTestId.Who} gap="150">
            <WhoCard
              agent={agent}
              agents={p.agents}
              departments={p.departments}
              node={node}
              onPick={(a) => patch({ agent: a })}
            />
            <FieldBlock label={tp("whereRuns")}>
              <SegmentedControl
                fill
                ariaLabel={tp("whereRuns")}
                items={RUNS_ON.map((v) => ({
                  value: v,
                  label: v === "default" ? tp("runsDefault") : RUN_LABEL[v],
                }))}
                onChange={setRunsOn}
                size="sm"
                value={runsOn}
              />
            </FieldBlock>
            {node.engine === "opencode" && (
              <AiEngineModelPicker
                clearable
                quiet
                label={t("exactModel")}
                loaded={engines !== undefined}
                models={opencodeModels}
                onChange={(engineModel) => patch({ engineModel: engineModel || undefined })}
                value={node.engineModel ?? ""}
              />
            )}
            {node.openaiModel && (
              <SelectField
                label={t("exactModel")}
                onValueChange={(m) => patch({ openaiModel: m as OpenAiTextModel })}
                options={OPENAI_TEXT_MODELS.map((m) => ({ value: m.id, label: m.id }))}
                size="xs"
                value={node.openaiModel}
              />
            )}
            {!node.openaiModel && (
              <>
                <FieldBlock label={tp("tier")}>
                  <SegmentedControl
                    fill
                    ariaLabel={tp("tier")}
                    items={MODEL_TIERS.map((m) => ({ value: m, label: m }))}
                    onChange={(m) => patch({ model: m as ModelTier })}
                    size="sm"
                    value={node.model}
                  />
                </FieldBlock>
                <FieldBlock label={tp("thinking")}>
                  <SegmentedControl
                    fill
                    ariaLabel={tp("thinking")}
                    items={THINKING.map((v) => ({ value: v, label: tp(v) }))}
                    onChange={(v) => patch({ thinking: v as GraphNode["thinking"] })}
                    size="sm"
                    value={node.thinking}
                  />
                </FieldBlock>
                {thinkingHint && (
                  <Typography leading="snug" size="2xs" type="note" variant="tertiary">
                    {thinkingHint}
                  </Typography>
                )}
              </>
            )}
            {overridden && agent && (
              <Stack
                align="center"
                data-testid={InspectorTestId.Overrides}
                direction="row"
                gap="75"
                justify="between"
              >
                <Typography size="xs" type="note" variant="tertiary">
                  {`${tp("overrides")} `}
                  <Typography as="span" size="xs" type="note" variant="secondary" weight="medium">
                    {agentDefault}
                  </Typography>
                </Typography>
                <Button
                  data-testid={InspectorTestId.Reset}
                  intent="ghost"
                  onClick={() =>
                    patch({
                      ...cleared,
                      model: agent.model ?? node.model,
                      thinking: agent.thinking ?? node.thinking,
                    })
                  }
                  size="sm"
                >
                  {tp("reset")}
                </Button>
              </Stack>
            )}
          </Stack>
        </InspectorSection>
      )}

      {node.type === "workflow" && (
        <InspectorSection
          defaultOpen
          hideSummaryWhenOpen
          index={num()}
          invalid={problemKinds.has("workflow")}
          summary={childOptions.find((o) => o.value === node.workflow)?.label}
          title={t("workflowLink")}
        >
          <SelectField
            label={tp("runsWorkflow")}
            onValueChange={(workflow) => patch({ workflow })}
            options={[{ value: "", label: t("workflowPick") }, ...childOptions]}
            size="xs"
            value={node.workflow ?? ""}
          />
        </InspectorSection>
      )}

      {node.type === "system" && (
        <InspectorSection defaultOpen index={num()} title={t("who")}>
          <Typography mono size="xs" type="note" variant="tertiary">
            {t("systemAction", { action: node.action ?? "" })}
          </Typography>
        </InspectorSection>
      )}

      {node.type === "agent" && (
        <InspectorSection
          defaultOpen
          hideSummaryWhenOpen
          index={num()}
          summary={t("chars", { n: promptLen })}
          title={t("prompt")}
        >
          <Stack gap="75">
            <Container key={skillsReady ? "ready" : "loading"}>
              <CommandLine
                allowSkillMentions
                hideLabel
                allowTargetMentions={false}
                autoFocus={false}
                chrome={false}
                initialSkill={
                  node.skill
                    ? {
                        id: node.skill,
                        name: skills.find((s) => s.id === node.skill)?.name ?? node.skill,
                      }
                    : undefined
                }
                initialText={node.prompt}
                label={t("prompt")}
                maxRows={16}
                onSkillChange={(skill) => patch({ skill })}
                onSubmit={() => {}}
                onTextChange={(text) =>
                  patch(
                    { prompt: text ? text.slice(0, PROMPT_LIMIT) : undefined },
                    `prompt-${node.id}`,
                  )
                }
                placeholder={t("promptPlaceholder")}
                renderTrailing={() => null}
                resetOnSubmit={false}
                rows={6}
                showAttach={false}
              />
            </Container>
            <Typography
              mono
              data-testid={InspectorTestId.PromptCount}
              size="2xs"
              tone={promptLen >= PROMPT_LIMIT ? "bad" : undefined}
              type="note"
              variant="tertiary"
            >
              {`${promptLen.toLocaleString("en")} / ${PROMPT_LIMIT.toLocaleString("en")}`}
            </Typography>
          </Stack>
        </InspectorSection>
      )}

      {node.type === "tool" && (
        <InspectorSection
          defaultOpen
          hideSummaryWhenOpen
          index={num()}
          invalid={problemKinds.has("commands")}
          summary={tp("commandsCount", {
            n: node.commands.split("\n").filter((c) => c.trim()).length,
          })}
          title={t("commands")}
        >
          <TextAreaField
            data-testid={`wd-commands-${node.id}`}
            hint={t("commandsHint")}
            label={t("commands")}
            onChange={(e) => patch({ commands: e.target.value }, `cmd-${node.id}`)}
            placeholder={t("commandsPlaceholder")}
            rows={5}
            value={node.commands}
          />
        </InspectorSection>
      )}

      {(node.type === "agent" || node.type === "tool") && (
        <InspectorSection
          hideSummaryWhenOpen
          index={num()}
          invalid={problemKinds.has("produces")}
          summary={node.produces}
          title={t("files")}
        >
          <Stack gap="100">
            <TextInputField
              hint={t("producesHint")}
              label={t("produces")}
              onChange={(e) => patch({ produces: e.target.value }, `produces-${node.id}`)}
              value={node.produces}
            />
            {node.openaiModel && (
              <TextAreaField
                hint={t("includeHint")}
                label={t("include")}
                onChange={(e) => {
                  const lines = e.target.value.split("\n").filter((l) => l.trim());
                  patch({ include: lines.length ? e.target.value.split("\n") : undefined });
                }}
                placeholder="book/plan.json"
                rows={2}
                value={(node.include ?? []).join("\n")}
              />
            )}
          </Stack>
        </InspectorSection>
      )}

      <InspectorSection
        hideSummaryWhenOpen
        index={num()}
        invalid={problemKinds.has("rework") || problemKinds.has("then")}
        summary={loop ? `→ ${loopName} · ${loop.maxRetries ?? 1}×` : t("none")}
        title={t("loop")}
      >
        {loop ? (
          <LoopFields
            loop={loop}
            onChange={(next) => setGraph((g) => setLoop(g, node.id, next))}
            onRemove={() => setGraph((g) => setLoop(g, node.id, null))}
            retryTargets={order.slice(0, Math.max(idx, 0)).map(here)}
            thenTargets={order.filter((n) => n.id !== node.id).map(here)}
          />
        ) : (
          <Stack gap="75">
            <Typography leading="snug" size="xs" type="note" variant="tertiary">
              {t("loopEmpty")}
            </Typography>
            <Button
              disabled={idx <= 0}
              icon="plus"
              intent="ghost"
              onClick={() =>
                setGraph((g) =>
                  setLoop(g, node.id, {
                    to: order[idx - 1]?.id ?? "",
                    maxRetries: 2,
                    escalate: false,
                    then: "park",
                  }),
                )
              }
              size="sm"
            >
              {t("loopAdd")}
            </Button>
          </Stack>
        )}
      </InspectorSection>

      <InspectorSection
        hideSummaryWhenOpen
        index={num()}
        summary={node.approval === "ask" ? tp("askMe") : t("off")}
        title={t("checkpoint")}
      >
        <ToggleField
          checked={node.approval === "ask"}
          data-testid={`wd-approval-${node.id}`}
          label={t("checkpointLabel")}
          onChange={(on) => patch({ approval: on ? "ask" : undefined })}
          size="sm"
        />
        <Typography leading="snug" size="xs" type="note" variant="tertiary">
          {t("checkpointHint")}
        </Typography>
      </InspectorSection>

      {node.type === "agent" && (
        <InspectorSection
          hideSummaryWhenOpen
          index={num()}
          summary={advisorSummary}
          title={t("advanced")}
        >
          <Stack gap="75">
            <Typography size="xs" type="note" weight="semibold">
              {t("advisor")}
            </Typography>
            <AdvisorFields
              phaseLevel
              forkTargets={order
                .slice(0, Math.max(idx, 0))
                .map((n) => ({ id: n.id, label: label(n) }))}
              onChange={setAdvisor}
              value={advisor}
            />
          </Stack>
        </InspectorSection>
      )}
    </Stack>
  );
}

const RUN_LABEL = { claude: CLAUDE_LABEL, opencode: "opencode", openai: "OpenAI" } as const;

/** A small muted label over a control — the inspector's low-chrome field. */
function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap="75">
      <Typography size="xs" type="note" variant="secondary" weight="medium">
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

function WhoCard({
  agent,
  agents,
  departments,
  node,
  onPick,
}: {
  agent: Agent | undefined;
  agents: readonly Agent[];
  departments: readonly Department[];
  node: GraphNode;
  onPick: (agentId: string) => void;
}) {
  const t = useWdT("workflowDetail.parity");
  const sub = [agent?.displayName ?? agent?.title, agent?.category].filter(Boolean).join(" · ");
  return (
    <Container
      style={{
        border: "1px solid var(--color-border-strong)",
        borderRadius: 10,
        background: "var(--color-background)",
        padding: 10,
      }}
    >
      <Stack align="center" direction="row" gap="125">
        <PhaseAvatar agent={agent} departments={departments} node={node} size="lg" />
        <Container grow minW0>
          <Typography truncate size="sm" type="note" weight="semibold">
            {agent?.name ?? node.agent}
          </Typography>
          {sub && (
            <Typography truncate size="xs" type="note" variant="tertiary">
              {sub}
            </Typography>
          )}
          {(agent?.tools?.length ?? 0) > 0 && (
            <Stack wrap direction="row" gap="50" style={{ marginTop: 4 }}>
              {agent?.tools?.slice(0, 4).map((tool) => (
                <Tag key={tool}>
                  <Typography mono as="span" size="2xs" type="note">
                    {tool}
                  </Typography>
                </Tag>
              ))}
            </Stack>
          )}
        </Container>
        <MenuButton
          ariaLabel={t("change")}
          items={agents.map((a) => ({
            id: a.id,
            label: a.name ?? a.id,
            onSelect: () => onPick(a.id),
          }))}
          renderTrigger={(props) => (
            <Button {...props} data-testid={InspectorTestId.Change} intent="ghost" size="sm">
              {t("change")} ▾
            </Button>
          )}
        />
      </Stack>
    </Container>
  );
}

function WorkflowSettings(p: InspectorProps) {
  const t = useWdT("workflowDetail.inspector");
  const tp = useWdT("workflowDetail.parity");
  const { draft, onDraftChange, departments } = p;
  const { data: projects = [] } = useProjectsQuery();
  const set = (change: Partial<WorkflowDraft>) => onDraftChange({ ...draft, ...change });
  const order = orderNodes(p.graph);
  const label = usePhaseLabel(p.agents);
  const num = useCounter();
  const dept = departments.find((d) => d.id === draft.department)?.name;
  const adv = draft.advisor;
  return (
    <Stack data-testid={InspectorTestId.Settings} gap="0">
      <InspectorSection
        defaultOpen
        hideSummaryWhenOpen
        index={num()}
        summary={dept}
        title={t("general")}
      >
        <TextAreaField
          label={t("description")}
          onChange={(e) => set({ desc: e.target.value })}
          rows={2}
          value={draft.desc}
        />
        <SelectField
          label={t("department")}
          onValueChange={(department) => set({ department })}
          options={[
            { value: "", label: t("noDepartment") },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
          size="xs"
          value={draft.department}
        />
      </InspectorSection>

      <InspectorSection
        defaultOpen
        hideSummaryWhenOpen
        index={num()}
        summary={t(`complexity_${draft.complexity}`)}
        title={tp("runDefaults")}
      >
        <FieldBlock label={t("complexity")}>
          <SegmentedControl
            fill
            ariaLabel={t("complexity")}
            items={COMPLEXITIES.map((c) => ({ value: c, label: t(`complexity_${c}`) }))}
            onChange={(c) => set({ complexity: c as WorkflowDraft["complexity"] })}
            size="sm"
            value={draft.complexity}
          />
        </FieldBlock>
        <SelectField
          hint={t("projectHint")}
          label={t("project")}
          onValueChange={(project) => set({ project })}
          options={[
            { value: "", label: tp("askAtRun") },
            ...projects.map((x) => ({ value: x.id, label: x.name })),
          ]}
          size="xs"
          value={draft.project}
        />
        <FieldBlock label={tp("requires")}>
          <Stack wrap direction="row" gap="75">
            <ToggleChip
              onClick={() => set({ requiresWeb: !draft.requiresWeb })}
              pressed={draft.requiresWeb}
              title={t("requiresWeb")}
            >
              web
            </ToggleChip>
          </Stack>
        </FieldBlock>
      </InspectorSection>

      <InspectorSection
        defaultOpen
        hideSummaryWhenOpen
        index={num()}
        summary={
          draft.maxCostUsd === null
            ? t("none")
            : tp("budgetSummary", { cost: draft.maxCostUsd.toFixed(2), pct: draft.warnAtPct })
        }
        title={t("budget")}
      >
        <Grid cols={2} gap="100">
          <TextInputField
            inputMode="decimal"
            label={tp("maxCost")}
            onChange={(e) => {
              const n = Number.parseFloat(e.target.value);
              set({ maxCostUsd: Number.isFinite(n) && n > 0 ? n : null });
            }}
            value={draft.maxCostUsd === null ? "" : String(draft.maxCostUsd)}
          />
          <TextInputField
            inputMode="numeric"
            label={tp("warnAt")}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              set({ warnAtPct: Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 1 });
            }}
            value={String(draft.warnAtPct)}
          />
        </Grid>
        <Typography leading="snug" size="xs" type="note" variant="tertiary">
          {t("budgetHint")}
        </Typography>
      </InspectorSection>

      <InspectorSection
        hideSummaryWhenOpen
        index={num()}
        summary={
          adv === undefined
            ? t("none")
            : tp("advisorSummary", { model: adv.model ?? "opus", n: adv.maxCalls ?? 3 })
        }
        title={tp("defaultAdvisor")}
      >
        <AdvisorFields
          forkTargets={order.map((n) => ({ id: n.id, label: label(n) }))}
          onChange={(v) => set({ advisor: v === false ? undefined : v })}
          phaseLevel={false}
          value={draft.advisor}
        />
      </InspectorSection>

      <InspectorSection
        hideSummaryWhenOpen
        index={num()}
        summary={t("chars", { n: draft.instructions.length })}
        title={tp("workflowInstructions")}
      >
        <TextAreaField
          hint={t("instructionsHint")}
          label={t("instructions")}
          onChange={(e) => set({ instructions: e.target.value })}
          rows={6}
          value={draft.instructions}
        />
      </InspectorSection>

      <InspectorSection
        hideSummaryWhenOpen
        index={num()}
        summary={String(draft.outputs.length)}
        title={t("outputs")}
      >
        <OutputsEditor
          onChange={(outputs) => set({ outputs })}
          outputs={draft.outputs}
          produces={p.graph.nodes.map((n) => n.produces).filter(Boolean)}
        />
      </InspectorSection>
    </Stack>
  );
}
