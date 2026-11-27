/**
 * Pure graph model for the workflow node-graph editor, and its conversion to/from
 * the contract's flat `phases[]`. Kept dependency-free and side-effect-free so the
 * canvas component is a thin shell over it and the tricky logic (ordering,
 * consumes-threading, upstream-only rework, validation) is unit-testable.
 *
 * The graph is **one-out / one-in** per node (a teammate constraint), so it is
 * always linearizable: `graphToPhases` walks the flow edges into an ordered chain.
 * Node x/y positions are *not* persisted — `phasesToGraph` re-derives a
 * left-to-right layout when an existing workflow is opened.
 */
import type {
  Agent,
  AgentModel,
  AgentThinking,
  AiEngine,
  CreateWorkflowInput,
  OpenAiTextModel,
} from "@zibby/contracts";
import type { PhaseEscalation, PhaseLoop, Workflow, WorkflowPhase } from "../../../../domain";
import { slug } from "../../../../utils/slug";

export type ContractPhase = CreateWorkflowInput["phases"][number];

// ---- geometry (shared with the canvas component) --------------------------
export const NODE_W = 188;
export const NODE_H = 64;
export const GAP_X = 84;
export const CANVAS_W = 1680;
export const CANVAS_H = 940;
/** Where `phasesToGraph` lays the first node, and the per-node step. */
const LAYOUT_X0 = 56;
const LAYOUT_Y0 = 200;

/**
 * The file the first agent picks up as its assignment — ZIBBY-internal
 * convention, never surfaced in the UI. The first phase always `consumes` this;
 * an edited workflow keeps whatever its first phase already consumed.
 */
export const INITIAL_ASSIGNMENT = "task.md";

/** Every phase key the editor owns; the rest of a phase rides along in `GraphNode.extra`. */
const EDITED_PHASE_KEYS = [
  "id",
  "type",
  "workflow",
  "branches",
  "action",
  "agent",
  "consumes",
  "produces",
  "model",
  "thinking",
  "commands",
  "loop",
  "approval",
  "qualify",
  "prompt",
  "skill",
  "openaiModel",
  "engine",
  "engineModel",
  "include",
] as const satisfies readonly (keyof WorkflowPhase)[];
export type PhaseExtra = Omit<WorkflowPhase, (typeof EDITED_PHASE_KEYS)[number]>;

function extraOf(ph: WorkflowPhase): PhaseExtra | undefined {
  const rest = Object.entries(ph).filter(
    ([k]) => !(EDITED_PHASE_KEYS as readonly string[]).includes(k),
  );
  return rest.length ? (Object.fromEntries(rest) as PhaseExtra) : undefined;
}

export interface GraphNode {
  /** Durable phase id — loop targets reference it; an edited workflow keeps it. */
  id: string;
  type: "agent" | "tool" | "workflow" | "system" | "parallel";
  /** `parallel` step: the child workflows fanned out at once (read-only here, edited in the recipe). */
  branches?: NonNullable<WorkflowPhase["branches"]>;
  /** `system` step: the registered action id (preserved on round-trip, not editable here). */
  action?: string;
  /** `workflow` step: the child workflow id this step runs as a sub-run ("" = not chosen yet). */
  workflow?: string;
  /** Agent id (empty for tool/workflow phases). */
  agent: string;
  /** Output file this node writes (= the `consumes` of its flow successor). */
  produces: string;
  /** Tool commands, one per line. */
  commands: string;
  /** Human checkpoint after this phase (`"ask"`); absent = autonomous. */
  approval?: "ask";
  /** Agent phase verdict gate — not editable here, preserved on round-trip. */
  qualify?: boolean;
  /** Agent phase only: the operator's custom prompt (may contain a `/skill` token). */
  prompt?: string;
  /** Agent phase only: the skill id picked via `/` in the prompt. */
  skill?: string;
  /** Agent phase only: run on this OpenAI text model instead of local claude. */
  openaiModel?: OpenAiTextModel;
  /** Agent phase only: force this engine for the step (absent = agent / global engine). */
  engine?: AiEngine;
  /** Agent phase with `engine: "opencode"` only: exact `provider/model` (absent = the tier's). */
  engineModel?: string;
  /** Agent phase with `openaiModel` only: extra run-relative files, one path per entry. */
  include?: string[];
  model: AgentModel;
  thinking: AgentThinking;
  /**
   * A loop whose `to` can't be drawn as a rework edge (e.g. `loop.to: "fail"`, or
   * a target that isn't a node). Preserved verbatim so editing an existing
   * workflow never silently drops it; the canvas just can't show it.
   */
  looseLoop?: PhaseLoop;
  /**
   * Phase fields the editor never touches (e.g. `advisor`), kept verbatim and spread back by
   * `graphToPhases` so a new contract field is carried through an edit instead of dropped.
   */
  extra?: PhaseExtra;
  x: number;
  y: number;
}

