import type { Agent } from "@zibby/contracts";
import {
  Container,
  Icon,
  Stack,
  StatusDot,
  Tag,
  Typography,
  WorkflowPipelineCard,
  type WorkflowPipelineNode,
} from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import type { Workflow } from "../../../domain";
import { useEngineBadge } from "../../ai-providers";
import { relativeLabel } from "../../automations/schedule";
import type { RunView } from "../../runs/run";
import {
  activePhaseNumber,
  outputLabel,
  phaseAgent,
  pipelineStates,
  runMinutes,
} from "../workflowListModel";

export interface WorkflowListCardProps {
  workflow: Workflow;
  agents: Agent[];
  /** Department code shown as the tag ("ENG"). */
  departmentCode?: string | undefined;
  /** The workflow's newest run, if any (drives the last-run line and the live pipeline). */
  run: RunView | null;
  /** Frozen "now" so the relative time is stable across renders. */
  now: number;
  onOpen: (id: string) => void;
}

const WAITING = new Set([
  "awaiting-approval",
  "held",
  "parked",
  "paused",
  "paused-limit",
  "queued",
]);

/** The Workflow list card: info column with the last run, plus the phase pipeline. */
export function WorkflowListCard({
  workflow,
  agents,
  departmentCode,
  run,
  now,
  onOpen,
}: WorkflowListCardProps) {
  const t = useTranslations("workflows");
  const tAgents = useTranslations("agents");
  const locale = useLocale();
  const engineBadge = useEngineBadge();
  const states = pipelineStates(workflow.phases, run);

  const nodes: WorkflowPipelineNode[] = workflow.phases.map((phase, i) => {
    const agent = phaseAgent(phase, agents);
    const base = {
      id: phase.id ?? String(i),
      index: String(i + 1).padStart(2, "0"),
      name: phase.id ?? phase.agent ?? phase.type,
      state: states[i] ?? "idle",
    };
    if (phase.type === "agent" && phase.agent) {
      const mark = engineBadge({
        engine: phase.engine ?? agent?.engine,
        engineModel: phase.engineModel ?? agent?.engineModel,
        model: phase.model ?? agent?.model,
      });
      return {
        ...base,
        who: agent?.displayName ?? agent?.name ?? phase.agent,
        engine: mark.engine,
      };
    }
    if (phase.type === "workflow" && phase.workflow) return { ...base, who: phase.workflow };
    // A fan-out is one node, labelled with its branch count ("publish ×2").
    if (phase.type === "parallel")
      return { ...base, name: `${base.name} ×${phase.branches?.length ?? 0}` };
    return base;
  });

  const out = workflow.outputs[0];
  const sink = out ? outputLabel(out) : null;
  const output = sink
    ? {
        label: sink.kind === "pr" ? t("list.outputPr") : (sink.to ?? t("list.outputFile")),
        icon: <Icon name={sink.kind === "pr" ? "branch" : "doc"} size="sm" />,
      }
    : undefined;

  return (
    <WorkflowPipelineCard
      ariaLabel={workflow.name}
      description={workflow.desc}
      icon={<Icon name="flow" size="md" />}
      last={<LastRun locale={locale} now={now} run={run} workflow={workflow} />}
      meta={
        <>
          {departmentCode && <Tag tone="neutral">{departmentCode}</Tag>}
          <span>{tAgents("phaseCount", { count: workflow.phases.length })}</span>
        </>
      }
      nodes={nodes}
      onClick={() => onOpen(workflow.id)}
      output={output}
      title={workflow.name}
    />
  );
}

function LastRun({
  run,
  workflow,
  now,
  locale,
}: {
  run: RunView | null;
  workflow: Workflow;
  now: number;
  locale: string;
}) {
  const t = useTranslations("workflows");
  if (!run) {
    return (
      <Typography size="caption" type="note" variant="tertiary">
        {t("list.neverRun")}
      </Typography>
    );
  }
  const started = Date.parse(run.startedAt);
  const ago = relativeLabel(started, now, locale);
  const minutes = runMinutes(run);
  let tone: "working" | "done" | "error" | "blocked" = "done";
  let text: string;
  if (run.status === "running") {
    tone = "working";
    const phase = activePhaseNumber(workflow.phases, run);
    const elapsed = Math.max(1, Math.round((now - started) / 60_000));
    text = phase
      ? t("list.running", { min: elapsed, phase, total: workflow.phases.length })
      : t("list.runningShort", { min: elapsed });
  } else if (run.status === "error" || run.status === "interrupted") {
    tone = "error";
    text = t("list.failed", { ago });
  } else if (WAITING.has(run.status)) {
    tone = "blocked";
    text = t("list.waiting");
  } else {
    text = minutes ? t("list.finished", { ago, min: minutes }) : ago;
  }
  return (
    <Container grow>
      <Stack align="center" direction="row" gap="100" justify="between">
        <Stack align="center" direction="row" gap="100">
          <StatusDot tone={tone} />
          <Typography size="caption" type="note">
            {text}
          </Typography>
        </Stack>
        {run.costUsd !== undefined && (
          <Typography mono size="caption" type="note" variant="tertiary">
            ${run.costUsd.toFixed(2)}
          </Typography>
        )}
      </Stack>
    </Container>
  );
}
