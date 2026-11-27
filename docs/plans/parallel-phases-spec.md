# Parallel phases (fan-out branches) — spec

Approved by the operator 2026-11-27. A workflow can fan out: one phase of `type: "parallel"`
starts N child workflow runs at once, waits for all of them, joins their artifacts.

```yaml
- id: publish
  type: parallel
  consumes: model.md
  produces: published.md        # joined index (required)
  approval: ask                 # optional, gate after the join as for any phase
  when: { ... }                 # optional, as for any phase
  branches:                     # min 2, unlimited
    - id: makerworld            # unique within the phase, AgentId-like slug
      workflow: makerworld-publish
      produces: makerworld-published.md   # optional; default `<branch id>.md`
    - id: printables
      workflow: printables-publish
```

## Design rule

`drive()` stays serial with one cursor. The `phases` array stays linear; a parallel phase is
ONE entry in it. Concurrency lives only in child runs (each child has its own driver, exactly
like today's `type: "workflow"` sub-run). Nesting = a branch workflow may itself contain a
parallel phase (depth capped by the existing `MAX_SUB_RUN_DEPTH`, cycles by `ancestry`).

## Contract (`libs/contracts/src/workflows/`)

- `WorkflowPhaseTypeSchema` += `"parallel"`.
- `WorkflowPhaseSchema` += `branches?: ParallelBranch[]` with
  `ParallelBranchSchema = z.object({ id, workflow, produces? }).strict()`.
- `refineWorkflow`: a parallel phase requires `consumes`, `produces`, `branches` (≥ 2, unique
  ids, each `produces` unique and ≠ the phase `produces`); must NOT set `agent`, `model`,
  `thinking`, `commands`, `prompt`, `skill`, `reviewPacks`, `engine`, `engineModel`,
  `openaiModel`, `include`, `qualify`, `workflow`, `action`, `loop`, `advisor`. No other phase
  type may set `branches`. No phase's `loop.to/then/driftTo` may target a parallel phase
  (re-running would republish succeeded branches). `consumes`-produced-upstream check applies.
- `workflow-run.schema.ts`:
  - `StageRunSchema` += `branches?: Array<{ id, workflow, childRunId?, status, costUsd? }>`
    (status = the child's terminal/current WorkflowState, or `"skipped"`/`"failed"` if it
    could not start).
  - `WorkflowRunSchema` += `pendingBranches?: { phaseId, attempt, stageDir, handoffSource,
    startedAt, branches: Array<{ id, workflow, childRunId?, produces, status?,
    costUsd?, artifact? }> }`. Leave `pendingChild` untouched (single sub-run phases keep it).
- Export the new types from the package index. Update the schema's doc comments.

## Runner (`apps/api/src/workflows/workflow-runner.service.ts`)

Model it on `startChild` (≈R:3361) / `onChildStatus` (≈R:3446) / the `settledChild` path in
`drive()` (≈R:1625-2059).

1. **Start (`startBranches`)**: in `drive()`'s dispatch (≈R:1784) a `parallel` phase prepares
   its stage dir as usual, reads the handoff once, then BUILDS `run.pendingBranches` with all
   branches (no childRunId yet) and persists it BEFORE starting any child. Then starts each
   child via `this.start(...)` with `{ parentRunId, maxCostUsd: remaining / N }` (budget split
   evenly; uncapped stays uncapped), recording each `childRunId` as it returns and persisting.
   A child that fails to start (cycle, depth, missing workflow) is recorded `status: "failed"`
   immediately. `drive()` returns (like the `startChild` return at ≈R:1799).
2. **Settle (`onChildStatus`)**: also look up parents whose `pendingBranches` contains the
   child id. Record the child's status on its branch entry synchronously (no await between
   lookup and write for the same run — guard with a per-run promise chain or an in-memory
   "settling" flag so two children finishing in the same tick cannot both re-enter `drive()`).
   - Parent status: `running` while any branch is running/not yet terminal and not parked;
     `parked` with `parkedReason: "child"` when no branch is running and ≥ 1 is
     parked/paused-limit; un-park back to `running` when a parked branch resumes.
   - On a terminal branch: copy the child's latest artifact (same helper the single sub-run
     uses) into `<stageDir>/<branch.produces>`, store `costUsd = runSpend(child)`.
   - When the LAST branch is terminal: delete `pendingBranches`, write the joined `produces`
     (Markdown: `# <phase id>` then per branch `## <branch id> — <workflow> (<status>)`,
     child run id, and the artifact content or "no artifact"), build ONE `StageRun` with
     `branches[...]`, `costUsd` = sum, `childRunId` unset, status `done` iff every branch is
     `done` else `failed`. Re-enter `drive()` exactly once via the same `settledChild`-style
     path (skip pause/when/limit/budget checks on that first iteration). A failed parallel
     stage fails the run (no loop is allowed on it).