/** I/O hand-off: source output → exactly one target input. */
export interface FlowEdge {
  id: string;
  from: string;
  to: string;
}

/**
 * Rework (back-edge): on failure, return work to an **earlier** node. The canvas
 * only edits `maxRetries` + `escalate` (the teammate spec); `then` and the
 * `escalation` ladder are preserved across an edit round-trip but not exposed.
 */
export interface ReworkEdge {
  id: string;
  from: string;
  to: string;
  maxRetries: number;
  escalate: boolean;
  then: string;
  escalation: PhaseEscalation[];
  /** Preserved on round-trip (not editable on the canvas). */
  driftTo?: string;
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  flow: FlowEdge[];
  rework: ReworkEdge[];
}

// ---- ids ------------------------------------------------------------------
let _gid = 0;
/** Session-unique id for a freshly-created node/edge (stable within an edit). */
export const guid = (prefix: string): string => `${prefix}-${++_gid}`;

// ---- layout / construction ------------------------------------------------
/** Default output filename for a new node (agent slug, falling back to index). */
export const defaultProduces = (agentId: string, index: number): string =>
  `${slug(agentId, `handoff-${index}`)}.md`;

/** A fresh node for an agent dropped/clicked from the palette. */
export function makeNode(agent: Agent, index: number, x: number, y: number): GraphNode {
  return {
    id: guid("n"),
    type: "agent",
    agent: agent.id,
    produces: defaultProduces(agent.id, index),
    commands: "",
    model: agent.model ?? "sonnet",
    thinking: agent.thinking ?? "medium",
    x: clamp(x, 8, CANVAS_W - NODE_W - 8),
    y: clamp(y, 8, CANVAS_H - NODE_H - 8),
  };
}

