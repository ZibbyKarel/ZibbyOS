import type { Agent } from "@zibby/contracts";
import type { IconName } from "@zibby/design-system";
import type { RunView } from "../runs/run";
import { isRunOfAgent } from "./agentRunStats";

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

export type AgentPresence = "working" | "error" | "idle";

export interface AgentWeekStats {
  runs: number;
  /** 0-100, `null` while no run in the window has finished. */
  successRate: number | null;
  cost: number;
}

/**
 * Live status of an agent from the runs feed: `working` while one of its own runs is
 * running (`task` = that run's title), `error` when its latest run failed, else `idle`.
 * ponytail: workflow stages an agent executes are not attributed, only its own runs.
 */
export function agentPresence(
  runs: readonly RunView[],
  agentId: string,
): { presence: AgentPresence; task?: string } {
  const mine = runs
    .filter((r) => isRunOfAgent(r, agentId))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const live = mine.find((r) => r.status === "running");
  if (live) {
    const task = live.title || live.taskTitle || live.prompt.slice(0, 60);
    return task ? { presence: "working", task } : { presence: "working" };
  }
  const latest = mine[0];
  if (latest && (latest.status === "error" || latest.taskOutcome === "error")) {
    return { presence: "error" };
  }
  return { presence: "idle" };
}

/** Runs / success rate / spend over the last 7 days, aggregated client-side from the feed. */
export function agentWeekStats(
  runs: readonly RunView[],
  agentId: string,
  now: number = Date.now(),
): AgentWeekStats {
  const from = now - WEEK_DAYS * DAY_MS;
  const mine = runs.filter((r) => isRunOfAgent(r, agentId) && Date.parse(r.startedAt) >= from);
  const finished = mine.filter((r) => r.status === "done" || r.status === "error");
  const ok = finished.filter((r) => r.status === "done" && r.taskOutcome !== "error");
  return {
    runs: mine.length,
    successRate: finished.length ? Math.round((ok.length / finished.length) * 100) : null,
    cost: mine.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
  };
}

/** Glyph for a tool id; unknown tools (MCP, custom) read as a plug. */
export function toolGlyph(tool: string): IconName {
  if (tool.startsWith("Bash")) return "terminal";
  if (tool === "Read") return "file";
  if (tool === "Glob" || tool === "Grep") return "search";
  if (tool === "Write" || tool === "Edit") return "edit";
  if (tool === "WebSearch") return "globe";
  if (tool === "WebFetch") return "link";
  return "plug";
}

/** Distinct tool glyphs in first-seen order — the card shows one tile per glyph, not per tool. */
export function toolGlyphs(tools: readonly string[] | undefined, max = 4): IconName[] {
  return [...new Set((tools ?? []).map(toolGlyph))].slice(0, max);
}

/** Case-insensitive match on an agent's name, id or any tool. */
export function agentMatches(agent: Agent, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [agent.displayName, agent.name, agent.id, ...(agent.tools ?? [])];
  return hay.some((h) => h?.toLowerCase().includes(q));
}

export const EFFORT_LEVEL = { low: 1, medium: 2, high: 3 } as const;
