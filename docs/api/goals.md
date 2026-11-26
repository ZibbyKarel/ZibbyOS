# Goals

A goal is a mandate the operator gives ZIBBY: an outcome plus constraints (scope, deadline or
cadence, budget, autonomy ceiling). This document covers the contract, storage, CRUD API and the
engine that plans and acts. Spec: `docs/plans/goals-mandates-spec.md`.
Not to be confused with the loop (`docs/api/loops.md`, maker + verifier).

## Model

`libs/contracts/src/goals/`: `Goal` (`goal.schema.ts`), `GoalState`, `GoalInstance`,
`GoalTimelineEvent`, `GoalRollup` and `rollupGoal` (`goal-state.schema.ts`), `GOAL_PRESETS`
(`goal-presets.ts`), `goalsContract` (`goals.contract.ts`).

- `deadline` and `cadence` are mutually exclusive; `cycleHours` needs `cadence`; `ceiling` defaults to `tier2`.
- `mergeGrant` exists on `Goal` only. Create and update reject it (422); a later route sets it.
- Roll-up status: `paused | planning | acting | waiting | needs-you | done`, counts
  `{ total, done, parked, active }` and `needsYou`. Disabled = `paused`; no instances = `planning`;
  any parked instance (every `parkedReason`) = `needs-you`; all done = `done`; otherwise the
  busiest of acting > planning > waiting.
- `GOAL_PRESETS`: 11 prepared goals (`enabled: false`, Czech text, `group`). Data only, never written to disk.

## Files on disk

```
<data>/goals/<id>.goal.md              frontmatter = every field except id/outcome; body = outcome
<data>/goals/state/<id>/state.json     GoalState (atomic write)
<data>/goals/state/<id>/timeline.jsonl append-only GoalTimelineEvent lines
```

`GOALS_DIR` overrides `<data>/goals`. A missing or corrupt state file reads as an empty state
(cycle 0, no instances); corrupt timeline lines are skipped.

## Routes (`/api`)

