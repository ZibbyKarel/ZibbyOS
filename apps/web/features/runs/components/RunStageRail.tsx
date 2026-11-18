"use client";

import {
  AgentBadge,
  Button,
  Container,
  Divider,
  Icon,
  RailItem,
  type RailItemTense,
  Stack,
  StatusDot,
  Typography,
} from "@zibby/design-system";
import { ModelTierSchema } from "@zibby/contracts";
import { useTranslations } from "next-intl";
import { useDepartmentLookup } from "../../departments/useDepartmentLookup";
import { useAgentSymbol } from "../../agents";
import { useAgentsQuery } from "../../agents/queries";
import { useTierLabel } from "../../ai-providers";
import { ModelBadge } from "../../../components/RuntimeBadges/RuntimeBadges";
import { stepEngineChoice } from "../../../utils/engine";
import { toClientTarget } from "../../tasks";
import { useWorkflowsQuery } from "../../workflows/queries";
import { toolOpenAiImageModel } from "../../workflows/openaiImageModel";
import type { RunView } from "../run";
import type { StageRailRow } from "../runDetailModel";
import { stageModel } from "../stageModel";

export enum RunStageRailTestId {
  Root = "run-stage-rail",
  /** Suffixed with the phase id, e.g. `run-stage-rail-stage-coder`. */
  Stage = "run-stage-rail-stage",
  Routed = "run-stage-rail-routed",
  Checkpoint = "run-stage-rail-checkpoint",
  /** Suffixed with the phase id, e.g. `run-stage-rail-model-coder`. */
  Model = "run-stage-rail-model",
  /** Suffixed with the phase id: the nested loop rounds of that phase. */
  Loop = "run-stage-rail-loop",
  Folder = "run-stage-rail-folder",
}

export interface RunStageRailProps {
  run: RunView;
  rows: StageRailRow[];
  selectedPhaseId: string | null;
  onSelect: (phaseId: string) => void;
  /** Opens the run's task folder — the link at the bottom of the rail. */
  onOpenFolder?: () => void;
  /** Phone: the stages scroll sideways above the log instead of stacking. */
  horizontal?: boolean;
}

/** done → past (check), queued → future (dashed), anything else is happening now. */
function tenseOf(row: StageRailRow): RailItemTense {
  return row.stateKey === "done" || row.stateKey === "skipped"
    ? "past"
    : row.stateKey === "queued"
      ? "future"
      : "present";
}

/** `SWITCHBOARD → {dept} → {unit} · {pct}%` — the switchboard's routing trace, or null when the run was never classified. */
function useRouteTrace(run: RunView): string | null {
  const t = useTranslations("runs.detail.rail");
  const departments = useDepartmentLookup();
  const c = run.classification;
  if (!c) return null;
  const dept = c.department ? departments.name(c.department) : null;
  // Delegated to a department → the unit is whatever the run resolved to; otherwise stage-1 picked it.
  const unit = dept ? (run.processor?.name ?? run.owner) : toClientTarget(c.stage1).name;
  return [t("switchboard"), dept, `${unit} · ${Math.round(c.confidence * 100)}%`]
    .filter(Boolean)
    .join(" → ");
}

