import { z } from "zod";
import { AgentIdSchema } from "../agents/agent.schema";
import { IsoDateTimeSchema, WorkspaceSchema } from "../common.schema";

/**
 * Lifecycle of a whole loop run — a deliberate clone of {@link WorkflowStateSchema}
 * semantics so the web `FeedStatus` mapping and `paused-limit`/`parked` handling
 * are reused, not reinvented: `running` while iterating, `done`/`failed` at the
 * end, `parked` when bounded effort is exhausted (iterations/budget/limit) and the
 * operator must decide, `paused-limit` when an iteration's maker died on a usage
 * limit (a pause, not a failure — and it does NOT burn an iteration).
 */
export const LoopStateSchema = z.enum([
  "running",
  "done",
  "parked",
  "failed",
  "paused-limit",
  // Phase 43: the operator stopped a running loop — its live maker run was killed
  // deliberately, before the verifier ran. Distinct from `failed`: no retry/park
  // logic runs on a stop.
  "interrupted",
]);
export type LoopState = z.infer<typeof LoopStateSchema>;

/**
 * Why a loop is `parked` — its own enum so it never pollutes the workflow's
 * {@link ParkedReasonSchema}:
 * - `iterations`: the maxIterations fuse blew (the loop ran out of attempts).
 * - `budget`: a per-iteration budget check went over-cap mid-loop.
 * - `limit` (Phase 9.2): the usage-limit auto-resume flapped past the cap.
 * - `awaiting-resume` (Phase 12.4): on API restart a `running`/`paused-limit` loop is
 *   rehydrated but NOT auto-re-dispatched (Law 3 / Tier 3 — a respawn must not spawn
 *   a maker without approval). It is surfaced here as a pending operator resume
 *   decision; `resumeParked` continues it. The `GOAL_AUTO_RESUME=1` daemon flag
 *   restores the old auto-reconcile.
 * All are durable, no-live-child parks, resumable with an operator note.
 */
export const LoopParkedReasonSchema = z.enum(["iterations", "budget", "limit", "awaiting-resume"]);
export type LoopParkedReason = z.infer<typeof LoopParkedReasonSchema>;

/** Status of one iteration's maker+verifier cycle. */
export const LoopIterationStatusSchema = z.enum(["running", "done", "failed", "paused-limit"]);
export type LoopIterationStatus = z.infer<typeof LoopIterationStatusSchema>;

/**
 * One iteration's record: which maker ran (its run ref so its log is pollable), the
 * verifier verdict, and the iteration status. A `paused-limit` iteration is NOT a
 * completed iteration — it re-dispatches the SAME index on resume (decision 9), so
 * the maxIterations fuse only counts `done` attempts.
 */
export const LoopIterationSchema = z.object({
  index: z.number().int().nonnegative(),
  makerKind: z.enum(["agent", "workflow"]),
  /** The underlying agent-run / workflow-run id the maker dispatched as. */
  makerRunRef: z.string().optional(),
  verifier: z.object({
    kind: z.enum(["claude"]),
    /** The verifier's own run ref, when it spawned a claude run. */
    runRef: z.string().optional(),
    satisfied: z.boolean(),
    /** The claude verdict text (feeds the next iteration). */
    output: z.string(),
  }),
  startedAt: IsoDateTimeSchema,
  endedAt: IsoDateTimeSchema.optional(),
  status: LoopIterationStatusSchema,
});
export type LoopIteration = z.infer<typeof LoopIterationSchema>;

/** Detail of a parked loop — the surface the operator resumes from (mirror of ParkedDetail). */
export const LoopParkedDetailSchema = z.object({
  /** The iteration index the loop parked at. */
  iteration: z.number().int().nonnegative(),
  /** How many maker attempts had been made (index + 1). */
  attempts: z.number().int().min(1),
  /** Absolute path of the iteration verdict file (the failure context + note target). */
  verdictFile: z.string(),
  note: z.string().optional(),
});
export type LoopParkedDetail = z.infer<typeof LoopParkedDetailSchema>;

/**
 * A run of a loop: the outer-loop aggregate, modeled on {@link WorkflowRunSchema}
 * with `iterations[]` replacing `stageRuns[]`. Written to `<runRoot>/run.json` on
 * every transition and rebuilt by `reconstruct()` on init, so the loop survives a
 * restart and continues at `currentIteration` (continuation, not restart).
 */
export const LoopRunSchema = z.object({
  loopRunId: z.string().min(1),
  loopId: AgentIdSchema,
  status: LoopStateSchema,
  /** The task record this run was dispatched from, when it was born from one. */
  taskId: z.string().optional(),
  /** Iteration currently executing, or null once the run has finished/parked. */
  currentIteration: z.number().int().nonnegative().nullable(),
  iterations: z.array(LoopIterationSchema),
  startedAt: IsoDateTimeSchema,
  /** Absolute shared root dir holding this run's per-iteration artifacts. */
  cwd: z.string(),
  /** Absolute path of the resolved target project, when started with one. */
  projectPath: z.string().optional(),
  /** The dedicated git worktree this run owns (Phase 3.1); iterations accrue commits on its branch. */
  workspace: WorkspaceSchema.optional(),
  /** Phase 9: when `paused-limit`, the epoch ms the usage window is expected to reset. */
  resumeAt: z.number().int().nullable().optional(),
  /** Phase 9: how many times this run has been auto-resumed off a usage-limit pause. */
  limitResumeCycles: z.number().int().nonnegative().optional(),
  /** Present while `parked` — which parking machine holds the run. */
  parkedReason: LoopParkedReasonSchema.optional(),
  /** Present while parked: the surface the operator resumes from. */
  parked: LoopParkedDetailSchema.optional(),
  /**
   * Decision 8: captured-if-available forensic field only. No native claude session
   * resume exists; cross-iteration / cross-restart continuation rides resume-context.
   */
  sessionId: z.string().optional(),
  /** Classifier terms (Phase 4) that routed the originating task here. */
  matchedTerms: z.array(z.string()).optional(),
});
export type LoopRun = z.infer<typeof LoopRunSchema>;

/** Body accepted by `startLoopRun` (mirror of StartWorkflowRunSchema + agent run fields). */
export const StartLoopRunSchema = z.object({
  project: z.string().optional(),
  files: z.array(z.string()).optional(),
  title: z.string().max(200).optional(),
});
export type StartLoopRunInput = z.infer<typeof StartLoopRunSchema>;

/** Body accepted by `resumeLoopRun` — the operator's note for the resumed iteration. */
export const ResumeLoopRunSchema = z.object({
  note: z.string().optional(),
});
export type ResumeLoopRunInput = z.infer<typeof ResumeLoopRunSchema>;