/** A fresh tool or sub-workflow (`workflow`) node (no agent) from the palette. */
export function makeStepNode(
  type: "tool" | "workflow",
  index: number,
  x: number,
  y: number,
): GraphNode {
  return {
    id: guid("n"),
    type,
    agent: "",
    ...(type === "workflow" ? { workflow: "" } : {}),
    produces: `step-${index}.md`,
    commands: "",
    model: "sonnet",
    thinking: "medium",
    x: clamp(x, 8, CANVAS_W - NODE_W - 8),
    y: clamp(y, 8, CANVAS_H - NODE_H - 8),
  };
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// ---- phases → graph (auto-layout on open) ---------------------------------
/**
 * Build the editor graph from a workflow's `phases[]`, laying nodes left-to-right.
 * Flow edges connect consecutive phases; a phase with a `loop` becomes a rework
 * edge to the phase whose id matches `loop.to`. Returns an empty graph for a new
 * workflow (no `initial`).
 */
export function phasesToGraph(initial: Workflow | undefined, agents: Agent[]): WorkflowGraph {
  if (!initial || initial.phases.length === 0) {
    return { nodes: [], flow: [], rework: [] };
  }
  const nodes: GraphNode[] = initial.phases.map((ph, i) => ({
    id: ph.id ?? `phase-${i + 1}`,
    type: ph.type,
    ...(ph.type === "workflow" ? { workflow: ph.workflow ?? "" } : {}),
    ...(ph.type === "system" ? { action: ph.action ?? "" } : {}),
    ...(ph.type === "parallel" ? { branches: ph.branches ?? [] } : {}),
    agent: ph.type === "agent" ? (ph.agent ?? agents[0]?.id ?? "") : "",
    produces: ph.produces ?? defaultProduces(ph.agent ?? "output", i + 1),
    commands: (ph.commands ?? []).join("\n"),
    ...(ph.approval ? { approval: ph.approval } : {}),
    ...(ph.qualify ? { qualify: ph.qualify } : {}),
    ...(ph.prompt ? { prompt: ph.prompt } : {}),
    ...(ph.skill ? { skill: ph.skill } : {}),
    ...(ph.type === "agent" && ph.openaiModel ? { openaiModel: ph.openaiModel } : {}),
    ...(ph.type === "agent" && ph.engine ? { engine: ph.engine } : {}),
    ...(ph.type === "agent" && ph.engine === "opencode" && ph.engineModel
      ? { engineModel: ph.engineModel }
      : {}),
    ...(ph.type === "agent" && ph.openaiModel && ph.include?.length ? { include: ph.include } : {}),
    ...(extraOf(ph) ? { extra: extraOf(ph) } : {}),
    model: ph.model ?? "sonnet",
    thinking: ph.thinking ?? "medium",
    x: LAYOUT_X0 + i * (NODE_W + GAP_X),
    y: LAYOUT_Y0,
  }));
  const flow: FlowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    flow.push({ id: guid("e"), from: nodes[i]!.id, to: nodes[i + 1]!.id });
  }
  const rework: ReworkEdge[] = [];
  initial.phases.forEach((ph, i) => {
    if (!ph.loop) return;
    const target = nodes.find((n) => n.id === ph.loop!.to);
    if (target) {
      rework.push({
        id: guid("w"),
        from: nodes[i]!.id,
        to: target.id,
        maxRetries: ph.loop.maxRetries,
        escalate: ph.loop.escalate,
        then: ph.loop.then,
        escalation: ph.loop.escalation ?? [],
        ...(ph.loop.driftTo ? { driftTo: ph.loop.driftTo } : {}),
      });
    } else {
      // `loop.to: "fail"` (or an unknown target) can't be a rework edge — keep it
      // on the node so a round-trip preserves it instead of dropping it.
      nodes[i]!.looseLoop = ph.loop;
    }
  });
  return { nodes, flow, rework };
}

// ---- ordering -------------------------------------------------------------
/**
 * Linearize the flow graph: start from each chain head (a node with no incoming
 * flow edge, in array order), walk its single outgoing edge, then append any
 * still-unseen nodes (orphans / defensive cycle break) in array order.
 */
export function orderNodes(graph: WorkflowGraph): GraphNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map(graph.flow.map((e) => [e.from, e.to]));
  const hasIncoming = new Set(graph.flow.map((e) => e.to));

  const order: GraphNode[] = [];
  const seen = new Set<string>();
  const walk = (start: GraphNode) => {
    let cur: GraphNode | undefined = start;
    while (cur && !seen.has(cur.id)) {
      order.push(cur);
      seen.add(cur.id);
      const nextId = outgoing.get(cur.id);
      cur = nextId ? byId.get(nextId) : undefined;
    }
  };
  for (const n of graph.nodes) if (!hasIncoming.has(n.id)) walk(n);
  for (const n of graph.nodes) if (!seen.has(n.id)) walk(n);
  return order;
}

// ---- graph → phases (submit) ----------------------------------------------
/**
 * Project the graph to the contract phase array, threading `consumes` from each
 * node's incoming flow source (or the assignment file for a chain head). Mirrors
 * the proven id-based projection the linear dialog used.
 */
const splitCommands = (raw: string): string[] =>
  raw
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);

const cleanInclude = (n: GraphNode): string[] =>
  (n.include ?? []).map((p) => p.trim()).filter(Boolean);

