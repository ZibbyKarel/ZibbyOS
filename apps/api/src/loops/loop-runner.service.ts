import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  LOOP_RUN_ARTIFACTS,
  type Loop,
  type LoopIteration,
  type LoopIterationStatus,
  type LoopParkedReason,
  type LoopRun,
  type LoopRunArtifact,
  LoopRunSchema,
  type Project,
  type ProjectBudget,
  type VerifierSpec,
} from "@zibby/contracts";
import { ActivityLogService } from "../activity/activity-log.service";
import { AgentRunnerService, type RunAttachments } from "../agents/agent-runner.service";
import { BudgetService } from "../budget/budget.service";
import {
  WorkflowRunNotStoppableError,
  WorkflowRunnerService,
} from "../workflows/workflow-runner.service";
import { ProjectLocalService } from "../projects/project-local.service";
import { ProjectLocalUnresolvedError } from "../projects/projects.errors";
import { ProjectsStorageService } from "../projects/projects.storage.service";
import { buildResumeContext } from "../workflows/resume-context";
import { RunNotFoundError } from "../runner/runner-core";
import { prepareWorktreeDir } from "../shared/worktree-root";
import { LoggerService, type ScopedLogger } from "../shared/logging/logger.service";
import { TraceContextService } from "../shared/logging/trace-context.service";
import { SystemConfigStore } from "../system/system-config.store";
import { WorkspaceService, WorkspaceSetupError } from "../workspace/workspace.service";
import { LoopsStorageService } from "./loops.storage.service";
import { decideStop, renderLoopProgress } from "./loop-stop";
import { parseLoopVerdict } from "./loop-verdict";
import {
  LoopRunNotFoundError,
  LoopRunNotParkedError,
  LoopRunNotStoppableError,
} from "./loops.errors";
import { isPrimaryInstance } from "../shared/instance-role";

/** Max chars of a verifier's output captured into the verdict file / resume-context. */
const VERDICT_MAX_CHARS = 4000;

/** One verifier run's verdict — its satisfied flag and the output that feeds the next iteration. */
interface VerifierVerdict {
  kind: VerifierSpec["kind"];
  runRef?: string;
  satisfied: boolean;
  output: string;
}

/** Keep the last {@link VERDICT_MAX_CHARS} of verifier output (the failing tail). */
function tailOf(text: string): string {
  const trimmed = text.trimEnd();
  return trimmed.length > VERDICT_MAX_CHARS
    ? trimmed.slice(trimmed.length - VERDICT_MAX_CHARS)
    : trimmed;
}

/**
 * Strip any literal `<verdict>` / `</verdict>` tag out of operator-authored text before it
 * reaches a `claude` verifier's prompt. `readLog()` returns the whole log, prompt echo included,
 * and {@link parseLoopVerdict} is literal last-tag-wins — so a tag smuggled in through the loop's
 * objective would become the deciding verdict whenever the judge omits its own, turning
 * fail-closed into fail-open.
 */
function stripVerdictTags(text: string): string {
  return text.replace(/<\/?verdict>/gi, "");
}

/**
 * Phase 13.1 — has the loop's OWN budget (a windowed run-count) been reached? A loop
 * iteration IS one maker run, so the iteration records are the run ledger — count those
 * whose `startedAt` falls in the rolling daily / weekly window. No budget or no caps →
 * never exceeded. This is distinct from `maxIterations` (the total fuse): a per-window
 * ceiling that composes with the Phase 8.1 project cap (both checked; either parks).
 */
export function loopBudgetExceeded(
  budget: ProjectBudget | undefined,
  iterations: ReadonlyArray<{ startedAt: string }>,
  now: Date,
): boolean {
  if (!budget) return false;
  const DAY = 24 * 60 * 60 * 1000;
  const countWithin = (ms: number): number =>
    iterations.filter((i) => now.getTime() - new Date(i.startedAt).getTime() < ms).length;
  if (budget.dailyRuns !== undefined && countWithin(DAY) >= budget.dailyRuns) return true;
  if (budget.weeklyRuns !== undefined && countWithin(7 * DAY) >= budget.weeklyRuns) return true;
  return false;
}

/** DI token carrying the absolute path of the directory that holds loop run artifacts. */
export const LOOP_RUNS_DIR = "LOOP_RUNS_DIR";

const RETENTION_MS = 30 * 60 * 1000;
const MAX_LISTED = 50;
const AGGREGATE_FILE = "run.json";

/**
 * The outer loop engine. A loop run iterates a *maker* (an existing agent or
 * workflow, dispatched through its own runner untouched) against a *verifier*
 * (Phase 10.2), persisting every iteration to disk and parking when bounded
 * effort is exhausted. The loop owns ONE worktree per run; iterations accumulate
 * commits on its branch.
 *
 * This is deliberately thin glue over delivered machinery: the maker dispatch
 * reuses {@link AgentRunnerService.start} / {@link WorkflowRunnerService.start}
 * verbatim (so demo mode stays the e2e seam and the mid-run approval gate applies
 * unchanged inside every iteration), and the aggregate is the
 * {@link WorkflowRunnerService} pattern with `iterations[]` replacing `stageRuns[]`.
 */
