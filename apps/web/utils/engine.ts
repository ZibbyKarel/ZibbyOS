import {
  type AiEngine,
  type AiEngineStatus,
  type ModelTier,
  type OpencodeTierModels,
  type SystemConfig,
  resolveTierModel,
} from "@zibby/contracts";

/** "opencode · provider/model" for a run that carries an engine; `undefined` for plain Claude runs. */
export function formatEngine(engine?: string, model?: string): string | undefined {
  return engine ? (model ? `${engine} · ${model}` : engine) : undefined;
}

/**
 * The engine and exact model a step will really run on: the step's own override, then its
 * agent's (backend precedence `phase.engineModel ?? agent.engineModel`). `engineModel` only
 * applies on opencode; without one the tier mapping decides. `engine` undefined = global engine.
 */
export function stepEngineChoice(
  step: { engine?: AiEngine | undefined; engineModel?: string | undefined } | undefined,
  agent: { engine?: AiEngine | undefined; engineModel?: string | undefined } | undefined,
): { engine: AiEngine | undefined; engineModel: string | undefined } {
  const engine = step?.engine ?? agent?.engine;
  return {
    engine,
    engineModel: engine === "opencode" ? (step?.engineModel ?? agent?.engineModel) : undefined,
  };
}

/** The native Claude model a tier is passed to as `--model`. */
const CLAUDE_TIER_NAME: Record<ModelTier, string> = {
  haiku: "Haiku",
  sonnet: "Sonnet",
  opus: "Opus",
  fable: "Fable",
};

/**
 * The concrete model a tier runs on for an engine: the Claude name natively, the resolved
 * opencode `provider/model` otherwise (`""` when nothing is mapped and no default is set).
 */
export function tierConcreteModel(
  tier: ModelTier,
  engine: AiEngine,
  tierModels: OpencodeTierModels | undefined,
  fallback: string,
  listed?: readonly string[],
): string {
  return engine === "claude"
    ? CLAUDE_TIER_NAME[tier]
    : resolveTierModel(tier, tierModels, fallback, listed);
}

/**
 * The model ids the catalog lists, for `resolveTierModel`'s fallback; `undefined` (trust the
 * mapping) unless opencode is available and lists at least one model.
 */
export function catalogIds(engines: AiEngineStatus[] | undefined): string[] | undefined {
  const oc = engines?.find((e) => e.id === "opencode");
  return oc?.available && oc.models?.length ? oc.models.map((m) => m.id) : undefined;
}

/**
 * Whether an opencode model lacks the `level` thinking variant, so a run would go without it.
 * An explicit `#variant` in the model string wins (never flagged); a model missing from the
 * list is unknown, not flagged.
 */
export function lacksThinkingVariant(
  models: { id: string; variants: string[] }[],
  model: string,
  level: string,
): boolean {
  if (!model || !level || model.includes("#")) return false;
  const found = models.find((m) => m.id === model);
  return found !== undefined && !found.variants.includes(level);
}

/** The engine mark an avatar's corner badge shows. */
export type EngineMark = "claude" | "openai" | "opencode";

/**
 * Which mark an entity's badge shows: its effective engine (override ?? global) → `claude`; on
 * opencode, an `openai/` model (explicit `engineModel`, else the tier's mapping) → `openai`,
 * anything else → `opencode`. Mirrors the API's `resolveAiEngine`.
 */
export function engineMark(
  target: { engine?: AiEngine | undefined; engineModel?: string | undefined; model?: ModelTier },
  config: Pick<SystemConfig, "aiEngine" | "opencodeModel" | "opencodeTierModels"> | undefined,
  listed?: readonly string[],
): EngineMark {
  const engine = target.engine ?? config?.aiEngine ?? "claude";
  if (engine === "claude") return "claude";
  const model =
    target.engineModel ??
    resolveTierModel(
      target.model ?? "sonnet",
      config?.opencodeTierModels,
      config?.opencodeModel ?? "",
      listed,
    );
  return model.startsWith("openai/") ? "openai" : "opencode";
}

const MARK_ORDER: readonly EngineMark[] = ["claude", "openai", "opencode"];

/**
 * The `engineMark` target of one agent step. Mirrors the API's `stageEngineTarget`: the step's
 * engine / model over the agent's; an OpenAI text model runs as `openai/` on opencode.
 */
export function stepEngineTarget(
  step: {
    engine?: AiEngine | undefined;
    engineModel?: string | undefined;
    model?: ModelTier | undefined;
    openaiModel?: string | undefined;
  },
  agent: { engine?: AiEngine | undefined; engineModel?: string | undefined } | undefined,
): { engine?: AiEngine; engineModel?: string; model?: ModelTier } {
  if (step.openaiModel) return { engine: "opencode", engineModel: `openai/${step.openaiModel}` };
  return {
    engine: step.engine ?? agent?.engine,
    engineModel: step.engineModel ?? agent?.engineModel,
    model: step.model,
  } as { engine?: AiEngine; engineModel?: string; model?: ModelTier };
}

/**
 * Every distinct engine mark a workflow's agent steps run on (claude, openai, opencode order).
 * Without agent steps it is the global engine's mark alone (`markOf({})`).
 */
export function workflowEngineMarks(
  steps: readonly {
    type?: string | undefined;
    agent?: string | undefined;
    engine?: AiEngine | undefined;
    engineModel?: string | undefined;
    model?: ModelTier | undefined;
    openaiModel?: string | undefined;
  }[],
  agents: readonly {
    id: string;
    engine?: AiEngine | undefined;
    engineModel?: string | undefined;
  }[],
  markOf: (target: ReturnType<typeof stepEngineTarget>) => EngineMark,
): EngineMark[] {
  const found = new Set(
    steps
      .filter((s) => (s.type ?? "agent") === "agent")
      .map((s) =>
        markOf(
          stepEngineTarget(
            s,
            agents.find((a) => a.id === s.agent),
          ),
        ),
      ),
  );
  if (!found.size) found.add(markOf({}));
  return MARK_ORDER.filter((m) => found.has(m));
}
