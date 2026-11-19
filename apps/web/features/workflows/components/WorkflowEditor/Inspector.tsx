"use client";
import {
  type Agent,
  type Department,
  OPENAI_TEXT_MODELS,
  type OpenAiTextModel,
} from "@zibby/contracts";
import type { ModelTier } from "@zibby/contracts";
import {
  Button,
  Container,
  InspectorSection,
  SelectField,
  Stack,
  Stepper,
  TextAreaField,
  TextInputField,
  ToggleField,
  Typography,
} from "@zibby/design-system";
import { type PointerEvent as ReactPointerEvent, useRef } from "react";
import { stepEngineChoice } from "../../../../utils/engine";
import type { Workflow } from "../../../../domain";
import { AiEngineModelPicker, useAiEnginesQuery, useThinkingHint } from "../../../ai-providers";
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
import { LoopFields } from "./LoopFields";
import type { SetGraph } from "./useGraphHistory";
import { usePhaseLabel } from "./usePhaseLabel";
import { useWdT } from "./useWdT";
import type { WorkflowDraft } from "./workflowDraft";

export const PROMPT_LIMIT = 20_000;
export const INSPECTOR_MIN = 300;
export const INSPECTOR_MAX = 640;

export enum InspectorTestId {
  Root = "wd-inspector",
  Resize = "wd-inspector-resize",
  Close = "wd-inspector-close",
  Delete = "wd-inspector-delete",
  PromptCount = "wd-prompt-count",
  Settings = "wd-workflow-settings",
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
  onClose: () => void;
}

const COMPLEXITIES = ["light", "standard", "deep"] as const;

/** Right inspector: the selected phase's sections, or the workflow-level settings when nothing is. */
export function Inspector(props: InspectorProps) {
  const { width, onWidthChange, selectedId, graph, editing, onClose } = props;
  const t = useWdT("workflowDetail.inspector");
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
      <Container height="100%" overflowY="auto">
        <Container padding="150">
          <Stack align="center" direction="row" gap="100" justify="between">
            <Typography truncate size="sm" type="note" weight="semibold">
              {node ? <PhaseTitle agents={props.agents} node={node} /> : t("workflowTitle")}
            </Typography>
            {node && (
              <Button
                aria-label={t("close")}
                data-testid={InspectorTestId.Close}
                icon="x"
                intent="ghost"
                onClick={onClose}
                size="sm"
              />
            )}
          </Stack>
        </Container>
        <Container inert={!editing || undefined}>
          {node ? <PhaseSections {...props} node={node} /> : <WorkflowSettings {...props} />}
        </Container>
      </Container>
    </Container>
  );
}

function PhaseTitle({ node, agents }: { node: GraphNode; agents: readonly Agent[] }) {
  const label = usePhaseLabel(agents);
  return <>{label(node)}</>;
}

function PhaseSections({ node, ...p }: InspectorProps & { node: GraphNode }) {
  const t = useWdT("workflowDetail.inspector");
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
  const setRunsOn = (v: string) => {
    const cleared = {
      engine: undefined,
      engineModel: undefined,
      openaiModel: undefined,
      include: undefined,
    } satisfies Partial<GraphNode>;
    if (v === "claude" || v === "opencode") return patch({ ...cleared, engine: v });
    if (v) {
      const keep = node.openaiModel ? { include: node.include } : {};
      return patch({ ...cleared, ...keep, openaiModel: v as OpenAiTextModel });
    }
    return patch(cleared);
  };
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

  return (
    <Stack data-testid={`wd-phase-${node.id}`} gap="0">
      <InspectorSection
        defaultOpen
        invalid={problemKinds.has("agent") || problemKinds.has("workflow")}
        title={t("who")}
      >
        <Stack gap="100">
          {node.type === "agent" && (
            <SelectField
              label={t("agent")}
              onValueChange={(a) => patch({ agent: a })}
              options={p.agents.map((a) => ({ value: a.id, label: a.name ?? a.id }))}
              value={node.agent}
            />
          )}
          {node.type === "workflow" && (
            <SelectField
              label={t("workflowLink")}
              onValueChange={(workflow) => patch({ workflow })}
              options={[{ value: "", label: t("workflowPick") }, ...childOptions]}
              value={node.workflow ?? ""}
            />
          )}
          {node.type === "system" && (
            <Typography mono size="xs" type="note" variant="tertiary">
              {t("systemAction", { action: node.action ?? "" })}
            </Typography>
          )}
          {node.type === "tool" && (
            <Typography size="xs" type="note" variant="tertiary">
              {t("toolHint")}
            </Typography>
          )}
        </Stack>
      </InspectorSection>

      {node.type === "agent" && (
        <InspectorSection defaultOpen summary={t("chars", { n: promptLen })} title={t("prompt")}>
          <Stack gap="75">
            <Container key={skillsReady ? "ready" : "loading"}>
              <CommandLine
                allowSkillMentions
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
        <InspectorSection defaultOpen invalid={problemKinds.has("commands")} title={t("commands")}>
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
        invalid={problemKinds.has("rework") || problemKinds.has("then")}
        summary={loop ? t("loopSummary", { n: loop.maxRetries ?? 1 }) : t("none")}
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
        summary={node.approval === "ask" ? t("on") : t("off")}
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
        <InspectorSection title={t("advanced")}>
          <Stack gap="150">
            <SelectField
              label={t("runsOn")}
              onValueChange={setRunsOn}
              options={[
                { value: "", label: t("runsOnAgent") },
                { value: "claude", label: "Claude Code" },
                { value: "opencode", label: "OpenCode" },
                ...OPENAI_TEXT_MODELS.map((m) => ({ value: m.id, label: `OpenAI · ${m.id}` })),
              ]}
              value={node.openaiModel ?? node.engine ?? ""}
            />
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
            {thinkingHint && !node.openaiModel && (
              <Typography leading="snug" size="2xs" type="note" variant="tertiary">
                {thinkingHint}
              </Typography>
            )}
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
                value={node.extra?.advisor}
              />
            </Stack>
          </Stack>
        </InspectorSection>
      )}

      <Container padding="150">
        <Button
          data-testid={InspectorTestId.Delete}
          icon="trash"
          intent="danger"
          onClick={() => {
            setGraph((g) => removeNode(g, node.id));
            p.onClose();
          }}
          size="sm"
        >
          {t("delete")}
        </Button>
      </Container>
    </Stack>
  );
}

