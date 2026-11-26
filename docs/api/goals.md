# Goals

A goal is a mandate the operator gives ZIBBY: an outcome plus constraints (scope, deadline or
cadence, budget, autonomy ceiling). This document covers the contract, storage, CRUD API and the
engine that plans and acts. Spec: `docs/plans/goals-mandates-spec.md`.
Not to be confused with the loop (`docs/api/loops.md`, maker + verifier), which a goal can use
as an internal way to execute work (`run-loop`).

## Model

`libs/contracts/src/goals/`: `Goal` (`goal.schema.ts`), `GoalState`, `GoalInstance`,
`GoalTimelineEvent`, `GoalRollup` and `rollupGoal` (`goal-state.schema.ts`), `GOAL_PRESETS`
(`goal-presets.ts`), `goalsContract` (`goals.contract.ts`).

- `deadline` and `cadence` are mutually exclusive; `cycleHours` needs `cadence`; `ceiling`
  defaults to `tier2`.
- `mergeGrant` exists on `Goal` only. Create and update reject it (422); only the token-protected
  merge-grant route sets or clears it (see [Merge grant](#merge-grant)).
- Roll-up status: `paused | planning | acting | waiting | needs-you | done`, counts
  `{ total, done, parked, active }` and `needsYou`. Disabled = `paused`; no instances = `planning`;
  any parked instance (every `parkedReason`) = `needs-you`; all done = `done`; otherwise the
  busiest of acting > planning > waiting.
- `GOAL_PRESETS`: 11 prepared goals (`enabled: false`, Czech text, `group`). Data only, never
  written to disk.

## Files on disk

```
<data>/goals/<id>.goal.md              frontmatter = every field except id/outcome; body = outcome
<data>/goals/state/<id>/state.json     GoalState (atomic write)
<data>/goals/state/<id>/timeline.jsonl append-only GoalTimelineEvent lines
```

`GOALS_DIR` overrides `<data>/goals`. A missing or corrupt state file reads as an empty state
(cycle 0, no instances); corrupt timeline lines are skipped.

## Routes (`/api`)

| Route                                        | Notes                                                                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /goals`                                 | goals, each with its `rollup`                                                                                                                         |
| `POST /goals`                                | 201; 409 duplicate id; 422 invalid / `mergeGrant`                                                                                                     |
| `GET /goals/:id`                             | 404                                                                                                                                                   |
| `PATCH /goals/:id`                           | partial; 422 as for create (also if the merged goal is invalid)                                                                                       |
| `DELETE /goals/:id`                          | removes the definition and `state/<id>/`                                                                                                              |
| `GET /goals/:id/state`                       | `{ state, rollup }`                                                                                                                                   |
| `GET /goals/:id/timeline?instance=&cycle=`   | newest last, at most 500                                                                                                                              |
| `POST /goals/:id/wake`                       | clears every instance's `fingerprint`, logs a `wake` event                                                                                            |
| `POST /goals/:id/instances/:instance/resume` | parked -> `planning`, clears `parkedReason` and `planFailures`, sets `resumedCycle`; 404 unknown, 409 not parked                                      |
| `PUT /goals/:id/merge-grant`                 | body `{ projectIds, until }`; operator token (401); 422 unless ceiling tier3, `until` in the future and ≤ 24 h ahead, projects non-empty and in scope |
| `DELETE /goals/:id/merge-grant`              | revokes the grant; operator token (401)                                                                                                               |

## Engine

`apps/api/src/goals/goal-engine.module.ts` (`GoalEngineModule`, separate from `GoalsModule` so
the briefing and the events channel read the stores without the engine's dependencies).

| Piece           | File                      | Role                                                                         |
| --------------- | ------------------------- | ---------------------------------------------------------------------------- |
| Heartbeat       | `goal-engine.service.ts`  | `GoalEngineService` (`TickingWatcherBase`, watcher id `goal-engine`)         |
| Cadence         | `goal-cadence.ts`         | `nextCycleStart`, `latestCycleStart` in `Europe/Prague` (DST-aware)          |
| Facts           | `goal-facts.ts`           | `GoalFactsService` over the `GOAL_FACTS_SOURCES` list; `goalFingerprint`     |
| Planner seam    | `goal-planner.ts`         | `GoalPlanner` behind the `GOAL_PLANNER` token; `goalPlanNoteId`              |
| Planner         | `goal-planner.service.ts` | `GoalPlannerService`: one model run, prompt, `<goal-plan>` parser, note      |
| Action executor | `goal-action-executor.ts` | `GoalActionExecutor`: ceiling filter + one handler per action type           |
| Work handlers   | `goal-work-handlers.ts`   | `GoalWorkHandlers`: `start-task`, `run-loop`, `pr-action`                    |
| Wake sources    | `goal-facts-sources.ts`   | `PrFactsSource`, `ApprovalFactsSource`, `ReplyFactsSource`                   |
| Messages        | `goal-message.service.ts` | `GoalMessageService`: `message`, the `goal-message` runner, `messages` facts |
| Plan contract   | `goal-plan.schema.ts`     | `GoalPlanSchema`, `GoalActionSchema`, `GOAL_ACTION_MIN_CEILING`              |

### Tick

`systemConfig.goalEngineTickMs` (default `60_000`, `0` disables, primary instance only). Each
tick, per enabled goal (one goal failing never blocks the others):

1. **Instances** from the scope: none -> `_`; `projects` -> those ids; `company` -> that
   company's projects; `all` -> every project.
2. **Bookkeeping** under the state lock (`bookkeep`). A standing goal past a cadence boundary
   starts ONE new cycle anchored at the latest boundary (missed boundaries are not replayed):
   every in-scope instance goes back to `planning` with no `taskIds`, nudges and the message
   records are cleared, and a
   `cycle-started` timeline line plus a `goal-started` activity are written. `cycleHours` sets
   the cycle's `deadlineAt`; a one-off goal's `deadlineAt` is `goal.deadline`. A new in-scope
   project gets an instance; one that left the scope becomes `done` ("Left the goal's scope.").
3. **Per instance** (sorted, each in its own try/catch), skipping `parked` and `done`:
   - Past `cycle.deadlineAt` -> park `deadline`. The cycle budget used up and no task in
     flight -> park `budget`; used up with a task still in flight -> nothing (no paid
     re-plan; it parks once the work ends). All happen before the wake check, with no planner
     call, and
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
     in flight -> `acting`; otherwise `planning`. The fingerprint is taken again over the
     post-action facts,
     so the actions' own changes do not wake the planner on the next tick. When that read throws,
     the actions are still applied: a timeline note, and the pre-plan facts stand in, so the
     stored fingerprint is the one this plan saw and the same facts never re-plan in a loop.
4. The result is written under the lock onto the freshly read instance. It is dropped when the
   cycle changed, the instance went away or was parked meanwhile, and a timeline line
   ("Tick result dropped: …") says so. A `wake` that landed meanwhile keeps its cleared
   fingerprint. Task ids recorded by a handler are kept either way (see below).

An instance whose processing throws puts back the dirty refs it consumed, so the next tick
still sees them. A goal that throws before reaching its instances puts back only the refs that
no successfully processed instance consumed, so other goals do not re-plan off them every tick. An
idle tick writes nothing (`GoalStateStore.update` skips an unchanged
state), so it emits no `goals` SSE event.

Remaining budget (live: each `recordTask` lowers `runs`, so one plan cannot overspend):
`maxRunsPerCycle - taskIds.length`, and `maxCostUsdPerCycle` minus
`BudgetLedgerStore.sumCostForTasks(taskIds, cycle.startedAt, now)` (`docs/api/budget.md`).

### Actions and the ceiling filter

| Action             | Fields                                                                                                    | Min ceiling | Handler in this phase                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------- |
| `note`             | `text`                                                                                                    | tier1       | timeline line                                             |
| `report`           | `text`                                                                                                    | tier1       | timeline + `goal-acted`                                   |
| `wait`             | `waitingOn?`, `wakeAt?` (one required)                                                                    | tier1       | adds the waits; the earliest `wakeAt` wins, ≥ now + 5 min |
| `done`             | `summary?`                                                                                                | tier1       | status `done`, `goal-done`                                |
| `park`             | `reason`, `text?`                                                                                         | tier1       | status `parked`                                           |
| `start-task`       | `actionId`, `text`, `title?`, `targetId?`                                                                 | tier2       | `createTask` in the instance's project                    |
| `run-loop`         | `actionId`, `text`                                                                                        | tier2       | `createTask` with the goal's loop                         |
| `pr-action`        | `actionId`, `op` (review/address-comments/fix-ci), `projectId`, `repo`, `number`                          | tier2       | inbox service, `auto: true`                               |
| `message`          | `actionId`, `to: { kind: slack-user \| pr, ref }`, `text`, `about?: { repo, number }` (required for `pr`) | tier2       | `GoalMessageService` (below)                              |
| `propose`          | `candidates[]` (`id`, `title`, `why?`, `size` small\|large, `task`), ranked best first                    | tier1       | `GoalDecisionService` (below)                             |
| `update-checklist` | `id`, `done`                                                                                              | tier1       | `GoalDecisionService`: ticks a checklist item             |
| `merge`            | `actionId`, `projectId`, `repo`, `number`, `approvedSha` (40-hex)                                         | tier3       | `GoalMergeService`: only under a merge grant (below)      |

An action above the goal's `ceiling` (`ceilingAllows`), or one with no handler, becomes a
`report` naming what was not done, and so does a spending action (`start-task`, `run-loop`,
`pr-action`: each starts a paid run) once `ctx.remainingBudget` is used up. A handler that
throws (a refused or out-of-scope service, a host error) becomes a report "Not done: <type> —
<error>" too: never a thrown tick and never a paid re-plan. After `done` or `park` no further
action runs. A later phase adds a handler with `GoalActionExecutor.register(type, handler)`, a
facts source by appending to the `GOAL_FACTS_SOURCES` factory.

**Idempotency.** `start-task`, `run-loop`, `pr-action` and `message` carry a planner-supplied
`actionId`
(`[A-Za-z0-9._:-]{1,64}`). A handler that starts a task must `await ctx.recordTask(taskId,
actionId)` before returning: both ids land in the stored instance (`taskIds`,
`appliedActionIds`) in one `store.update`, so a crash or a dropped result neither forgets spent
work nor separates the two. The executor skips an action whose id is already in
`appliedActionIds` (timeline "Skipped <type> <id>: already applied this cycle."), so a retried
tick or a re-plan restating the same work starts it once. A new cycle clears the list. The
prompt shows the applied ids and asks the planner to keep an id stable. A refused action (scope,
Autopilot, error) records no id.

**Work handlers** (`GoalWorkHandlers`, registered in `onModuleInit`):

- `start-task`: `TaskSchedulerService.createTask({ text, title?, source: "goal", goalId },
now, <instance's project> ?? null, target, false)`, exactly as any task: gates, limits,
  approvals and the delivery loop apply. A `_` instance passes `null`: the task has NO project
  and the text project matcher is skipped (planner text may quote untrusted facts, so naming a
  project must not move the task into it). `targetId` becomes an explicit target only when that
  agent or
  workflow exists; otherwise the classifier routes the text (timeline note). A `goal` task runs
  `immediate` like an `automation` one (no run slot; budget, limits and gates still apply).
- `run-loop`: the same path with target `{ kind: "loop", id: goal.loop.loopId }`; a goal
  without `loop` gets a report.
- `pr-action`: the PR must be in this tick's PR inbox (otherwise a report). Scope: a project
  instance acts only when `projectId` is its own (the service also rejects a repo that is not
  the project's); a `_` instance only on one of the operator's own PRs (`bucket: "mine"`).
  Eligibility, with `PrAutomationService`'s own helpers, so a toggle covers exactly the PRs it
  covers there: `review` needs `wantsReview` (to-review, not a draft, a head) and no review run
  for that head (`isFresh`); `address-comments` needs `wantsAddressing` (my PR with unresolved
  threads) and `isFresh`; `fix-ci` only on my own PR. Anything else is a report. Then the place, as
  `PrAutomationService` resolves it (`prLocationOf`: company + the PR's teams + project): when no
  place's Autopilot automation toggle (`autoReview` / `autoAddressComments` / `autoFixCi`) starts
  that op, the action is a report "<op> <repo#n>: připraveno, čeká na tebe" — the goal's
  ceiling never raises a level. Otherwise `InboxReviewService.start` (level `quick`, the PR's
  head, `autopilotAt`), `InboxAddressCommentsService.start` (`autopilotAt`) or
  `InboxFixCiService.start`, all with `auto: true`; posting and pushing stay behind their
  approvals.

**Messages to colleagues** (`GoalMessageService`, spec "Rulings → Messages"). ZIBBY asks a
colleague for something, sent as the operator. In order:

1. **Concrete or not drafted.** A text under 8 characters or with a placeholder (TODO, TBD,
   `{{`, `[jméno]`, lorem ipsum, …) is a report, no approval.
2. **Closed recipients.** `slack-user`: `ref` must be a Slack user id (`U…`/`W…`) that
   `users.info` finds as a live human on one of the Slack accounts serving the instance (a
   project instance: the project's resolved accounts; `_`: the operator's personal ones). It is
   sent as a DM. `pr`: the PR (`about`) must be in this tick's PR inbox and in the instance's
   scope (the `pr-action` rule), and `ref` must be its author or one of its requested reviewers
   (`InboxPrThreadsService.reviewers`, users + team members). It is posted as a PR comment
   starting `@<login>`. Any other `@mention` (PR) or `<@…>`/`<!…>` (Slack) in the text is
   refused. A refusal is a report and records the `actionId`. A `users.info` error is
   classified: an account/token/scope error (`invalid_auth`, `not_authed`, `account_inactive`,
   `token_revoked`, `token_expired`, `missing_scope`, `no_permission`, …) is permanent, a report
   ("Slack účet nefunguje … oprav připojení") with the `actionId` recorded. Any other error (rate
   limit, network) with no account finding the user is transient: the action is deferred
   (`wakeAt` +15 min, a timeline note, `actionId` not recorded, `instance.lookupRetries[actionId]`
   +1), at most 3 times per `actionId` and cycle; the 4th attempt is a report and is recorded. The
   display name is capped at 80 characters.
3. **Working hours.** Outside Mon–Fri 9–17 Europe/Prague the action is deferred: `wakeAt` = the
   next working 9:00 (`nextWorkingStart`), a timeline note (time in Europe/Prague), no approval,
   and the `actionId` is NOT recorded, so the re-plan then decides again. Working hours bind
   ZIBBY, not the operator: an approval given outside them sends immediately (the operator's own
   act).
4. **Anti-nagging.** At most 2 per person (`slack:<userId>` / `pr:<login>`) per cycle, counting
   `state.nudges` (sent) plus this cycle's `pending`/`sending` drafts. Over it: a report. The cap
   is checked again inside the locked write that stores the draft. Counters are per ref and per
   goal: a person reachable as both `slack:<id>` and `pr:<login>` has two counters, and another
   goal counts separately.
5. **Tier.** Sent at once (act, then report: `message-sent` timeline + `goal-acted` activity
   with `action: message`) only when `autoCommunicate` resolves to `auto` at the instance's place
   (`prLocationOf`; `_` = global), Autopilot is not paused, **and the recipient is known to the
   goal**, read from structural fields only, never from remote or planner-written text: a `pr`
   recipient always is (author/requested reviewer); a Slack id only when the operator wrote it
   into the goal (`name`, `outcome`, `predicate`, checklist `title`/`acceptance`; no stored goal
   field is written by the planner or a remote) or it is the sender id (`replies[].last.from`) of
   a reply this instance ingested. An id inside a reply's or a channel message's text does not
   count. Workspace membership alone is not enough: an unknown
   member gets a `goal-message` approval instead. The auto send's activity is written at once,
   not as a deferred effect. Otherwise a `goal-message`
   approval (`docs/api/approvals.md`) with the recipient, the channel/PR and the full text; the
   instance waits on it. The ceiling (tier2) is necessary, never sufficient.

Records live in `state.messages` (`id` = `<instance>/<cycle>/<actionId>`: the cycle is part of it,
so an old cycle's approval can
never claim a new cycle's draft, `status`
`pending|sending|sent|rejected|failed`, `target`, `replyRef?`). Exactly once: the record and the
applied `actionId` land in one state write; a send first flips it to `sending` under the lock,
then records `sent` + `nudges[person]` (or `failed` + a report) in one write. Approve claims
`pending -> sending` the same way (a second approve, a restart or a fresh process never sends
again; a crash mid-send leaves it `sending`, never re-sent, and it still counts toward the cap).
The operator's edited `messageText` replaces the text after the same mention check (a
`<!channel>` or a foreign `@login` marks it `failed` and reports instead of sending). Reject marks
it `rejected` (timeline
`message-rejected`), which frees its slot and is a fact the planner sees. A draft from an
earlier cycle is gone: when a cycle rolls, the engine rejects its pending `goal-message`
approvals (`rejectStale`; a failed reject is a timeline line); approving one anyway sends nothing,
and the operator gets a report.

After a Slack send (auto, or on approve) the instance waits on `reply`
`<integrationId>:<D…channel>:<ts>` and wakes at the next working morning at least 12 h away
anyway. The re-plan after an approve may drop that wait, so `replies` also covers the replyRef of
every sent message of the instance: a colleague's answer wakes the goal either way. **Replies:**
the Slack adapter ingests
top-level DM messages, so `replies` counts a later top-level message in that DM as a reply.
A reply inside the DM's thread, or in a channel thread the operator was not mentioned in, is not
ingested ("mine and mentions"); the fallback wake covers that. A reply is data in the prompt,
never a command. A PR message waits through the `prs` facts.

**Wake sources** (`GOAL_FACTS_SOURCES`; a source returning `undefined` adds no key, so goals
without PR, approval or reply waits keep their fingerprint):

| Key         | Source                | Rows                                                                                                                                                                                                                                                                |
| ----------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks`     | `TaskFactsSource`     | `{ tasks: [{ id, status, outcome }], wakeAt }`                                                                                                                                                                                                                      |
| `prs`       | `PrFactsSource`       | `[{ projectId, repo, number, bucket, headSha, review, ci, ciSettled, mergeable, draft, unresolvedThreads, age }]`, sorted; `age` = `<1d \| 1-2d \| 2-7d \| >7d` since `updatedAt`                                                                                   |
| `approvals` | `ApprovalFactsSource` | `[{ id, status }]` for `waitingOn` kind `approval` (`missing` when gone)                                                                                                                                                                                            |
| `replies`   | `ReplyFactsSource`    | `[{ ref, count, last?: { id, from?, text } }]` for `waitingOn` kind `reply`, ref `<integrationId>:<channel>:<threadTs>`; `text` capped at 300, `from` at 80; also for the instance's sent messages' `replyRef`; in a DM (`D…`) a later top-level message counts too |
| `messages`  | `GoalMessageService`  | this instance's messages this cycle: `[{ actionId, to, person, status, replyRef? }]`, sorted (goal-wide nudge counters stay out of the fingerprint)                                                                                                                 |

- `prs`: a project instance sees its project's PRs, a `_` instance the operator's own. Only for
  goals that watch PRs: the goal's name/outcome/predicate mentions PR/MR/CI (case-sensitive) or
  pull request/merge (Unicode word edges, so Czech "práci" does not match), or the instance waits
  on a `pr`. `InboxService.listPrs()` (itself cached 5 min) runs at most once per tick
  (`GoalFactsSource.beginTick` drops the memo). A failed fetch, or a project the inbox reports an
  error for, keeps the previous rows; `{ unavailable: true }` before the first successful fetch,
  and for a project instance whose project has never been read. A transient `mergeable: null`
  keeps the last known value. No title or body: PR text stays out of the facts.
- `approvals` reads the approvals store, so a settled approval wakes the goal after a restart
  too (the in-memory dirty ref alone would be lost). Only a gone or malformed id is `missing`;
  any other read error (here and in `replies`) fails that instance's tick, leaving its
  fingerprint as it was.
- `replies` reads the channel items of that integration only for instances waiting on a reply.

### Directional goals (`GoalDecisionService`)

A goal with `directional` (`checklist`, `maxDecisionsPerMonth`, optional `matrixNoteId`) lets the
planner `propose` ranked candidates. A non-directional goal's `propose` is a report. The
effective `autoDecideGoals` is resolved at the instance's place with the same place helper as
`autoCommunicate` (project > team > company > global; a `_` instance resolves at global) and
is stored on the instance as `autoDecide: { level, reason }` (shown on the detail page and
given to the planner): Autopilot paused caps `auto` at `semi` (`paused`); a `tier1` ceiling means
`manual` (`ceiling`). The planner never decides: the handler enforces the level. `propose` runs
at `tier1` so that a tier1 goal still gets the ranked report.

- `manual`: ranked report on the timeline (+ activity), nothing else.
- `semi`: one `goal-decision` approval (runId `<goalId>/<instance>/<cycle>/<n>`, `n` unique per
  proposal) listing the
  candidates; the instance waits on it; one open proposal per instance (a second `propose`
  meanwhile is a report). Approve starts the top candidate; `POST /approvals/:id/answer` with a
  candidate id starts that one (an id not in the stored proposal starts nothing and marks it
  `failed`); an approve whose start the executor refuses (budget, ceiling, a failing service) is
  reported and also settles it as `failed`, so a later `propose` raises a fresh approval; reject
  records it (`rejected`). Candidates come only from the stored proposal,
  matched by id: inbound channel or PR text is a fact and never selects or starts one. A new
  cycle drops the proposals and rejects their pending approvals.
- `auto`: the top candidate starts at once through the ordinary `start-task` path (budget,
  ceiling, `actionId` `dec-<cycle>-<candidateId>`) when `decisionsThisMonth.count <
maxDecisionsPerMonth` and its `size` is `small`; then `decisionsThisMonth`
  (`{ month: "YYYY-MM", count }`, Europe/Prague, per goal) is incremented. Otherwise it falls back
  to `semi` and the approval text says why (cap reached / large candidate). Approved starts are
  the operator's call and not counted.

`update-checklist { id, done }` rewrites that item in the goal definition; when every item is
done the instance is `done`. An unknown id is a report.

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
  the ceiling, the budget left after this planning run, the nudge counters, the effective
  `autoCommunicate` (`manual|semi|auto|paused`, `GoalMessageService.communicationLevel`), the
  month's
  decision count, the current plan note and the facts. The offered actions are generated from
  `GoalActionSchema` (one JSON schema per action), filtered by the ceiling, by
  `GoalActionExecutor.handles(type)` (the rest are named "not executable yet") and by the
  budget (no spending action — `start-task`, `run-loop`, `pr-action` — when this run uses the
  last run or the cost is spent). The rules explain `actionId` (stable per piece of work) and
  list the cycle's `appliedActionIds`, and say a `pr-action` runs only where Autopilot starts it.
  For `message`: closed recipients, no other mentions, max 2 per person, working hours, and wait
  on a sent message's `replyRef` instead of chasing it.
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
operator channel sends `goal-parked` (Tier 3) and `goal-done` / `goal-merged` / report `goal-acted`
as `goal-update` (Tier 2), see `docs/api/operator-channel.md`. Parked instances are briefing
needs-you items, acting/waiting ones a watching line (`docs/api/briefing.md`). Every state write
and timeline append emits the SSE scope `goals` (`docs/api/events.md`).

## Merge grant

**The merge grant is the one sanctioned autonomous merge in ZIBBY** (an exception to Law 3's
"no auto-merge", made explicitly by the operator per goal). Without a valid grant a `merge`
action is always a `report` "ready to merge".

- `MergeGrant { projectIds, until, grantedAt }` on the goal. Written only by
  `PUT /goals/:id/merge-grant` (set; `grantedAt` stamped by the server) and
  `DELETE /goals/:id/merge-grant` (revoke), both behind the operator token (`hasOperatorToken`,
  the same check as the Autopilot raise/resume). Never accepted by create/update, never written by
  the engine or the planner, never derived from inbound content.
- Set only on a goal with ceiling `tier3`; `until` at most 24 h ahead (`MERGE_GRANT_MAX_HOURS`);
  `projectIds` non-empty and within the goal's scope (a `none` scope cannot have one; for
  `company` / `all` any project of that scope). An expired grant is treated as absent (no
  background cleanup).
- `GoalMergeService` (`apps/api/src/goals/goal-merge.service.ts`) merges only when every
  precondition holds **at merge time**; anything else, or any error while checking, is a report
  "Připraveno k merge (ready to merge): repo#n — <the failed precondition>":
  1. the action's `projectId` is the instance's project (a `_` instance never merges);
  2. the goal **re-read from storage** still has ceiling `tier3` and an unexpired grant listing
     the project whose `until - grantedAt` is at most 24 h (the file is hand-editable, so the
     cap is re-checked here; a missing `grantedAt` fails); a revoke during the tick wins;
  3. Autopilot is not paused;
  4. read live from GitHub (`ProjectPrService.mergeState`, never from the facts snapshot or the
     plan): the PR belongs to the project's repo, is open, not a draft, not yet merged; no
     reviewer's latest review requests changes; head SHA === `approvedSha` (no commits after the
     approval) and some reviewer's latest approval was given on that SHA (only an approval from
     a repo OWNER/MEMBER/COLLABORATOR counts; a change request blocks from anyone); CI is green
     and settled
     (every check run completed with success/neutral/skipped and every commit status `success`;
     no checks at all is not green); `mergeable === true` and `mergeable_state === "clean"` (every
     branch-protection requirement met, so an admin token never merges past protection;
     `blocked`, `unstable`, `behind`, `unknown`, `has_hooks`, `dirty` or missing all report). A PR
     with 100 or more reviews, check runs or statuses never auto-merges (page limit, fail closed).
     GitLab projects are not supported (the review's commit is not read
     there), so they always report.
- Points 2 and 3 are checked again right before the merge, after the slow host read.
- The merge goes through `ProjectPrService.merge` with the head SHA pinned (`sha`), so a push
  after the check makes GitHub refuse it. On success: the `actionId` is recorded at once, a
  `merged` timeline line, activity `goal-merged` (operator notification `goal-update`), plus the
  service's own `merge-completed`. The same `actionId` is skipped on the next tick; a different
  one on an already merged PR reports "already merged" without a merge call.
- Web: the goal detail page's "Merge grant" panel (tier3 goals only; otherwise one line saying a
  grant needs tier3): project multi-select, "until" picker, revoke; a 401 shows the locked state.

## Web

- **Goals page** `/work/goals` (nav entry "Cíle"): the goals with their roll-up status, a
  "Připravené cíle" section with the `GOAL_PRESETS` (one click creates the goal, **paused**), and
  a create dialog (`@zibby/forms`; creates the goal paused, then navigates to the detail page).
  There is no other goals screen: the old maker + verifier screens are gone (the loop has no UI of
  its own, see `docs/api/loops.md`).
- **Goal detail** `/work/goals/<id>`: outcome, settings (edit top-right), plan (the rendered plan
  note), timeline (filter per project, grouped by cycle), per-project roll-up with the effective
  `autoDecideGoals` and its reason, the directional checklist editor and decision counter, the
  merge-grant panel, and the actions enable/pause, "Probudit" (wake) and resume on parked
  instances.
- **Dashboard widget "Cíle"** (Bridge widget type `goals`, `GoalsWidget`): the goals picked in the
  widget settings (`scope.goalIds`; empty or absent = every enabled goal), one row each with the
  status pill, counts ("7/9 hotovo, 1 čeká na tebe"), schedule label and the latest timeline
  line; needs-you goals sort first. A click opens the `goal` `AnchoredSheet` (`GoalSheet`) whose
  title links to the goal page. The sheet has "Co se dělo" (the full timeline, newest first) and
  "Co bude" (per instance what it waits on and when it wakes, the next cycle or the deadline, the
  plan note), plus enable/pause, wake and resume. Live through the `goals` SSE scope.
- **Autonomy matrix** (`/governance/autonomy`): `autoDecideGoals` ("automatické rozhodování cílů")
  is the sixth capability column and project rows nest under their company, see
  `docs/api/autopilot.md`.