@Injectable()
export class LoopRunnerService implements OnModuleInit {
  private readonly dir: string;
  private readonly runs = new Map<string, LoopRun>();
  /** The base prompt for each live run's maker (not persisted — recomputed from objective on restart). */
  private readonly prompts = new Map<string, string>();
  private readonly events = new EventEmitter();
  /**
   * Phase 43 — loop run ids with an operator-requested stop in flight. Set by
   * {@link stop} right before killing the current iteration's live maker; consumed
   * (and cleared) by {@link drive} the moment `waitForMaker` returns, so the loop
   * lands the aggregate `interrupted` instead of running the verifier / deciding
   * whether to continue.
   */
  private readonly stopRequested = new Set<string>();
  private readonly log: ScopedLogger;

  constructor(
    @Inject(LOOP_RUNS_DIR) dir: string,
    private readonly loops: LoopsStorageService,
    private readonly agentRunner: AgentRunnerService,
    private readonly workflowRunner: WorkflowRunnerService,
    private readonly projects: ProjectsStorageService,
    private readonly workspace: WorkspaceService,
    private readonly budget: BudgetService,
    private readonly activity: ActivityLogService,
    private readonly logger: LoggerService,
    private readonly trace: TraceContextService,
    private readonly systemConfig: SystemConfigStore,
    private readonly projectLocal: ProjectLocalService,
  ) {
    this.dir = path.resolve(dir);
    this.log = logger.child(LoopRunnerService.name);
    this.events.setMaxListeners(0);
  }