export function graphToPhases(graph: WorkflowGraph, assignment: string): ContractPhase[] {
  const order = orderNodes(graph);
  const hasIncoming = new Set(graph.flow.map((e) => e.to));
  const reworkFrom = new Map(graph.rework.map((r) => [r.from, r]));
  const assign = assignment.trim() || INITIAL_ASSIGNMENT;

  const loopOf = (node: GraphNode): PhaseLoop | undefined => {
    const r = reworkFrom.get(node.id);
    if (r) {
      return {
        to: r.to,
        maxRetries: r.maxRetries,
        escalate: r.escalate,
        then: r.then,
        ...(r.escalation.length > 0 ? { escalation: r.escalation } : {}),
        ...(r.driftTo ? { driftTo: r.driftTo } : {}),
      };
    }
    return node.looseLoop;
  };

  // Thread the hand-off file along the chain.
  let handoff = assign;
  return order.map((node) => {
    // A chain head (no incoming flow) restarts from the assignment file.
    if (!hasIncoming.has(node.id)) handoff = assign;
    const loop = loopOf(node);

    const approval = node.approval ? { approval: node.approval } : {};
    const extra = node.extra ?? {};
    const consumes = handoff;
    const produces = node.produces.trim();
    handoff = produces || handoff;
    if (node.type === "workflow") {
      return {
        ...extra,
        id: node.id,
        type: "workflow" as const,
        workflow: node.workflow ?? "",
        consumes,
        produces,
        ...(loop ? { loop } : {}),
        ...approval,
      };
    }
    if (node.type === "parallel") {
      return {
        ...extra,
        id: node.id,
        type: "parallel" as const,
        branches: node.branches ?? [],
        consumes,
        produces,
        ...approval,
      };
    }
    if (node.type === "system") {
      return {
        ...extra,
        id: node.id,
        type: "system" as const,
        action: node.action ?? "",
        consumes,
        ...(produces ? { produces } : {}),
        ...(loop ? { loop } : {}),
        ...approval,
      };
    }
    if (node.type === "tool") {
      return {
        ...extra,
        id: node.id,
        type: "tool" as const,
        consumes,
        produces,
        commands: splitCommands(node.commands),
        ...(loop ? { loop } : {}),
        ...approval,
      };
    }
    return {
      ...extra,
      id: node.id,
      type: "agent" as const,
      agent: node.agent,
      consumes,
      produces,
      model: node.model,
      thinking: node.thinking,
      ...(node.qualify ? { qualify: true } : {}),
      ...(node.prompt?.trim() ? { prompt: node.prompt } : {}),
      ...(node.skill ? { skill: node.skill } : {}),
      ...(node.openaiModel ? { openaiModel: node.openaiModel } : {}),
      ...(node.engine && !node.openaiModel ? { engine: node.engine } : {}),
      ...(node.engine === "opencode" && node.engineModel && !node.openaiModel
        ? { engineModel: node.engineModel }
        : {}),
      ...(node.openaiModel && cleanInclude(node).length ? { include: cleanInclude(node) } : {}),
      ...(loop ? { loop } : {}),
      ...approval,
    };
  });
}

// ---- validation (mirrors the contract superRefine) ------------------------
export type GraphProblemKind =
  | "name"
  | "empty"
  | "agent"
  | "produces"
  | "rework"
  | "commands"
  | "workflow"
  | "then"
  | "when"
  | "outputs";

/** One validation problem; `nodeId` points at the offending phase (absent = workflow-level). */
export interface GraphProblem {
  kind: GraphProblemKind;
  nodeId?: string;
}

export interface GraphValidity {
  ok: boolean;
  /** i18n key under `forms.workflow.invalid.*` describing the first problem. */
  reason?: "name" | "empty" | "agent" | "produces" | "rework" | "commands" | "workflow";
}

/**
 * Every reason the graph + name can't be submitted, in a stable order (name, empty, then
 * per node in array order, then loops). Mirrors the contract's `refineWorkflow`: a name, ≥1
 * node, agent nodes need agent + produces, every rework edge must point **upstream** in the
 * flow chain to an existing node, a loop's `then` must resolve, a `when` must name an
 * earlier phase.
 */