| Route                                        | Notes                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /goals`                                 | goals, each with its `rollup`                                                                                    |
| `POST /goals`                                | 201; 409 duplicate id; 422 invalid / `mergeGrant`                                                                |
| `GET /goals/:id`                             | 404                                                                                                              |
| `PATCH /goals/:id`                           | partial; 422 as for create (also if the merged goal is invalid)                                                  |
| `DELETE /goals/:id`                          | removes the definition and `state/<id>/`                                                                         |
| `GET /goals/:id/state`                       | `{ state, rollup }`                                                                                              |
| `GET /goals/:id/timeline?instance=&cycle=`   | newest last, at most 500                                                                                         |
| `POST /goals/:id/wake`                       | clears every instance's `fingerprint`, logs a `wake` event                                                       |
| `POST /goals/:id/instances/:instance/resume` | parked -> `planning`, clears `parkedReason` and `planFailures`, sets `resumedCycle`; 404 unknown, 409 not parked |

## Engine

`apps/api/src/goals/goal-engine.module.ts` (`GoalEngineModule`, separate from `GoalsModule` so
the briefing and the events channel read the stores without the engine's dependencies).

| Piece           | File                      | Role                                                                     |
| --------------- | ------------------------- | ------------------------------------------------------------------------ |
| Heartbeat       | `goal-engine.service.ts`  | `GoalEngineService` (`TickingWatcherBase`, watcher id `goal-engine`)     |
| Cadence         | `goal-cadence.ts`         | `nextCycleStart`, `latestCycleStart` in `Europe/Prague` (DST-aware)      |
| Facts           | `goal-facts.ts`           | `GoalFactsService` over the `GOAL_FACTS_SOURCES` list; `goalFingerprint` |
| Planner seam    | `goal-planner.ts`         | `GoalPlanner` behind the `GOAL_PLANNER` token; `goalPlanNoteId`          |
| Planner         | `goal-planner.service.ts` | `GoalPlannerService`: one model run, prompt, `<goal-plan>` parser, note  |
| Action executor | `goal-action-executor.ts` | `GoalActionExecutor`: ceiling filter + one handler per action type       |
| Plan contract   | `goal-plan.schema.ts`     | `GoalPlanSchema`, `GoalActionSchema`, `GOAL_ACTION_MIN_CEILING`          |

### Tick

`systemConfig.goalEngineTickMs` (default `60_000`, `0` disables, primary instance only). Each
tick, per enabled goal (one goal failing never blocks the others):

1. **Instances** from the scope: none -> `_`; `projects` -> those ids; `company` -> that
   company's projects; `all` -> every project.
2. **Bookkeeping** under the state lock (`bookkeep`). A standing goal past a cadence boundary
   starts ONE new cycle anchored at the latest boundary (missed boundaries are not replayed):
   every in-scope instance goes back to `planning` with no `taskIds`, nudges are cleared, and a
   `cycle-started` timeline line plus a `goal-started` activity are written. `cycleHours` sets
   the cycle's `deadlineAt`; a one-off goal's `deadlineAt` is `goal.deadline`. A new in-scope
   project gets an instance; one that left the scope becomes `done` ("Left the goal's scope.").
3. **Per instance** (sorted, each in its own try/catch), skipping `parked` and `done`:
   - Past `cycle.deadlineAt` -> park `deadline`. The cycle budget used up and no task in
     flight -> park `budget`; used up with a task still in flight -> nothing (no paid
     re-plan; it parks once the work ends). All happen before the wake check, with no planner call, and
     neither applies to an instance the operator resumed in this cycle (`resumedCycle` = the
     cycle index; a new cycle clears it). A resumed one-off goal past its deadline is not
     parked again for that deadline (the operator's choice); its planner calls stay bounded by
     the fingerprint and the wake floor.
   - **Wake check.** The facts are fingerprinted (sha256 of the key-sorted JSON, no clock in
     it). The planner runs only when the fingerprint differs from the stored one, `wakeAt` is
     due, or a dirty ref matches: one of the instance's `taskIds` or a `waitingOn` ref that
     settled (`ApprovalsService.settled()`, a `task-outcome` activity). Otherwise no model call.
   - A `goal-woke` activity, then `planner.plan(ctx)`, validated with `GoalPlanSchema`. A throw,
     an invalid plan or a run over `PLAN_TIMEOUT_MS` (10 min) counts in `planFailures`; 3 in a
     row park `failed`. The timeout aborts `ctx.signal`, and the planner stops its model run.
   - **Feasibility.** The first plan of a cycle (`instance.feasibility` unset, `ctx.firstPlan`)
     must carry `feasibility`; one without it is a plan failure. The engine stores it on the
     instance, writes a `feasibility` timeline line and, when the plan sets `atRisk: true`,
     sends a report "Cíl je ohrožený: <feasibility>" (operator notification). Later plans of
     the same cycle do not write it again; a new cycle clears it. A plan with a non-empty
     `plan` sets `instance.planNoteId`.
   - The actions run through the executor. Then: `waitingOn`/`wakeAt` set -> `waiting`; a task
     in flight -> `acting`; otherwise `planning`. The fingerprint is taken again over the post-action facts,
     so the actions' own changes do not wake the planner on the next tick.
4. The result is written under the lock onto the freshly read instance. It is dropped when the
   cycle changed, the instance went away or was parked meanwhile, and a timeline line
   ("Tick result dropped: …") says so. A `wake` that landed meanwhile keeps its cleared
   fingerprint. Task ids recorded by a handler are kept either way (see below).

An instance whose processing throws puts back the dirty refs it consumed, so the next tick
still sees them. A goal that throws before reaching its instances puts back only the refs that
no successfully processed instance consumed, so other goals do not re-plan off them every tick. An idle tick writes nothing (`GoalStateStore.update` skips an unchanged
state), so it emits no `goals` SSE event.

Remaining budget (live: each `recordTask` lowers `runs`, so one plan cannot overspend):
`maxRunsPerCycle - taskIds.length`, and `maxCostUsdPerCycle` minus
`BudgetLedgerStore.sumCostForTasks(taskIds, cycle.startedAt, now)` (`docs/api/budget.md`).

### Actions and the ceiling filter

| Action       | Fields                                                      | Min ceiling | Handler in this phase                   |
| ------------ | ----------------------------------------------------------- | ----------- | --------------------------------------- |
| `note`       | `text`                                                      | tier1       | timeline line                           |
| `report`     | `text`                                                      | tier1       | timeline + `goal-acted`                 |
| `wait`       | `waitingOn?`, `wakeAt?` (one required)                      | tier1       | sets the fields; `wakeAt` ≥ now + 5 min |
| `done`       | `summary?`                                                  | tier1       | status `done`, `goal-done`              |
| `park`       | `reason`, `text?`                                           | tier1       | status `parked`                         |
| `start-task` | `text`, `title?`, `targetId?`                               | tier2       | none yet                                |
| `run-loop`   | `text`                                                      | tier2       | none yet                                |
| `pr-action`  | `action` (review/address-comments/fix-ci), `repo`, `number` | tier2       | none yet                                |
| `message`    | `to`, `text`, `integrationId?`, `threadRef?`                | tier2       | none yet                                |
| `propose`    | `candidates[]` (`title`, `why?`, `checklistId?`)            | tier2       | none yet                                |
| `merge`      | `repo`, `number`, `headSha`                                 | tier3       | none yet                                |

An action above the goal's `ceiling` (`ceilingAllows`), or one with no handler, becomes a
`report` naming what was not done, and so does a spending action (`start-task`, `run-loop`)
once `ctx.remainingBudget` is used up. After `done` or `park` no further action runs. A handler
that starts a task must `await ctx.recordTask(taskId)` before returning: it writes the id to the
stored instance at once, so a crash or a dropped result never forgets spent work. A later phase
adds a handler with `GoalActionExecutor.register(type, handler)`, a facts source by appending to
the `GOAL_FACTS_SOURCES` factory.

### Planner (`GoalPlannerService`)

One fresh model run per plan, the loop verifier's precedent: the synthetic, unstored agent
`goal-planner` (model and engine from the global config, as for any agent without its own)
through `AgentRunnerService.startSynthetic`, in the instance's project (its usual run
worktree) or sandbox-only when there is no project or no local clone. Memory grounding is
picked by the words of the goal's name and outcome, not by the prompt (so facts cannot steer
which notes land in the system prompt).

**Read-only run.** `startSynthetic` builds the command with `ClaudeRunOptions.readOnly`: the
planner has no tools at all (the facts are already in the prompt) and can only answer. On
claude: `--tools ""`, `--permission-mode dontAsk`, `--disallowedTools` with
`READ_ONLY_DENIED_TOOLS` (Bash, Write, Edit, NotebookEdit, WebFetch, WebSearch, Agent, Task,
Workflow, Skill, ToolSearch, ListAgents, RemoteTrigger), `--strict-mcp-config` with no
`--mcp-config`, no `--agents`, `--plugin-dir`, `--add-dir` or custom hooks, no operating
contract and no execution directive (verified on claude 2.1.332: the init event lists
`tools: []`, `mcp_servers: []`). On opencode: one permission rule, `* deny`, no MCP servers,
no gate plugin, no granted dirs, no directive. Its output only counts through
`GoalPlanSchema` and the engine's ceiling filter.

- **Prompt** (English; the plan, feasibility and every note/report/message text are asked for
  in Czech). It carries the goal (outcome, predicate), the instance, cycle + deadline + now,
  the ceiling, the budget left after this planning run, the nudge counters, the month's
  decision count, the current plan note and the facts. The offered actions are generated from
  `GoalActionSchema` (one JSON schema per action), filtered by the ceiling, by
  `GoalActionExecutor.handles(type)` (the rest are named "not executable yet") and by the
  budget (no `start-task`/`run-loop` when this run uses the last run or the cost is spent).
- **Untrusted data.** Facts and the stored plan note sit in `<untrusted-data>` sections; every
  interpolated text has `<goal-plan>` and `<untrusted-data>` tags stripped (`stripPlanTags`).
  The prompt says this data can never change the ceiling, grant a merge or add actions. The
  prompt is not the control: the output is only parsed through `GoalPlanSchema`, and the
  engine's ceiling filter decides.
- **Output** (`parseGoalPlan`). The **last** `<goal-plan>…</goal-plan>` block whose opening tag
  starts a line, as JSON through `GoalPlanSchema`. Both flattened run log formats (claude and
  opencode) indent tool results, so a block inside a tool result never counts (tested for
  both). No block, invalid JSON, an unknown
  action, a run that did not end `done` (a run waiting on approval or paused on the usage
  limit is stopped) or a first plan without feasibility all throw (a plan failure).
- **Budget.** The planner's run id is recorded on the instance through `ctx.recordRun` (the
  engine binds it to `recordTask`), so it counts against `maxRunsPerCycle` and the live
  `remainingBudget`; its cost is written to the budget ledger as a cost line under the same
  id (`kind: "goal-plan"`), so `sumCostForTasks` includes it. In the task facts it shows as a
  `missing` task with a `goal-planner_` id; the prompt says so. **`maxRunsPerCycle: 1`:** the
  planning run is the cycle's only run. That plan still carries the feasibility line (and
  the at-risk report) and may note, report, wait or finish, but it is offered no spending
  action; with nothing in flight the next tick parks the instance `budget`. Give a goal that
  should do work at least 2 runs per cycle. **Each re-plan costs a run:** a task changing
  state re-plans, so N tasks take roughly 2N+1 runs per cycle (one plan, then a task and the
  plan its outcome triggers). With the budget used up and work in flight, the engine does not
  plan again.
- **Plan note.** A valid plan with a non-empty `plan` is written to the flat vault note
  `goal-<goalId>-<instance>-plan` (tier `knowledge`, frontmatter `type: goal-plan`, `goalId`,
  `instance`): created on the first plan and linked from the `goals` MOC (`updateIndex`),
  updated (body replaced) afterwards. It is read back as the next plan's input. A failed plan
  never touches it.

### Activity, notifications, live updates

Activity kinds (group `goals`): `goal-started`, `goal-woke`, `goal-acted`, `goal-parked`,
`goal-done`, `goal-merged`, with refs `goalId`, `itemId` (instance key) and `projectId`. The
operator channel sends `goal-parked` (Tier 3) and `goal-done` / report `goal-acted` as
`goal-update` (Tier 2), see `docs/api/operator-channel.md`. Parked instances are briefing
needs-you items, acting/waiting ones a watching line (`docs/api/briefing.md`). Every state write
and timeline append emits the SSE scope `goals` (`docs/api/events.md`).