  async onModuleInit(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true }).catch(() => {});
    await this.reconstruct();
  }

  /**
   * Start a run of `loopId`. Returns immediately; iterations run in the background.
   * Creates one worktree per run (Phase 3.1) when the project is a git repo, seeds
   * the aggregate, persists it, and kicks the driver.
   */
  async start(
    loopId: string,
    prompt = "",
    project = "",
    files: string[] = [],
    title = "",
    taskId?: string,
    matchedTerms?: string[],
    /**
     * Task 8: the dispatching task's attachments (Task 6/7). Threaded into each
     * agent-maker iteration so a loop maker sees the operator's reference files.
     * Absent on resume/reconstruct paths (not persisted across restart — v1 scope).
     */
    attachments?: RunAttachments,
  ): Promise<LoopRun> {
    // Throws LoopNotFoundError / InvalidLoopIdError when unknown → 404.
    const loop = await this.loops.get(loopId);
    const resolved = await this.resolveProject(project);

    const startedMs = Date.now();
    const loopRunId = `${loopId}_${startedMs}`;
    const root = path.join(this.dir, loopRunId);
    await fs.mkdir(root, { recursive: true });
    // The objective is the human-readable anchor for the whole run (a forensic artifact).
    await fs
      .writeFile(path.join(root, "objective.md"), `${loop.objective}\n`, "utf8")
      .catch(() => {});

    const run: LoopRun = {
      loopRunId,
      loopId,
      status: "running",
      currentIteration: 0,
      iterations: [],
      startedAt: new Date(startedMs).toISOString(),
      cwd: root,
      ...(taskId ? { taskId } : {}),
      ...(resolved ? { projectPath: resolved.path } : {}),
      ...(matchedTerms?.length ? { matchedTerms } : {}),
    };
    this.runs.set(loopRunId, run);
    this.prompts.set(loopRunId, prompt || loop.objective);
    await this.writeAggregate(run);

    // Phase 3.1: a git project gets ONE worktree for the whole run; every maker
    // iteration spawns there so its commits land on the loop's own branch. A
    // worktree-setup failure on a git project is fatal (no silent main-checkout use).
    // Phase 77: resolve THIS machine's local clone first (clone into cloneRoot when
    // absent+gitRemote); a project that's absent with no remote fails the run just
    // as clearly as a worktree-setup failure — same catch, same failed-run path.
    if (resolved) {
      try {
        const local = await this.projectLocal.resolveForRun(resolved);
        if (local.isGitRepo && local.path) {
          run.workspace = await this.workspace.createWorktree({
            projectPath: local.path,
            runId: loopRunId,
            slug: title || loopId,
            // Phase 12.7: the worktree lives OUTSIDE the repo/data tree; only forensic
            // artifacts stay under `root` (= LOOP_RUNS_DIR/<id>).
            dir: await prepareWorktreeDir(loopRunId),
          });
          await this.writeAggregate(run);
        }
      } catch (error) {
        if (
          !(error instanceof WorkspaceSetupError) &&
          !(error instanceof ProjectLocalUnresolvedError)
        ) {
          throw error;
        }
        run.status = "failed";
        run.currentIteration = null;
        await this.writeAggregate(run);
        this.log.error("loop run failed: worktree setup", {
          loopRunId,
          projectPath: resolved.path,
          err: error.message,
        });
        return run;
      }
    }

    this.log.info("starting loop run", {
      loopId,
      loopRunId,
      maker: `${loop.maker.kind}:${loop.maker.id}`,
      maxIterations: loop.maxIterations,
      branch: run.workspace?.branch,
    });

    const traceId = this.trace.getTraceId() ?? randomUUID();
    void this.trace
      .run({ traceId, runId: loopRunId }, () =>
        this.drive(run, loop, resolved, files, undefined, attachments),
      )
      .catch((err) => this.onDriveError(run, err));
    return run;
  }

  /**
   * The outer loop (Phase 10.2). The cursor is an iteration index, not a phase id:
   *
   *   loop:
   *     budget.check → over-cap? park (budget)                       [8.1]
   *     dispatch maker (agent|workflow .start, cwd = worktree)       [inner loop]
   *     wait for maker terminal                                      [9.1 shape in 10.4]
   *     run verifier (claude pass)                                   [10.2]
   *     decideStop:
   *       satisfied → checkpoint commit, status done, return         [9.3]
   *       park-iterations → park, return                             [10.2]
   *       continue → compose resume-context from verdict, next       [9.3]
   *
   * `resume` re-enters at a given index with a resume-context prefix (resume-with-note
   * / 10.4 limit auto-resume). The maker dispatch reuses the inner runners verbatim.
   */
  private async drive(
    run: LoopRun,
    loop: Loop,
    project: Project | null,
    files: string[],
    resume?: { startIndex: number; resumeContext?: string; attachRunRef?: string },
    /**
     * Task 8: the dispatching task's attachments, forwarded to each agent-maker
     * dispatch. Undefined on resume/reconstruct re-entry (not persisted) — acceptable
     * v1 behaviour: a resumed loop iteration runs without the reference-file grant.
     */
    attachments?: RunAttachments,
  ): Promise<void> {
    let index = resume?.startIndex ?? run.currentIteration ?? 0;
    let resumeContext = resume?.resumeContext;
    // Restart re-attach: the FIRST turn waits on an existing in-flight maker run
    // instead of dispatching a fresh one (continuation, not restart).
    let attachRunRef = resume?.attachRunRef;

    for (;;) {
      // Per-iteration budget guard (decision 6): the maker counts as one run against
      // the project's daily/weekly cap. Over-cap → park (budget) before spending it.
      const budgetOk = await this.budgetOk(project);
      if (!budgetOk) {
        await this.parkLoop(run, "budget", index);
        return;
      }
      // Phase 13.1: the loop's OWN windowed budget, independent of the project cap above.
      if (loopBudgetExceeded(loop.budget, run.iterations, new Date())) {
        this.log.info("loop parked: own budget reached", { loopRunId: run.loopRunId, index });
        await this.parkLoop(run, "budget", index);
        return;
      }

      // Reuse the record at this index when re-driving (resume / limit re-dispatch),
      // so a re-run iteration never duplicates a record — else create a new one.
      const iteration = this.iterationAt(run, loop, index);
      run.currentIteration = index;
      await this.writeAggregate(run);

      let makerRunRef: string;
      if (attachRunRef) {
        makerRunRef = attachRunRef;
        attachRunRef = undefined;
        iteration.makerRunRef = makerRunRef;
        await this.writeAggregate(run);
      } else {
        makerRunRef = await this.dispatchMaker(
          run,
          loop,
          project,
          files,
          resumeContext,
          attachments,
        );
        iteration.makerRunRef = makerRunRef;
        await this.writeAggregate(run);
        await this.recordDispatch(run, project, makerRunRef);
        this.recordActivity(
          run,
          "loop-dispatched",
          `dispatched ${loop.maker.kind} maker for iteration ${index + 1}/${loop.maxIterations}`,
          makerRunRef,
        );
      }

      const makerStatus = await this.waitForMaker(run, loop.maker.kind, makerRunRef);
      iteration.status = makerStatus;

      // Phase 43: an operator-requested stop killed this iteration's maker — land
      // the aggregate `interrupted` right here, before the verifier runs or
      // `decideStop` picks a continuation, so a stopped loop never re-dispatches.
      if (this.stopRequested.delete(run.loopRunId)) {
        iteration.endedAt = new Date().toISOString();
        run.status = "interrupted";
        run.currentIteration = null;
        await this.writeAggregate(run);
        this.log.info("loop run stopped (operator)", { loopRunId: run.loopRunId, index });
        return;
      }

      const verdict = await this.runVerifier(run, loop, project, index);
      iteration.verifier = {
        kind: verdict.kind,
        ...(verdict.runRef ? { runRef: verdict.runRef } : {}),
        satisfied: verdict.satisfied,
        output: verdict.output,
      };
      iteration.endedAt = new Date().toISOString();
      const verdictFile = path.join(run.cwd, `iteration-${index}.verdict.txt`);
      await fs
        .writeFile(verdictFile, verdict.output || "(no verifier output)\n", "utf8")
        .catch(() => {});
      await this.writeAggregate(run);
      this.recordActivity(
        run,
        "loop-verdict",
        `iteration ${index + 1} verifier ${verdict.satisfied ? "satisfied" : "not satisfied"}`,
        verdict.runRef,
      );
      this.log.info("loop iteration verified", {
        loopRunId: run.loopRunId,
        index,
        makerStatus,
        satisfied: verdict.satisfied,
      });

      const stop = decideStop({
        satisfied: verdict.satisfied,
        index,
        maxIterations: loop.maxIterations,
        budgetOk: true,
      });
      if (stop === "satisfied") {
        await this.checkpoint(run, loop, index);
        run.status = "done";
        run.currentIteration = null;
        await this.writeAggregate(run);
        this.log.info("loop run done (verifier satisfied)", {
          loopRunId: run.loopRunId,
          iterations: index + 1,
        });
        return;
      }
      if (stop === "park-iterations") {
        await this.parkLoop(run, "iterations", index, verdictFile);
        return;
      }
      // Continue: the verifier output becomes the next iteration's resume-context.
      resumeContext = await this.composeResumeContext(run, loop, verdict.output);
      index += 1;
    }
  }

  /**
   * The iteration record for `index` — reused when re-driving (resume / restart /
   * limit re-dispatch) so a re-run never duplicates a record, reset to a fresh
   * `running` state; created + appended otherwise.
   */
  private iterationAt(run: LoopRun, loop: Loop, index: number): LoopIteration {
    const existing = run.iterations.find((i) => i.index === index);
    if (existing) {
      existing.status = "running";
      existing.verifier = { kind: loop.verifier.kind, satisfied: false, output: "" };
      existing.startedAt = new Date().toISOString();
      existing.endedAt = undefined;
      return existing;
    }
    const iteration: LoopIteration = {
      index,
      makerKind: loop.maker.kind,
      verifier: { kind: loop.verifier.kind, satisfied: false, output: "" },
      startedAt: new Date().toISOString(),
      status: "running",
    };
    run.iterations.push(iteration);
    return iteration;
  }

  /** True when the project (if any) is under its budget cap; fail-closed via BudgetService. */
  private async budgetOk(project: Project | null): Promise<boolean> {
    const check = await this.budget.check(project?.id, new Date()).catch(() => ({ ok: true }));
    return check.ok;
  }

  /**
   * Count this iteration's maker run against the project ledger (decision 6).
   * Phase 12: this writes a dispatch line only, never a cost line — a loop's own
   * completion isn't tracked here as a single terminal-state point the way
   * `task-scheduler.service.ts`'s `reconcileOutcome` observes agent/workflow runs, and
   * `LoopRunSchema` carries no aggregate `costUsd` to write anyway. Cost lines for a
   * loop dispatched through a `ScheduledTask` still flow from the scheduler's
   * `writeAgentOutcome`/`writeWorkflowOutcome` — each iteration's own maker run is
   * itself an agent or workflow run with its own outcome.
   */
  private async recordDispatch(
    run: LoopRun,
    project: Project | null,
    runRef: string,
  ): Promise<void> {
    await this.budget
      .recordDispatch(
        {
          at: new Date().toISOString(),
          ...(project ? { projectId: project.id } : {}),
          ...(run.taskId ? { taskId: run.taskId } : {}),
          runRef,
          kind: "loop",
        },
        new Date(),
      )
      .catch(() => {});
  }

  /** Park the loop for the operator — durable, resumable with a note (decision 4). */
  private async parkLoop(
    run: LoopRun,
    reason: LoopParkedReason,
    index: number,
    verdictFile?: string,
  ): Promise<void> {
    run.status = "parked";
    run.parkedReason = reason;
    run.parked = {
      iteration: index,
      attempts: index + 1,
      verdictFile: verdictFile ?? path.join(run.cwd, `iteration-${index}.verdict.txt`),
    };
    run.currentIteration = index;
    await this.writeAggregate(run);
    this.recordActivity(
      run,
      "loop-parked",
      `loop parked (${reason}) after ${index + 1} iteration(s)`,
    );
    this.log.warn("loop run parked", { loopRunId: run.loopRunId, reason, iteration: index });
  }

  /**
   * Phase 9b: checkpoint the satisfied iteration on the loop's branch (worktree only;
   * a clean tree / non-git run → no-op). Local, Tier-1, ungated — NEVER pushes.
   */
  private async checkpoint(run: LoopRun, loop: Loop, index: number): Promise<void> {
    if (!run.workspace) return;
    const summary = loop.objective.slice(0, 100);
    await this.workspace
      .checkpoint({ worktreePath: run.workspace.path, phaseId: `loop-iter-${index}`, summary })
      .catch(() => null);
  }

  /**
   * Run the loop's verifier for iteration `index`. The `claude` verifier is a FRESH agent run on its own
   * (cheaper) model — a separate spawn with no shared session (decision 3/8) —
   * graded on the `<verdict>pass|fail</verdict>` tag it writes into its own log
   * (`parseLoopVerdict`, literal last tag wins), not on its exit code, and is
   * fail-closed: no parseable verdict, or a judge that never finished, is not
   * satisfied. The captured verdict text feeds the next iteration's resume-context.
   */
  protected async runVerifier(
    run: LoopRun,
    loop: Loop,
    project: Project | null,
    index: number,
  ): Promise<VerifierVerdict> {
    const spec = loop.verifier;
    // claude verifier: a fresh agent run handed the loop + iteration context. It is
    // graded on the verdict it WRITES, not on its exit code — a judge that rules FAIL
    // and exits 0 has not satisfied anything. Fail-closed on a missing/unparseable
    // verdict and on a judge that never finished.
    //
    // The tag is described, never instanced: a literal `<verdict>pass</verdict>` in
    // the prompt would be echoed into the log and — under last-match-wins — become the
    // ruling whenever the judge forgot to write one, turning fail-closed into fail-open.
    // The objective is operator-authored (not under our control), so it is scrubbed
    // with `stripVerdictTags` before interpolation for the same reason.
    const prompt = [
      `Verify whether this loop is satisfied: ${stripVerdictTags(loop.objective)}`,
      `This is verification iteration ${index + 1}. Inspect the working tree and report PASS or FAIL with a short reason.`,
      `End your report with a machine-readable verdict on its own line: a "verdict" XML tag whose only content is the single word pass or fail. It is read by a parser, not a human, and the LAST such tag in your output wins. If you cannot reach a confident conclusion, rule fail — a missing or unreadable verdict is treated as a failure.`,
    ].join("\n\n");
    const r = await this.agentRunner.start(
      spec.agent,
      prompt,
      project?.id ?? "",
      [],
      `verify:${loop.id}`,
      undefined,
      run.matchedTerms,
      run.workspace,
    );
    const status = await this.waitForMaker(run, "agent", r.runId);
    const log = await this.agentRunner.readLog(r.runId, 0).catch(() => null);
    const output = tailOf(log?.content ?? "");
    const ruled = parseLoopVerdict(log?.content ?? "");
    const satisfied = status === "done" && ruled === "pass"; // fail-closed on null
    // status === "done" && ruled === null means the judge agent ran to completion but
    // never wrote a parseable verdict — the agent itself is likely misconfigured, not
    // an ordinary FAIL, so it is surfaced as a warning rather than routine info.
    const logFields = {
      loopRunId: run.loopRunId,
      runRef: r.runId,
      status,
      verdict: ruled ?? "absent",
      satisfied,
    };
    if (status === "done" && ruled === null) {
      this.log.warn("loop claude verifier produced no parseable verdict", logFields);
    } else {
      this.log.info("loop claude verifier graded", logFields);
    }
    return { kind: "claude", runRef: r.runId, satisfied, output };
  }

  /**
   * Assemble the resume-context for the next/resumed iteration: the loop progress,
   * the branch's checkpoint commits, the last verifier output (as `failureTail`),
   * and an optional operator note. Reuses the workflow's pure {@link buildResumeContext}.
   */
  private async composeResumeContext(
    run: LoopRun,
    loop: Loop,
    verdictOutput: string,
    note?: string,
  ): Promise<string> {
    const checkpointLog = run.workspace
      ? await this.workspace
          .commitLog({ worktreePath: run.workspace.path, baseRef: run.workspace.baseRef })
          .catch(() => "")
      : "";
    return buildResumeContext({
      progressMd: renderLoopProgress(run, loop.objective, loop.maxIterations),
      checkpointLog,
      note,
      failureTail: verdictOutput,
    });
  }

  /** Dispatch the maker through its own runner (with the loop's worktree); return its run ref. */
  protected async dispatchMaker(
    run: LoopRun,
    loop: Loop,
    project: Project | null,
    files: string[],
    resumeContext?: string,
    /** Task 8: forwarded to an agent maker's run (workflow maker has no seam — v1 gap). */
    attachments?: RunAttachments,
  ): Promise<string> {
    const prompt = this.makerPrompt(run, loop, resumeContext);
    const projectRef = project?.id ?? "";
    if (loop.maker.kind === "agent") {
      const r = await this.agentRunner.start(
        loop.maker.id,
        prompt,
        projectRef,
        files,
        loop.name ?? loop.id,
        run.taskId,
        run.matchedTerms,
        run.workspace,
        attachments,
      );
      return r.runId;
    }
    const r = await this.workflowRunner.start(
      loop.maker.id,
      run.taskId,
      projectRef,
      run.matchedTerms,
      run.workspace,
    );
    return r.workflowRunId;
  }

  /**
   * The prompt handed to an agent maker (workflow makers run their own phases). A
   * continuation iteration prepends the resume-context so the maker knows what the
   * verifier flagged last time — the Tester→Kodér feedback shape, generalized.
   */
  protected makerPrompt(run: LoopRun, loop: Loop, resumeContext?: string): string {
    const base = this.prompts.get(run.loopRunId) ?? loop.objective;
    return [
      resumeContext?.trim() ? resumeContext.trim() : "",
      `Loop: ${loop.objective}`,
      base === loop.objective ? "" : base,
      loop.instructions,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  /**
   * Poll the maker run until it reaches a TERMINAL state, mapping it to a
   * {@link LoopIterationStatus} (`done` → done; else → failed). Rides through
   * `running`/`awaiting-approval` (the inner mid-run gate is live).
   *
   * Decision 9: a maker that pauses on the usage limit does NOT burn the iteration.
   * The loop REFLECTS the pause — `run.status = "paused-limit"` with the maker's
   * `resumeAt` for visibility — and keeps polling. The maker's own Phase 9.2
   * auto-resume (its agent/workflow registry is already scanned) respawns it; when
   * it resumes the loop flips back to `running` and the SAME iteration completes.
   * No re-dispatch here, so there is no double-spawn with the maker's own resume.
   */
  protected async waitForMaker(
    run: LoopRun,
    kind: "agent" | "workflow",
    runRef: string,
  ): Promise<LoopIterationStatus> {
    let reflectingPause = false;
    for (;;) {
      const raw = this.makerStatus(kind, runRef);
      if (raw === null) return "failed";
      if (raw === "paused-limit") {
        if (!reflectingPause) {
          reflectingPause = true;
          run.status = "paused-limit";
          run.resumeAt = this.makerResumeAt(kind, runRef);
          run.limitResumeCycles = run.limitResumeCycles ?? 0;
          await this.writeAggregate(run);
          this.log.warn("loop reflecting maker paused-limit", { loopRunId: run.loopRunId, runRef });
        }
        await new Promise((r) => setTimeout(r, 40));
        continue;
      }
      if (raw === "running" || raw === "awaiting-approval") {
        if (reflectingPause) {
          reflectingPause = false;
          run.status = "running";
          run.resumeAt = null;
          await this.writeAggregate(run);
        }
        await new Promise((r) => setTimeout(r, 40));
        continue;
      }
      return raw === "done" ? "done" : "failed";
    }
  }

  /** The maker run's current status, or null if the run is unknown (swept/gone). */
  private makerStatus(kind: "agent" | "workflow", runRef: string): string | null {
    try {
      return kind === "agent"
        ? this.agentRunner.get(runRef).status
        : this.workflowRunner.get(runRef).status;
    } catch {
      return null;
    }
  }

  /** The maker run's `resumeAt` (the usage-window reset epoch), copied up for the loop. */
  private makerResumeAt(kind: "agent" | "workflow", runRef: string): number | null {
    try {
      const run = kind === "agent" ? this.agentRunner.get(runRef) : this.workflowRunner.get(runRef);
      return run.resumeAt ?? null;
    } catch {
      return null;
    }
  }

  /** Resolve a run's free-form project reference by id then name; null if unknown. */
  private async resolveProject(projectRef: string): Promise<Project | null> {
    if (!projectRef) return null;
    try {
      return await this.projects.get(projectRef);
    } catch {
      const all = await this.projects.list().catch((): Project[] => []);
      return all.find((p) => p.name === projectRef) ?? null;
    }
  }

  /**
   * Resume a parked loop run with an operator note (decision 4). Re-enters `drive()`
   * at the parked iteration index with a resume-context composed from the parked
   * verdict + the note (the same operator surface as a workflow park — identical UX,
   * distinct endpoint because the run types differ). Throws
   * {@link LoopRunNotParkedError} (→ 409) for any non-parked state.
   */
  async resumeParked(loopRunId: string, note?: string): Promise<LoopRun> {
    const run = this.runs.get(loopRunId) ?? (await this.readAggregate(loopRunId));
    if (!run) throw new LoopRunNotFoundError(loopRunId);
    this.runs.set(loopRunId, run);
    if (run.status !== "parked" || !run.parked) throw new LoopRunNotParkedError(loopRunId);

    const loop = await this.loops.get(run.loopId);
    const project = await this.projectForRun(run);
    const index = run.currentIteration ?? run.parked.iteration;
    const verdictTail = await fs.readFile(run.parked.verdictFile, "utf8").catch(() => "");
    const trimmed = note?.trim();

    run.status = "running";
    delete run.parkedReason;
    delete run.parked;
    run.currentIteration = index;
    await this.writeAggregate(run);
    this.log.info("parked loop run resumed", { loopRunId, index, withNote: Boolean(trimmed) });

    const resumeContext = await this.composeResumeContext(run, loop, verdictTail, trimmed);
    const traceId = this.trace.getTraceId() ?? randomUUID();
    void this.trace
      .run({ traceId, runId: loopRunId }, () =>
        this.drive(run, loop, project, [], { startIndex: index, resumeContext }),
      )
      .catch((err) => this.onDriveError(run, err));
    return run;
  }

  /**
   * Continue a failed/interrupted run at the iteration it stopped on — earlier
   * iterations (and their commits on the loop's branch) stay. Returns null when no
   * iteration ever ran (the caller falls back to a fresh re-run).
   */
  async continueFailed(loopRunId: string): Promise<LoopRun | null> {
    const run = this.runs.get(loopRunId) ?? (await this.readAggregate(loopRunId));
    if (!run) throw new LoopRunNotFoundError(loopRunId);
    if (run.status !== "failed" && run.status !== "interrupted") return null;
    const last = run.iterations[run.iterations.length - 1];
    if (!last) return null;

    this.runs.set(loopRunId, run);
    const loop = await this.loops.get(run.loopId);
    const project = await this.projectForRun(run);
    run.status = "running";
    run.currentIteration = last.index;
    await this.writeAggregate(run);
    this.log.info("failed loop run continued", { loopRunId, index: last.index });

    const resumeContext = await this.composeResumeContext(run, loop, last.verifier.output);
    const traceId = this.trace.getTraceId() ?? randomUUID();
    void this.trace
      .run({ traceId, runId: loopRunId }, () =>
        this.drive(run, loop, project, [], { startIndex: last.index, resumeContext }),
      )
      .catch((err) => this.onDriveError(run, err));
    return run;
  }

  /**
   * Re-resolve a run's project from its persisted `projectPath` (resume / restart).
   * A registry record deleted meanwhile degrades to a synthetic project carrying
   * just the path — the worktree cwd still applies.
   */
  private async projectForRun(run: LoopRun): Promise<Project | null> {
    if (!run.projectPath) return null;
    const all = await this.projects.list().catch((): Project[] => []);
    return (
      all.find((p) => p.path === run.projectPath) ?? {
        id: "unregistered",
        name: "unregistered",
        path: run.projectPath,
      }
    );
  }

  list(): LoopRun[] {
    const cutoff = Date.now() - RETENTION_MS;
    const out: LoopRun[] = [];
    for (const [id, run] of this.runs) {
      const finished =
        run.status !== "running" && run.status !== "parked" && run.status !== "paused-limit";
      if (finished && Date.parse(run.startedAt) < cutoff) {
        this.runs.delete(id);
        continue;
      }
      out.push(run);
    }
    return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, MAX_LISTED);
  }

  /** The full loop run history (on disk + in memory), newest first; no age cutoff. */
  async listAll(): Promise<LoopRun[]> {
    const byId = new Map<string, LoopRun>();
    for (const run of await this.readAllAggregates()) byId.set(run.loopRunId, run);
    for (const [id, run] of this.runs) byId.set(id, run);
    return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  get(loopRunId: string): LoopRun {
    const run = this.runs.get(loopRunId);
    if (!run) throw new LoopRunNotFoundError(loopRunId);
    return run;
  }

  /**
   * Phase 43 — stop a running loop run: kill the current iteration's live maker
   * (through its own runner's `stop`, reusing the same {@link RunnerCore.cancel}
   * governance the agent/workflow stop already use) and flag the run so `drive()`
   * lands it `interrupted` on the maker's next terminal turn, instead of running the
   * verifier or dispatching a further iteration. Only a `running` loop with a
   * dispatched current-iteration maker owns a process to kill — anything else
   * (parked, paused-limit, no maker yet) throws {@link LoopRunNotStoppableError}.
   * Fires the kill and returns immediately; the kill's exit reconciles
   * asynchronously (mirrors the agent/workflow stop's own timing).
   */
  async stop(loopRunId: string): Promise<void> {
    const run = this.runs.get(loopRunId);
    if (!run || run.status !== "running") throw new LoopRunNotStoppableError(loopRunId);
    const iteration = run.iterations.find((i) => i.index === run.currentIteration);
    const makerRunRef = iteration?.makerRunRef;
    if (!iteration || !makerRunRef) throw new LoopRunNotStoppableError(loopRunId);
    this.stopRequested.add(loopRunId);
    try {
      if (iteration.makerKind === "agent") this.agentRunner.stop(makerRunRef);
      else await this.workflowRunner.stop(makerRunRef);
    } catch (error) {
      this.stopRequested.delete(loopRunId);
      throw error instanceof RunNotFoundError || error instanceof WorkflowRunNotStoppableError
        ? new LoopRunNotStoppableError(loopRunId)
        : error;
    }
  }

  /** Permanently delete a loop run and all its artifacts (worktree pruned first). */
  async delete(loopRunId: string): Promise<void> {
    const run = this.runs.get(loopRunId) ?? (await this.readAggregate(loopRunId));
    if (!run) throw new LoopRunNotFoundError(loopRunId);
    this.runs.delete(loopRunId);
    this.prompts.delete(loopRunId);
    if (run.workspace && run.projectPath) {
      await this.workspace
        .removeWorktree({ projectPath: run.projectPath, worktreePath: run.workspace.path })
        .catch(() => {});
    }
    const root = this.resolveRunDir(loopRunId);
    if (root) await fs.rm(root, { recursive: true, force: true }).catch(() => {});
  }

  /**
   * Read one whitelisted run artifact by name. `name` must be on
   * {@link LOOP_RUN_ARTIFACTS} — anything else (incl. any traversal attempt)
   * returns null → 404; there is no generic file browser. Returns null when the
   * run is unknown or the file is absent.
   */
  async readArtifact(
    loopRunId: string,
    name: string,
  ): Promise<{ name: LoopRunArtifact["name"]; content: string } | null> {
    if (!(LOOP_RUN_ARTIFACTS as readonly string[]).includes(name)) return null;
    const allowed = name as LoopRunArtifact["name"];
    const root = this.resolveRunDir(loopRunId);
    if (!root) return null;
    const content = await fs.readFile(path.join(root, allowed), "utf8").catch(() => null);
    return content === null ? null : { name: allowed, content };
  }

  /** Subscribe to aggregate transitions of every loop run (SSE / activity recorder). */
  onRunStatus(listener: (run: LoopRun) => void): () => void {
    this.events.on("status", listener);
    return () => this.events.off("status", listener);
  }

  /** The run's folder inside the runs dir, or null if the id would escape it. */
  private resolveRunDir(loopRunId: string): string | null {
    const dir = path.resolve(this.dir, loopRunId);
    if (path.dirname(dir) !== this.dir) return null;
    return dir;
  }

  protected async writeAggregate(run: LoopRun): Promise<void> {
    await fs
      .writeFile(path.join(run.cwd, AGGREGATE_FILE), JSON.stringify(run), "utf8")
      .catch(() => {});
    this.events.emit("status", run);
  }

  /** Read a run's aggregate `run.json` from disk (for a run dropped from memory). */
  protected async readAggregate(loopRunId: string): Promise<LoopRun | null> {
    const root = this.resolveRunDir(loopRunId);
    if (!root) return null;
    const raw = await fs.readFile(path.join(root, AGGREGATE_FILE), "utf8").catch(() => null);
    if (raw === null) return null;
    try {
      const parsed = LoopRunSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /** Read every `<id>/run.json` aggregate from disk. */
  private async readAllAggregates(): Promise<LoopRun[]> {
    const entries = await fs.readdir(this.dir, { withFileTypes: true }).catch(() => []);
    const out: LoopRun[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const run = await this.readAggregate(entry.name);
      if (run) out.push(run);
    }
    return out;
  }

  /**
   * Rebuild the registry from disk and reconcile mid-flight runs (decision 10,
   * run-ref-aware). The inner runners' registries are already rebuilt (LoopsModule
   * imports them, so they init first), so an iteration's maker run reflects its
   * reconciled status:
   * - terminal (`done`/`failed`) or `parked` → durable, left as-is.
   * - `running`/`paused-limit` loop whose maker is still alive/durable
   *   (`running`/`paused-limit`) → re-ATTACH the wait (continuation, no re-dispatch),
   *   so the maker's own Phase 9.2 auto-resume owns a paused maker.
   * - `running`/`paused-limit` loop whose maker died with the API
   *   (`interrupted`/`failed`/missing) → re-DISPATCH that iteration fresh with
   *   resume-context (the worktree + checkpoints survive on disk).
   */
  private async reconstruct(): Promise<void> {
    // Phase 12.4 (Law 3): registry rehydration ALWAYS happens so live runs are
    // visible/answerable; re-driving is GATED. By default a `running`/`paused-limit`
    // loop is NOT auto-re-dispatched on boot — under `ts-node-dev --respawn` + claude
    // mode a restart alone would spawn a real `claude` with no operator approval
    // (Tier 3). Instead it is parked `awaiting-resume` and surfaced for an explicit
    // operator resume. The operator-owned `systemConfig.goalAutoResume` restores
    // auto-reconcile for the headless launchd daemon (Phase 8.3).
    const autoResume = this.systemConfig.current().goalAutoResume;
    for (const run of await this.readAllAggregates()) {
      this.runs.set(run.loopRunId, run);
      if (run.status !== "running" && run.status !== "paused-limit") continue;
      // A secondary instance (shared/instance-role) only mirrors loops: the primary
      // may be driving this one right now, so never park or re-dispatch it here.
      if (!isPrimaryInstance()) continue;
      if (autoResume) {
        void this.reconcileLoop(run).catch((err) => this.onDriveError(run, err));
      } else {
        await this.parkLoop(run, "awaiting-resume", run.currentIteration ?? 0);
        this.log.info("loop rehydrated, awaiting operator resume (Law 3 boot gate)", {
          loopRunId: run.loopRunId,
        });
      }
    }
  }

  /**
   * A fire-and-forget `drive()` rejected (e.g. a dispatch-time WorkflowNotFoundError):
   * mark the run failed and log, so it never becomes an unhandled promise rejection.
   */
  private async onDriveError(run: LoopRun, err: unknown): Promise<void> {
    this.log.error("loop drive threw — failing run", {
      loopRunId: run.loopRunId,
      err: err instanceof Error ? err.message : String(err),
    });
    run.status = "failed";
    run.currentIteration = null;
    await this.writeAggregate(run).catch(() => {});
  }

  private async reconcileLoop(run: LoopRun): Promise<void> {
    const loop = await this.loops.get(run.loopId).catch(() => null);
    if (!loop) {
      run.status = "failed";
      run.currentIteration = null;
      await this.writeAggregate(run);
      return;
    }
    const project = await this.projectForRun(run);
    const index = run.currentIteration ?? 0;
    const iteration = run.iterations.find((i) => i.index === index);
    const makerRunRef = iteration?.makerRunRef;
    const makerStatus = makerRunRef ? this.makerStatus(loop.maker.kind, makerRunRef) : null;
    const traceId = randomUUID();

    if (makerRunRef && (makerStatus === "running" || makerStatus === "paused-limit")) {
      // The maker survived — re-attach the wait; its own 9.2 owns a paused maker.
      this.log.info("loop reconcile: re-attaching to in-flight maker", {
        loopRunId: run.loopRunId,
        index,
        makerStatus,
      });
      void this.trace
        .run({ traceId, runId: run.loopRunId }, () =>
          this.drive(run, loop, project, [], { startIndex: index, attachRunRef: makerRunRef }),
        )
        .catch((err) => this.onDriveError(run, err));
      return;
    }

    // The maker died with the API → re-dispatch this iteration fresh (continuation).
    this.log.info("loop reconcile: re-dispatching dead maker iteration", {
      loopRunId: run.loopRunId,
      index,
      makerStatus,
    });
    run.status = "running";
    run.resumeAt = null;
    await this.writeAggregate(run);
    const lastVerdict = iteration?.verifier.output ?? "";
    const resumeContext = await this.composeResumeContext(run, loop, lastVerdict);
    void this.trace
      .run({ traceId, runId: run.loopRunId }, () =>
        this.drive(run, loop, project, [], { startIndex: index, resumeContext }),
      )
      .catch((err) => this.onDriveError(run, err));
  }

  /** Emit a never-throws loop activity entry (Tier 1, silent + recorded). */
  private recordActivity(
    run: LoopRun,
    kind: "loop-dispatched" | "loop-verdict" | "loop-parked",
    summary: string,
    runRef?: string,
  ): void {
    void this.activity.record({
      kind,
      summary,
      refs: { loopRunId: run.loopRunId, loopId: run.loopId, ...(runRef ? { runRef } : {}) },
    });
  }
}