3. **Instantly failing child**: a child that reaches a terminal status during `start()` (before
   the parent recorded its id) must still settle correctly — record ids first or re-check the
   child's status after `start()` returns.
4. **resumeParked / stop / reconstruct**:
   - `resumeParked` on a parent parked by branches resumes EVERY parked branch child.
   - `stop()` on a parent with `pendingBranches` stops every non-terminal child, then the
     parent lands `interrupted` (also when the parent itself has no `currentStageRunId`).
   - `reconstruct` must not fail a `running` parent that has `pendingBranches` with live
     children; the second resync pass (today: per `pendingChild`) must also replay every
     branch child through `onChildStatus` (a vanished child = that branch `failed`).
5. **Budget**: parent spend accrues the branch costs on the join (as the single sub-run does).
6. Lookups that scan `stageRuns` (`evaluateWhen`, `latestStageDir`, `consumedHandoff`,
   `recomputeHandoff`) keep working because the parallel phase has one StageRun and one
   `produces` like any phase.

## Tests (no live marketplace runs, ever)

- Contract: `workflow.schema` tests for valid/invalid parallel phases (missing branches, 1
  branch, dup ids, forbidden fields, loop targeting a parallel phase, `branches` on another
  type).
- API e2e `apps/api/test/workflow-parallel.e2e.test.ts` modelled on
  `apps/api/test/workflow-subrun.e2e.test.ts` (fake-claude): (a) agent → parallel(2 child
  workflows) → agent: both children run, joined artifact contains both, next phase consumes
  it, one StageRun with 2 branches; (b) one branch fails → sibling still finishes → run
  failed; (c) one branch parks on an approval gate while the other finishes → parent parks
  `child` only after the other is terminal; approving finishes the parent; (d) an
  instantly-failing branch (missing workflow id).

## Web

- `apps/web/features/workflows/components/WorkflowDialog/workflow-graph.ts`: `phasesToGraph`
  / `graphToPhases` must round-trip `type: "parallel"` + `branches` losslessly (test it —
  otherwise saving in the editor deletes branches). Grep every consumer that switches on
  `phase.type` (Inspector, Palette, AgentNode, FlowCanvas, list card, i18n labels) and give
  `parallel` a sane read-only rendering.
- Workflow detail canvas (`WorkflowEditor/FlowCanvas.tsx` + `canvasLayout.ts`): a parallel
  phase draws as a fork: one edge from the previous card splits to N branch cards stacked
  vertically (each shows branch id + workflow name, clicking navigates to
  `/work/workflows/<workflow>`), then the edges join into the next card. Layout must stay
  correct for any N (row height grows). Branch editing in the UI is out of scope; the
  Inspector shows the branches read-only with a hint that they are edited in the recipe.
- Run detail (`features/runs/components/WorkflowStageTimeline.tsx`, `runDetailModel.ts`): a
  parallel stage shows its branches as indented sub-rows (branch id, status, cost, link to
  `/activity/runs/<childRunId>`), live from `pendingBranches` while running and from the
  StageRun's `branches` once joined.
- List card `WorkflowPipelineCard`: a parallel phase shows as one node labelled with the
  branch count (e.g. "publish ×2"); no DS change unless trivial.
- i18n: new keys in both `apps/web/i18n/messages/cs.json` and `en.json`.
