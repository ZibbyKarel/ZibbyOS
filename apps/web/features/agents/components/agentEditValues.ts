import type {
  Agent,
  AgentModel,
  AgentThinking,
  AiEngine,
  DepartmentId,
  GateRuleInput,
  GlobalGateRule,
  Risk,
} from "@zibby/contracts";

/**
 * Shape of the agent edit form — shared by the detail screen and the create
 * dialog (each owns its form instance) and the extracted field sections that
 * render against it.
 */
export type AgentEditValues = {
  name: string;
  /** O-03: a human name for the position ("Kevin"), shown as `displayName ?? name`. */
  displayName: string;
  /** O-03: a short job title, shown next to `displayName`. */
  title: string;
  description: string;
  glyph: string;
  model: AgentModel;
  thinking: AgentThinking;
  tools: string[];
  /** Per-agent run engine; `""` = use the global setting. */
  engine: AiEngine | "";
  /** opencode `provider/model` (only meaningful with `engine: "opencode"`). */
  engineModel: string;
  category: string;
  instructions: string;
  /** NS2 F1: the department that owns this agent (write-required by the API). */
  department: DepartmentId;
  /** The agent's own approval-gate rules (frontmatter `gates`). */
  gates: GateRuleInput[];
  /** Ids of linked global catalog rules (frontmatter `gateRuleIds`). */
  gateRuleIds: string[];
  /** Advanced tools: the ceiling of tool/MCP ids grantable per run. */
  optionalTools: string[];
  /** Advanced tools: Claude Code plugin directories the runs load. */
  plugins: string[];
  /** Display-only risk hint; `""` = never set. */
  risk: Risk | "";
  /** Legacy approval sugar — every run asks first. */
  requiresApproval: boolean;
};

/** Routing reads only the first 512 characters of `description` (the schema's max). */
export const ROUTING_LIMIT = 512;

/** The form's cards, in the order the unsaved bar lists them. */
export type AgentSection = "instructions" | "identity" | "routing" | "engine" | "tools" | "rules";

const SECTION_FIELDS: Record<AgentSection, ReadonlyArray<keyof AgentEditValues>> = {
  instructions: ["instructions"],
  identity: ["name", "displayName", "title", "category", "department", "glyph"],
  routing: ["description"],
  engine: ["model", "thinking", "engine", "engineModel"],
  tools: ["tools", "optionalTools", "plugins", "risk", "requiresApproval"],
  rules: ["gates", "gateRuleIds"],
};

/** Which cards differ between the saved values and the current form values. */
export function dirtySections(saved: AgentEditValues, current: AgentEditValues): AgentSection[] {
  return (Object.keys(SECTION_FIELDS) as AgentSection[]).filter((section) =>
    SECTION_FIELDS[section].some((k) => JSON.stringify(saved[k]) !== JSON.stringify(current[k])),
  );
}

/** The agent's persisted fields as form defaults (used on open and on edit-reset). */
export function toFormValues(agent: Agent): AgentEditValues {
  return {
    name: agent.name ?? "",
    displayName: agent.displayName ?? "",
    title: agent.title ?? "",
    description: agent.description ?? "",
    glyph: agent.glyph ?? "",
    model: agent.model ?? "sonnet",
    thinking: agent.thinking ?? "medium",
    tools: agent.tools ?? [],
    engine: agent.engine ?? "",
    engineModel: agent.engineModel ?? "",
    category: agent.category ?? "",
    instructions: agent.instructions,
    department: agent.department ?? "dev",
    gates: agent.gates ?? [],
    gateRuleIds: agent.gateRuleIds ?? [],
    optionalTools: agent.optionalTools ?? [],
    plugins: agent.plugins ?? [],
    risk: agent.risk ?? "",
    requiresApproval: agent.requires_approval ?? false,
  };
}

/** Convert an own rule into the shape `RuleModal` prefills from (a global rule). */
export function ownRuleToInitial(gate: GateRuleInput): GlobalGateRule {
  return {
    id: "own",
    match: gate.match,
    decision: gate.decision,
    ...(gate.resolve ? { resolve: gate.resolve } : {}),
  };
}

/** Merge submitted form values back onto the agent (empty strings → absent). */
export function applyFormValues(agent: Agent, values: AgentEditValues): Agent {
  const out: Agent = {
    ...agent,
    name: values.name || undefined,
    displayName: values.displayName || undefined,
    title: values.title || undefined,
    description: values.description || undefined,
    glyph: values.glyph || undefined,
    model: values.model,
    thinking: values.thinking,
    tools: values.tools,
    engine: values.engine || undefined,
    engineModel: values.engine === "opencode" ? values.engineModel || undefined : undefined,
    category: values.category || undefined,
    instructions: values.instructions,
    department: values.department,
    gates: values.gates,
    gateRuleIds: values.gateRuleIds,
    risk: values.risk || undefined,
  };
  // A dropped key means "unchanged" on a partial update, so these go out as explicit
  // `false` / `[]` — but only where the agent already carried the field or it is now set.
  if (values.requiresApproval || agent.requires_approval !== undefined)
    out.requires_approval = values.requiresApproval;
  if (values.plugins.length || agent.plugins) out.plugins = values.plugins;
  if (values.optionalTools.length || agent.optionalTools) out.optionalTools = values.optionalTools;
  return out;
}

/** A read-only sketch of the YAML frontmatter the backend generates from the settings cards. */
export function frontmatterPreview(v: AgentEditValues): string {
  const scalar = (k: string, val: string) => (val ? [`${k}: ${val}`] : []);
  const list = (k: string, val: string[]) => (val.length ? [`${k}: [${val.join(", ")}]`] : []);
  return [
    "---",
    ...scalar("name", v.name),
    ...scalar("displayName", v.displayName),
    ...scalar("title", v.title),
    ...scalar("department", v.department),
    ...scalar("category", v.category),
    ...scalar("model", v.model),
    ...scalar("thinking", v.thinking),
    ...scalar("engine", v.engine),
    ...scalar("engineModel", v.engineModel),
    ...list("tools", v.tools),
    ...list("gateRuleIds", v.gateRuleIds),
    ...(v.gates.length
      ? [`gates: ${v.gates.length} own rule${v.gates.length === 1 ? "" : "s"}`]
      : []),
    "---",
  ].join("\n");
}