export function collectProblems(graph: WorkflowGraph, name: string): GraphProblem[] {
  const out: GraphProblem[] = [];
  if (name.trim().length === 0) out.push({ kind: "name" });
  if (graph.nodes.length === 0) {
    out.push({ kind: "empty" });
    return out;
  }

  for (const n of graph.nodes) {
    if (n.type === "agent") {
      if (!n.agent) out.push({ kind: "agent", nodeId: n.id });
      if (n.produces.trim().length === 0) out.push({ kind: "produces", nodeId: n.id });
    }
    if (n.type === "workflow") {
      if (!n.workflow) out.push({ kind: "workflow", nodeId: n.id });
      if (n.produces.trim().length === 0) out.push({ kind: "produces", nodeId: n.id });
    }
    if (n.type === "parallel" && n.produces.trim().length === 0)
      out.push({ kind: "produces", nodeId: n.id });
    if (n.type === "system" && !n.action) out.push({ kind: "agent", nodeId: n.id });
    if (n.type === "tool") {
      if (splitCommands(n.commands).length === 0) out.push({ kind: "commands", nodeId: n.id });
      if (n.produces.trim().length === 0) out.push({ kind: "produces", nodeId: n.id });
    }
  }

  const order = orderNodes(graph);
  const indexOf = new Map(order.map((n, i) => [n.id, i]));
  const ids = new Set(graph.nodes.map((n) => n.id));
  const thenOk = (v: string) => v === "park" || v === "fail" || ids.has(v);
  for (const r of graph.rework) {
    const fromIdx = indexOf.get(r.from);
    const toIdx = indexOf.get(r.to);
    // The target must exist and sit strictly earlier in the flow order — a
    // forward/self loop is nonsensical (the prototype let it through).
    if (fromIdx === undefined || toIdx === undefined || toIdx >= fromIdx) {
      out.push({ kind: "rework", nodeId: r.from });
    } else if (!thenOk(r.then)) out.push({ kind: "then", nodeId: r.from });
  }
  for (const n of graph.nodes) {
    if (n.looseLoop && !thenOk(n.looseLoop.then)) out.push({ kind: "then", nodeId: n.id });
    const when = n.extra?.when;
    if (when) {
      const ref = indexOf.get(when.phase);
      const me = indexOf.get(n.id);
      if (ref === undefined || me === undefined || ref >= me)
        out.push({ kind: "when", nodeId: n.id });
    }
  }
  return out;
}

/**
 * Whether the graph + name can be submitted — the first of {@link collectProblems}
 * (kinds the legacy dialog has no copy for read as a rework problem).
 */
export function validateGraph(graph: WorkflowGraph, name: string): GraphValidity {
  const first = collectProblems(graph, name)[0];
  if (!first) return { ok: true };
  const reason =
    first.kind === "then" || first.kind === "when" || first.kind === "outputs"
      ? "rework"
      : first.kind;
  return { ok: false, reason };
}

// ---- live-run attempt tally ----------------------------------------------
/**
 * Stage-run tally per phase id (escalation markers excluded) for the "attempt
 * n/m" overlay the detail canvas shows on a loop node during a live run.
 */
export function attemptsFromStageRuns(
  stageRuns: ReadonlyArray<{ phaseId: string; runId: string }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of stageRuns) {
    if (s.runId.endsWith(".escalated")) continue;
    out[s.phaseId] = (out[s.phaseId] ?? 0) + 1;
  }
  return out;
}

/** True when wiring a rework edge `from → to` would point upstream (legal). */
export function isUpstreamRework(graph: WorkflowGraph, from: string, to: string): boolean {
  if (from === to) return false;
  const order = orderNodes(graph);
  const indexOf = new Map(order.map((n, i) => [n.id, i]));
  const f = indexOf.get(from);
  const t = indexOf.get(to);
  return f !== undefined && t !== undefined && t < f;
}

// ---- editor helpers (the page editor keeps the graph a single auto-laid-out chain) -------
/** Chain-ordered copy of the graph: flow edges regenerated between consecutive nodes. */
export function relinkChain(graph: WorkflowGraph): WorkflowGraph {
  const nodes = orderNodes(graph);
  const flow: FlowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]!;
    const b = nodes[i + 1]!;
    flow.push(
      graph.flow.find((e) => e.from === a.id && e.to === b.id) ?? {
        id: guid("e"),
        from: a.id,
        to: b.id,
      },
    );
  }
  return { ...graph, nodes, flow };
}

