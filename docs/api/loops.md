# Loops (Phase 10)

> The delivery loop, generalized: "**Architekt → Kodér ⇄ Code-Review → Tester →
> Dokumentátor**" — a loop is the loop's outer shell, iterating a _maker_ against a
> _verifier_ until the verifier is satisfied or bounded effort runs out.

A **loop** is the 4th `TaskTarget` kind (alongside `agent`, `workflow`, `orchestrator`):
a stored `.loop.md` recipe naming a maker (an existing agent or workflow, dispatched
through its own runner **unchanged**) and a verifier (a fresh `claude` judge run). `LoopRunnerService` is the outer loop that dispatches the
maker, runs the verifier, and either finishes, parks for the operator, or feeds the
verifier's output back into the next iteration as resume-context. This is deliberately
thin glue over delivered machinery — no new dispatch path, no new session model.

> **Internal tool.** There is no loops screen any more (the old `/work/goals` pages were
> removed to free the `goal` name for operator mandates). A loop is created by the task
> "Loop" form (`features/tasks/loop.ts`) and watched in the unified runs UI
> (`LoopDetailPanel`). A parked loop's operator notification links to the run's page
> (`/activity/runs/<loopRunId>`).

## Pieces

| Piece           | File                                          | Role                                                                                                     |
| --------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Contract        | `libs/contracts/src/loops/loop.schema.ts`     | `Loop`, `MakerRef`, `VerifierSpec`, `CreateLoopInput`/`UpdateLoopInput` schemas                          |
| Contract (runs) | `libs/contracts/src/loops/loop-run.schema.ts` | `LoopRun`, `LoopIteration`, `LoopState`, `LoopParkedReason` — the run aggregate shape                    |
| Contract (HTTP) | `libs/contracts/src/loops/loops.contract.ts`  | CRUD-only ts-rest router; run operations live on the unified `taskRuns` contract, not here               |
| Storage         | `apps/api/src/loops/loops.storage.service.ts` | `LoopsStorageService` — file-backed CRUD over `<id>.loop.md` (frontmatter = config, body = instructions) |
| Errors          | `apps/api/src/loops/loops.errors.ts`          | `LoopNotFoundError`/`LoopConflictError`/`InvalidLoopError`/`CorruptLoopFileError` + run-side errors      |
| Runner          | `apps/api/src/loops/loop-runner.service.ts`   | `LoopRunnerService` — the outer maker/verifier loop, one worktree per run, park/resume/reconcile         |
| Stop logic      | `apps/api/src/loops/loop-stop.ts`             | `decideStop` (pure stop-condition matrix) + `renderLoopProgress` (resume-context progress block)         |
| Controller      | `apps/api/src/loops/loops.controller.ts`      | Implements `loopsContract` against `LoopsStorageService`                                                 |

## Endpoints (`/api/loops`)

`loopsContract` covers only the **loop definition** (the recipe), mirroring
`agentsContract`/`workflowsContract`:

- `POST /loops` — create a loop (`409` on id conflict, `422` on a structurally invalid
  maker/verifier).
- `GET /loops` — list all loops.
- `GET /loops/:id` — get one loop (`404` if unknown).
- `PATCH /loops/:id` — partial update (`404`/`422`).
- `DELETE /loops/:id` — delete the definition.

**A loop _run_ has no per-kind HTTP surface.** A run is started only by creating a
task with a `loop` target (`POST /api/tasks`); every run operation — detail, logs,
resume, delete, artifact fetch — lives on the unified `taskRuns` contract under
`/api/tasks/runs/*` (see `docs/api/tasks.md`). There is intentionally no
`loopRunsContract`. The one loop-specific detail on that unified surface is the
artifact allowlist: a loop run only ever exposes `objective.md`, `verdict.txt`, and
`resume-context.md` (`LOOP_RUN_ARTIFACTS`).

## Flow

Loop-run children get their env from `agentBaseEnv()`, which strips the operator-token env vars
(see `docs/api/approvals.md`).

### Starting a run

`LoopRunnerService.start(loopId, prompt, project, files, title, taskId, matchedTerms, attachments)`
reads the loop definition, resolves the target project, and creates a run root under
`LOOP_RUNS_DIR/<loopId>_<startedAtMs>` holding a forensic `objective.md`. If the
project is a git repo, the run gets **one worktree for its whole lifetime** (Phase
3.1) — every iteration's maker spawns there so its commits land on the same branch;
the worktree itself lives _outside_ the repo/data tree (`prepareWorktreeDir`, Phase
12.7), only the forensic artifacts (`objective.md`, `run.json`, per-iteration verdict
files) stay under the run root. A worktree-setup failure on a git project fails the
run outright — there is no silent fallback to the main checkout. `start()` returns
immediately; `drive()` runs the loop in the background.