/** The run's stage timeline: past / present / future markers, who ran (or will run) each stage on which model, the route, checkpoints and loop rounds; the task folder link at the bottom. */
export function RunStageRail({
  run,
  rows,
  selectedPhaseId,
  onSelect,
  onOpenFolder,
  horizontal,
}: RunStageRailProps) {
  const t = useTranslations("runs.detail");
  const route = useRouteTrace(run);
  const symbolOf = useAgentSymbol();
  // A stage row is named by its phase id; the symbol belongs to the phase's agent.
  const { data: workflows } = useWorkflowsQuery();
  const phases = run.kind === "workflow" ? workflows?.find((w) => w.id === run.owner)?.phases : [];
  const phaseOf = (phaseId: string) => phases?.find((p) => p.id === phaseId);
  const agentOf = (phaseId: string) =>
    run.kind === "workflow" ? (phaseOf(phaseId)?.agent ?? phaseId) : run.owner;
  const { data: agents } = useAgentsQuery();
  const tierLabel = useTierLabel();
  /** Concrete engine model when the phase/agent pins one, else the tier as a level label. */
  const labelOf = (row: StageRailRow, model: string | undefined) => {
    const phase = phaseOf(row.phaseId);
    const agent = agents?.find((a) => a.id === agentOf(row.phaseId));
    if (!model || phase?.openaiModel || toolOpenAiImageModel(phase?.commands)) return undefined;
    const { engine, engineModel: exact } = stepEngineChoice(phase, agent);
    const tier = ModelTierSchema.safeParse(model).data;
    return exact ?? (tier ? tierLabel(tier, engine) : undefined);
  };
  const modelOf = (row: StageRailRow) => {
    const phase = phaseOf(row.phaseId);
    const imageModel = toolOpenAiImageModel(phase?.commands);
    if (imageModel) return imageModel;
    return stageModel(
      phase,
      agents?.find((a) => a.id === agentOf(row.phaseId)),
      row.retries + 1,
    );
  };
  const checkpoints = run.checkpoints ?? [];
  const selected = selectedPhaseId ?? rows.find((r) => r.current)?.phaseId ?? null;

  const items = rows.map((row, i) => {
    const tense = tenseOf(row);
    const phase = phaseOf(row.phaseId);
    const agentName =
      run.kind === "workflow" ? agentOf(row.phaseId) : (run.processor?.name ?? run.owner);
    const model = modelOf(row);
    const stateWord = t(`stage.${row.stateKey}`);
    const aside =
      tense === "past"
        ? row.meta
        : tense === "future"
          ? undefined
          : row.meta === "—"
            ? stateWord
            : `${stateWord} · ${row.meta}`;
    const rowCheckpoints = checkpoints.filter((c) => c.phaseId === row.phaseId);
    const loopMax = phase?.loop?.maxRetries;
    const showLoop = row.rounds.length > 1 || (loopMax != null && row.rounds.length > 0);
    return (
      <RailItem
        aside={aside}
        data-testid={`${RunStageRailTestId.Stage}-${row.phaseId}`}
        key={row.phaseId}
        markerTone={row.state}
        meta={
          <>
            <span>{t(`rail.who.${tense}`)}</span>
            <AgentBadge {...symbolOf(agentOf(row.phaseId))} size="xs" />
            <Typography as="span" size="xs" type="note" variant="secondary" weight="semibold">
              {agentName}
            </Typography>
            <span data-testid={`${RunStageRailTestId.Model}-${row.phaseId}`}>
              <ModelBadge
                label={labelOf(row, model)}
                model={model ?? t("rail.defaultModel")}
                provider={
                  phase?.openaiModel || toolOpenAiImageModel(phase?.commands) ? "openai" : undefined
                }
              />
            </span>
          </>
        }
        onClick={() => onSelect(row.phaseId)}
        running={row.state === "working"}
        selected={row.phaseId === selected}
        tense={tense}
        title={`${row.n} · ${row.name}`}
      >
        {(i === 0 && route) || rowCheckpoints.length > 0 || showLoop ? (
          <>
            {i === 0 && route && (
              <Typography
                mono
                as="span"
                data-testid={RunStageRailTestId.Routed}
                size="xs"
                type="note"
                variant="secondary"
              >
                {route}
              </Typography>
            )}
            {rowCheckpoints.map((c) => (
              <Stack
                inline
                align="center"
                as="span"
                data-testid={RunStageRailTestId.Checkpoint}
                direction="row"
                gap="50"
                key={`${c.phaseId}-${c.sha}`}
              >
                <Icon name="checkpoint" size="xs" />
                <Typography mono as="span" size="xs" type="note" variant="secondary">
                  {t("rail.checkpoint", { sha: c.sha.slice(0, 7) })}
                </Typography>
              </Stack>
            ))}
            {showLoop && (
              <Stack as="span" data-testid={`${RunStageRailTestId.Loop}-${row.phaseId}`} gap="25">
                <Stack inline align="center" as="span" direction="row" gap="50">
                  <Icon name="retry" size="xs" />
                  <Typography as="span" size="xs" type="note" variant="secondary">
                    {loopMax != null ? t("rail.loopMax", { n: loopMax }) : t("rail.loop")}
                  </Typography>
                </Stack>
                {row.rounds.map((r) => (
                  <Stack inline align="center" as="span" direction="row" gap="75" key={r.n}>
                    <StatusDot size="50" tone={r.state} />
                    <Typography as="span" size="xs" type="note" variant="secondary">
                      {t("feed.round", { n: r.n })}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </>
        ) : null}
      </RailItem>
    );
  });

  return (
    <Stack grow data-testid={RunStageRailTestId.Root} gap="0">
      <Container padding={["150", "200", "100", "200"]}>
        <Stack align="center" direction="row" justify="between">
          <Typography as="span" type="labelSm">
            {t("rail.title", { n: String(rows.length).padStart(2, "0") })}
          </Typography>
          <Typography mono as="span" type="labelSm">
            {`${rows.filter((r) => r.stateKey === "done").length} / ${rows.length}`}
          </Typography>
        </Stack>
      </Container>
      {horizontal ? (
        <Container overflow="auto">
          <Stack direction="row" gap="0">
            {items.map((item) => (
              <Container key={item.key} shrink={false} width="240px">
                {item}
              </Container>
            ))}
          </Stack>
        </Container>
      ) : (
        items
      )}
      {!horizontal && <Container grow />}
      {onOpenFolder && (
        <>
          <Divider />
          <Container padding={["100", "200"]}>
            <Button
              block
              data-testid={RunStageRailTestId.Folder}
              intent="ghost"
              onClick={onOpenFolder}
              size="sm"
            >
              {t("rail.openFolder")}
            </Button>
          </Container>
        </>
      )}
    </Stack>
  );
}