/** Insert `node` at chain index `at` (clamped), relinking the chain. */
export function insertNodeAt(graph: WorkflowGraph, node: GraphNode, at: number): WorkflowGraph {
  const nodes = orderNodes(graph);
  nodes.splice(clamp(at, 0, nodes.length), 0, node);
  return relinkChain({ ...graph, nodes, flow: [] });
}

/**
 * Remove a node and close the gap (predecessor → successor). Loops touching the node go with
 * it; a loop's `then` / `driftTo` / a `when` pointing at it are reset so nothing dangles.
 */
export function removeNode(graph: WorkflowGraph, id: string): WorkflowGraph {
  const fix = (n: GraphNode): GraphNode => {
    let next = n;
    if (n.looseLoop?.then === id) next = { ...next, looseLoop: { ...n.looseLoop, then: "park" } };
    if (n.extra?.when?.phase === id) {
      const rest = Object.entries(n.extra).filter(([k]) => k !== "when");
      next = { ...next, extra: rest.length ? (Object.fromEntries(rest) as PhaseExtra) : undefined };
    }
    return next;
  };
  return relinkChain({
    nodes: orderNodes(graph)
      .filter((n) => n.id !== id)
      .map(fix),
    flow: [],
    rework: graph.rework
      .filter((r) => r.from !== id && r.to !== id)
      .map((r) => {
        const { driftTo, ...rest } = r;
        return {
          ...rest,
          then: r.then === id ? "park" : r.then,
          ...(driftTo && driftTo !== id ? { driftTo } : {}),
        };
      }),
  });
}

/** Swap a node with its chain neighbour (`-1` earlier, `+1` later). */
export function moveNode(graph: WorkflowGraph, id: string, dir: -1 | 1): WorkflowGraph {
  const nodes = orderNodes(graph);
  const i = nodes.findIndex((n) => n.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= nodes.length) return graph;
  [nodes[i], nodes[j]] = [nodes[j]!, nodes[i]!];
  return relinkChain({ ...graph, nodes, flow: [] });
}

/** The node's loop in contract shape, whether it is a drawn rework edge or a loose (`to: "fail"`) one. */
export function loopOf(graph: WorkflowGraph, nodeId: string): PhaseLoop | undefined {
  const r = graph.rework.find((x) => x.from === nodeId);
  if (r) {
    return {
      to: r.to,
      maxRetries: r.maxRetries,
      escalate: r.escalate,
      then: r.then,
      ...(r.escalation.length ? { escalation: r.escalation } : {}),
      ...(r.driftTo ? { driftTo: r.driftTo } : {}),
    };
  }
  return graph.nodes.find((n) => n.id === nodeId)?.looseLoop;
}

/**
 * Set (or clear, with `null`) the node's loop. A target that is an earlier node becomes a
 * rework edge; anything else (`"fail"`) is kept as the node's loose loop.
 */
export function setLoop(
  graph: WorkflowGraph,
  nodeId: string,
  loop: PhaseLoop | null,
): WorkflowGraph {
  const rework = graph.rework.filter((r) => r.from !== nodeId);
  const strip = (n: GraphNode): GraphNode => {
    if (n.id !== nodeId) return n;
    return { ...n, looseLoop: undefined };
  };
  const nodes = graph.nodes.map(strip);
  if (!loop) return { ...graph, nodes, rework };
  if (graph.nodes.some((n) => n.id === loop.to)) {
    return {
      ...graph,
      nodes,
      rework: [
        ...rework,
        {
          id: guid("w"),
          from: nodeId,
          to: loop.to,
          maxRetries: loop.maxRetries,
          escalate: loop.escalate,
          then: loop.then,
          escalation: loop.escalation ?? [],
          ...(loop.driftTo ? { driftTo: loop.driftTo } : {}),
        },
      ],
    };
  }
  return {
    ...graph,
    nodes: nodes.map((n) => (n.id === nodeId ? { ...n, looseLoop: loop } : n)),
    rework,
  };
}