function WorkflowSettings(p: InspectorProps) {
  const t = useWdT("workflowDetail.inspector");
  const { draft, onDraftChange, departments } = p;
  const set = (change: Partial<WorkflowDraft>) => onDraftChange({ ...draft, ...change });
  const order = orderNodes(p.graph);
  const label = usePhaseLabel(p.agents);
  return (
    <Stack data-testid={InspectorTestId.Settings} gap="0">
      <InspectorSection defaultOpen title={t("general")}>
        <Stack gap="100">
          <TextInputField
            label={t("name")}
            onChange={(e) => set({ name: e.target.value })}
            value={draft.name}
          />
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
            value={draft.department}
          />
          <SelectField
            label={t("complexity")}
            onValueChange={(c) => set({ complexity: c as WorkflowDraft["complexity"] })}
            options={COMPLEXITIES.map((c) => ({ value: c, label: t(`complexity_${c}`) }))}
            value={draft.complexity}
          />
          <TextInputField
            hint={t("projectHint")}
            label={t("project")}
            onChange={(e) => set({ project: e.target.value })}
            value={draft.project}
          />
          <ToggleField
            checked={draft.requiresWeb}
            label={t("requiresWeb")}
            onChange={(requiresWeb) => set({ requiresWeb })}
            size="sm"
          />
        </Stack>
      </InspectorSection>

      <InspectorSection
        summary={draft.maxCostUsd === null ? t("none") : `$${draft.maxCostUsd}`}
        title={t("budget")}
      >
        <Stack gap="100">
          <TextInputField
            hint={t("budgetHint")}
            inputMode="decimal"
            label={t("maxCost")}
            onChange={(e) => {
              const n = Number.parseFloat(e.target.value);
              set({ maxCostUsd: Number.isFinite(n) && n > 0 ? n : null });
            }}
            value={draft.maxCostUsd === null ? "" : String(draft.maxCostUsd)}
          />
          <Stack align="center" direction="row" gap="100" justify="between">
            <Typography size="sm" type="note">
              {t("warnAt")}
            </Typography>
            <Stepper
              aria-label={t("warnAt")}
              max={100}
              min={1}
              onChange={(warnAtPct) => set({ warnAtPct })}
              step={5}
              value={draft.warnAtPct}
            />
          </Stack>
        </Stack>
      </InspectorSection>

      <InspectorSection title={t("advisor")}>
        <AdvisorFields
          forkTargets={order.map((n) => ({ id: n.id, label: label(n) }))}
          onChange={(v) => set({ advisor: v === false ? undefined : v })}
          phaseLevel={false}
          value={draft.advisor}
        />
      </InspectorSection>

      <InspectorSection title={t("instructions")}>
        <TextAreaField
          hint={t("instructionsHint")}
          label={t("instructions")}
          onChange={(e) => set({ instructions: e.target.value })}
          rows={6}
          value={draft.instructions}
        />
      </InspectorSection>

      <InspectorSection summary={String(draft.outputs.length)} title={t("outputs")}>
        <OutputsEditor
          onChange={(outputs) => set({ outputs })}
          outputs={draft.outputs}
          produces={p.graph.nodes.map((n) => n.produces).filter(Boolean)}
        />
      </InspectorSection>
    </Stack>
  );
}