### The iteration loop

`drive()` is the outer loop, keyed by iteration index (not a phase id):

1. **Budget check** — both the project's own daily/weekly/monthly run cap
   (`BudgetService.check`, see `docs/api/budget.md`) and the loop's _own_ windowed
   budget (`loopBudgetExceeded`, Phase 13.1: a rolling count of the loop's own
   iteration `startedAt` timestamps against `loop.budget.dailyRuns`/`weeklyRuns`).
   Either over-cap parks with reason `budget`, before the maker ever dispatches.
2. **Dispatch the maker** — `dispatchMaker` calls `AgentRunnerService.start` or
   `WorkflowRunnerService.start` verbatim (with the run's worktree as cwd), so the
   inner runner's own mid-run approval gate and usage-limit handling apply unchanged.
3. **Wait for the maker** (`waitForMaker`) — polls the maker run to a terminal state.
   A maker that pauses on the usage limit does **not** burn the iteration: the loop
   reflects `paused-limit` (with the maker's `resumeAt`) and keeps polling; the
   maker's own auto-resume (Phase 9.2) respawns it, and the same iteration completes
   when it does — no re-dispatch.
4. **Run the verifier** — the `claude` verifier is a **fresh** agent run on its own model with no
   shared session, graded on the `<verdict>pass|fail</verdict>` tag it writes into its
   own log (`parseLoopVerdict`, last tag wins) — **not** on its exit code. It is
   fail-closed: no parseable verdict, or a judge that never finished, is not satisfied.
   In practice this means a `claude`-verified loop whose judge never emits a
   parseable verdict is never satisfied, so it will burn every iteration up to
   `maxIterations` and then park with reason `iterations` rather than finishing
   `done`. Because `readLog()` returns the whole log — prompt echo included — and
   grading is literal last-tag-wins, an agent used as a `claude` verifier must
   never carry a complete, literal opening-verdict-tag/word/closing-verdict-tag
   example in its own instructions: that example would sit in the log next to
   whatever the judge actually rules, and if the judge omits its own tag, the
   instruction's example becomes the deciding verdict instead. The judge runs the
   target repo's own documented checks (its CLAUDE.md / AGENTS.md / README / package
   scripts) as needed.
5. **Decide** (`decideStop`, pure): satisfied → checkpoint the worktree (a local,
   ungated, never-pushed commit) and finish `done`. Not satisfied and this was the
   last allowed attempt (`maxIterations`) → park with reason `iterations`. Otherwise
   → compose the next iteration's resume-context from the verdict output
   (`buildResumeContext`, shared with the workflow resume path) and continue.

Every transition is persisted to `<runRoot>/run.json` (the aggregate) so the loop
survives an API restart.

### Storage format

A loop definition is one `<id>.loop.md` file (`LoopsStorageService`, extending the
same `MarkdownEntityStore` agents/workflows use): YAML frontmatter carries `name`,
`desc`, `objective`, `maker` (`{kind: "agent"|"workflow", id}`), `verifier`
(`{kind: "claude", agent, model?, thinking?}`),
`maxIterations`, an optional `budget`, and an optional `projectId` (O-16 — the
project the loop is scoped to; the `/work/loops` screens show it, a loop may stand
alone); the Markdown body is `instructions` —
standing guidance handed to every maker iteration. A loop missing a valid
maker/verifier is treated as corrupt (`CorruptLoopFileError`) rather than silently
dropped, since it cannot loop without them.

A loop _run_ is the JSON aggregate at `<LOOP_RUNS_DIR>/<loopRunId>/run.json`
(`LoopRunSchema`) — a clone of the workflow run's shape with `iterations[]` in place
of `stageRuns[]`. Each `LoopIteration` records its maker's run ref, the verifier
verdict (`kind`, `satisfied`, `output`), and status. Restart rebuilds the whole
registry from these files (`reconstruct()`); a `running`/`paused-limit` loop is
**not** auto-re-dispatched on boot by default (Law 3 / Tier 3 — a bare respawn must
not spawn a maker without approval) but parked `awaiting-resume` for an explicit
operator resume, unless the operator-owned `systemConfig.goalAutoResume` is `true` (read
at boot; the key keeps its old name, see `docs/ops/environment.md`).

### Park reasons and resume

A parked run (`LoopParkedReason`) is always durable and resumable with an operator
note: `iterations` (the `maxIterations` fuse blew), `budget` (a project or per-loop
cap went over), `limit` (the usage-limit auto-resume flapped past its cap),
or `awaiting-resume` (rehydrated on boot, pending an explicit operator decision). `resumeParked(loopRunId, note)`
re-enters `drive()` at the parked iteration index with a resume-context built from the
parked verdict plus the operator's note.
