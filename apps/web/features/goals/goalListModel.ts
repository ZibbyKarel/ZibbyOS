import type { TaskRun } from "@zibby/contracts";
import type { StateTone } from "@zibby/design-system";

export type GoalFilter = "all" | "active" | "parked" | "done" | "error";

/** Which status chip a goal (by its state tone) is counted under; `idle` only shows under "all". */
export function goalFilterOf(tone: StateTone): Exclude<GoalFilter, "all"> | "idle" {
  switch (tone) {
    case "working":
    case "thinking":
      return "active";
    case "blocked":
      return "parked";
    case "done":
      return "done";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

export type GoalVerdictOutcome = "none" | "running" | "passed" | "failed" | "parked" | "error";

export interface GoalVerdict {
  outcome: GoalVerdictOutcome;
  /** 1-based number of the iteration the verdict belongs to. */
  iteration?: number;
  /** First ~160 chars of the verifier's verdict text, whitespace collapsed. */
  text?: string;
}

const MAX_TEXT = 160;

/**
 * The verdict box of a goal card: the latest iteration's verifier output, with the run's
 * own state (parked / error / done) overriding the per-iteration pass-fail word.
 */
export function goalVerdict(run: TaskRun | undefined): GoalVerdict {
  const last = run?.iterations?.[run.iterations.length - 1];
  if (!run || !last) return { outcome: "none" };
  const flat = last.verifier.output.replace(/\s+/g, " ").trim();
  const text = flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT - 1)}…` : flat;
  const outcome: GoalVerdictOutcome =
    run.status === "parked"
      ? "parked"
      : run.status === "error"
        ? "error"
        : last.status === "running"
          ? "running"
          : last.verifier.satisfied
            ? "passed"
            : "failed";
  return { outcome, iteration: last.index + 1, text: text || undefined };
}
