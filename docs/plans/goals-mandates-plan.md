# Goals as mandates — implementation plan

**Spec:** `docs/plans/goals-mandates-spec.md` (binding; read the sections your task names).
**Worktree:** `worktrees/goals-mandates`, branch `feat/goals-mandates`. No push, no merge.

## Global Constraints

- Contract-first: Zod schema + ts-rest route in `libs/contracts` before the implementation.
  Follow `libs/contracts/README.md`.
- TypeScript strict, no `any`, no `forwardRef`, no inline `style` in `apps/web`. Web composes DS
  primitives; hooks follow the TanStack rules in `CLAUDE.md` (one hook per file, `queries/`,
  `mutations/`, `select: selectApiResponseBody`, `getXxxQueryKey`).
- i18n: every new string in both `apps/web/i18n/messages/cs.json` and `en.json`, same key shape.
- Closed enums — when a task adds a value, update all of: `WatcherIdSchema`
  (`health.schema.ts`), the `*TickMs` system-config field, `ActivityKind` **and**
  `ACTIVITY_GROUP_OF` (`activity-view.schema.ts`, a total Record), strict `ActivityRefsSchema`,
  `ApprovalRunKindSchema`, briefing needs-you kind.
- Runtime state goes under `dataDir(...)`, written with `writeFileAtomic`; never into recipes.
  Tests must use temp dirs (the code refuses the live data root under VITEST).
- Security invariants (each needs a test where the task touches it):
  raising any autonomy cell, including a project cell, needs the operator token; a goal's
  ceiling only filters, never widens; inbound content never creates a grant, a decision or a
  command; a merge grant is set only through its own token-protected route.
- Validate incrementally: `pnpm exec prettier --write <files>`, `pnpm exec eslint --fix <files>`,
  and the related test file only (`pnpm exec vitest run <path> --project <api|contracts|web|web-components|design-system>`;
  web component tests use `--project web-components`). **Never** run `pnpm check:lint`
  (it rewrites other worktrees) or `pnpm test`.
- Commit: `pnpm self-knowledge:generate` first and stage the regenerated note if it lives in the
  repo; then `PATH="$PWD/node_modules/.bin:$PATH" git commit …`. Never `--no-verify`. If the
  hook reports self-knowledge drift, regenerate and retry the same commit.
- Pre-existing red tests are listed in `.superpowers/baseline-test.log`; do not chase them.
- Use `graphify query "<question>"` for orientation before reading source.
- Docs: a task that changes behaviour documented in `docs/api/*.md` updates that doc.

---

### Task 1: Sixth capability `autoDecideGoals`

Spec: "Autonomy changes", first bullet.

- `libs/contracts/src/autopilot/autopilot.schema.ts`: add `autoDecideGoals` (default `manual`)
  to `AutomationLevelsSchema` and `AutomationOverrideSchema`; derive `AUTOMATION_KEYS` and
  `NO_AUTOMATION` from the schema shape so a key cannot be missed. No gate scope class for it.
- Update every test that spells the full key list (contracts `autopilot.schema.test.ts`, api
  `autopilot.service.test.ts`, `test/autopilot.e2e.test.ts`, `test/operator-channel.e2e.test.ts`,
  `test/operator-inbound.e2e.test.ts`, web `autonomy.test.ts`, `AutonomyScreen.test.tsx`).
- i18n `autopilot.autoDecideGoals`: cs "Rozhodování cílů", en "Goal decisions".
- `docs/api/autopilot.md`: six capabilities; row for `autoDecideGoals` (starts nothing by itself;
  consumed by the goal engine: `semi` = proposal behind an approval, `auto` = ZIBBY decides).
- Test: an old file without the key parses with `manual`; the matrix renders a sixth chip.

### Task 2: Project layer in the autonomy tree (contracts + API)

Spec: "Autonomy changes". Security-sensitive.

- Schema: `projects: z.record(z.string(), AutomationOverrideSchema).default({})`;
  `AutopilotLocationSchema` gains optional `projectId`; `resolveAutopilotLevels` /
  `resolveAutopilotAutomation` take `AutopilotLocation` and apply company, team, project in that
  order; `migrateLegacyAutopilotState` emits `projects: {}`.
- `autopilot.service.ts`: `nodesOf` and `automationRaises` enumerate project places (a project
  place is compared with and without each company and team so no raise slips through); `isOn()`
  counts project cells.
- Callers pass `projectId`: `pr-automation.service.ts` (`locationOf`, `anyAutomationOn`, per-PR
  places), `roadmap-tick.service.ts`, `channel-triage-flow.service.ts` (**keep the
  personal-account early return before any projectId**).
- Tests: precedence project > team > company > global; a project `manual` beats a team `auto`
  for a PR place; tokenless `PUT /api/autopilot` raising a project cell → 401, lowering → 200;
  `isOn()` true with a project-only `auto`; old file without `projects` parses.
- `docs/api/autopilot.md` (+ `inbox.md`, `roadmap.md` precedence lines): project layer, and the
  note that hook intents carry no project so project cells apply only where a caller passes a
  place.

### Task 3: Project rows in the autonomy matrix (web)

- `apps/web/features/autopilot/autonomy.ts`: `ScopeKind` gains `project`; `buildScopes(companies,
  teams, projects)` nests a company's projects after its teams (projects without a company under
  global); `overrideOf` / `bucket` / `withOverride` / `effectiveByNode` / `EMPTY_AUTOMATION`
  handle `projects`. A project row inherits from its company (not from teams) — matches the
  server for a place without a team.
- `AutonomyMatrix.tsx`: project row header (icon + kind label), expand count covers teams and
  projects. `AutonomyScreen.tsx` and `ZibbyModeControl.tsx` pass the projects query result.
- i18n: `autopilot.projectKind` and any count label, cs + en.
- Tests: `autonomy.test.ts` (nesting, setLevel/inheritAll on a project, exceptionsOf lists a
  project), `AutonomyScreen.test.tsx` (toggling a project chip sends `projects.<id>`).

### Task 4: Rename the old goal loop to `loop`

Spec: "Rulings → Naming" and "The loops API stays". Mechanical but wide; several commits are fine,
each green.

- Contracts: `libs/contracts/src/goals/*` → `libs/contracts/src/loops/*` (`Loop`, `LoopRun`,
  `LoopState`, `LoopIteration`, `LoopParkedReason`, `LOOP_RUN_ARTIFACTS`, `loopsContract` at
  `/api/loops`, root key `loops`). Task target kind `goal` → `loop`, `ProposedGoal` →
  `ProposedLoop`, run kind `goal` → `loop`, run-view fields `goalId/goalParked/…` → `loop*`.
  Activity kinds `goal-dispatched/-verdict/-parked` → `loop-*`, refs `goalRunId/goalId` →
  `loopRunId/loopId`, activity-view group `goals` → `loops`. SSE scope `goal-runs` → `loop-runs`.
  **Keep** the system-config key `goalAutoResume`.
- API: `apps/api/src/goals` → `apps/api/src/loops` (`LoopRunnerService`, `LoopsStorageService`,
  `LoopsModule`, tokens `LOOPS_DIR` = `dataDir("loops")`, `LOOP_RUNS_DIR` =
  `dataDir("loops","runs")`, file ext `.loop.md`). Update every consumer: tasks (scheduler,
  runs service/controller, classifier, scheduled tasks), events, briefing, memory distiller,
  entity MCP (`loops` entity kind), operator events (a parked loop links to its run page, not
  `/work/goals/…`), chat tools label, departments, workflow-rename migration, `seed.mjs` (drop
  the stale `GOALS` seed).
- Web: `features/goals/{queries,mutations}` → `features/loops/` (only the hooks the task Loop
  form and the run panel use); `runs/components/GoalDetailPanel` → `LoopDetailPanel`; tasks
  `loop.ts` / `useTaskSubmit`; command palette loses its goal entries; i18n keys `runs.goal*` →
  `runs.loop*`, `commandPalette.*.goal` removed, `settings.activity.groups.goals` → `loops`.
- Delete: `apps/web/features/goals/screens`, `components`, `goalDraft.ts`, `goalListModel.ts`,
  `goal.ts` (if unused), `apps/web/app/(company)/work/goals/**`, the `goals` / `goalPage` i18n
  groups, the nav tab, and DS components with no remaining user (`GoalLoopCard`, `LoopDiagram`,
  `IterationGauge`, `IterationTimeline` — check each; keep what `LoopDetailPanel` uses). Update
  `e2e/navigation.spec.ts`, `tools/zc-sweep/*`, `state/config.test.ts`, `AppShell.test.tsx`.
- Docs: `docs/api/goals.md` → `docs/api/loops.md`; fix mentions in `overview/tasks/system/
  activity/events.md`, `docs/architecture.md`, `tools/docs-sync/manifest.mjs`.
- Done when: `grep -rn "GoalRunner\|goalRunId\|kind: \"goal\"" apps libs --include=*.ts*`
  (excluding worktrees, build output) has no hit, and the api / contracts / web test projects
  for the touched folders pass.

### Task 5: Goal contract, storage and CRUD API

Spec: "Data model", "Presets", "Rulings → Definitions / Prepared goals".

- `libs/contracts/src/goals/`: `goal.schema.ts` (`GoalSchema`, `CreateGoalSchema`,
  `UpdateGoalSchema` — both **strip/reject `mergeGrant`**; refine: `deadline` xor `cadence`,
  `cycleHours` only with `cadence`), `goal-state.schema.ts` (`GoalStateSchema`,
  `GoalInstanceSchema`, `GoalTimelineEventSchema`, `GoalRollupSchema`, and a pure
  `rollupGoal(goal, state)` function), `goal-presets.ts` (`GOAL_PRESETS`: the 11 presets from
  the spec as `CreateGoalInput`-shaped objects with `enabled: false`, Czech name + outcome text,
  plus a `group` field: `pr-ci | maintenance | brain | directional`), `goals.contract.ts`:
  `GET/POST /goals`, `GET/PATCH/DELETE /goals/:id`, `GET /goals/:id/state` (state + rollup),
  `GET /goals/:id/timeline?instance=&cycle=`, `POST /goals/:id/wake`,
  `POST /goals/:id/instances/:instance/resume`. `GET /goals` returns each goal with its rollup.
  Mount as `goals` in the root contract.
- `apps/api/src/goals/`: `goals.storage.service.ts` (`MarkdownEntityStore`, `GOALS_DIR` =
  `dataDir("goals")`, ext `.goal.md`, frontmatter = all fields but `outcome`),
  `goal-state.store.ts` (`data/goals/state/<id>/state.json` + append-only `timeline.jsonl`,
  per-goal `withPathLock`, fail-open on corrupt files), `goals.controller.ts`, `goals.module.ts`.
  `wake` and `resume` only mark state for now (a `dirty` flag / status back to `planning`) — the
  engine arrives in Task 7. Deleting a goal removes its state dir.
- Tests: contract tests (xor refinement, mergeGrant not accepted, presets all parse through
  `CreateGoalSchema`), storage round-trip, state store, e2e CRUD (`apps/api/test/goals.e2e.test.ts`),
  `rollupGoal` cases (paused, 7/9 done + 1 needs-you + 1 failed, all done).
- `docs/api/goals.md` (new): model, files on disk, routes.

### Task 6: Goals page (web)

Spec: "Web", "Presets". Reference grammar: `apps/web/features/automations` (list `Screen`,
create-only dialog that navigates to the detail page, `DetailScreen`). Use the design-system
skill conventions.

- Routes `app/(company)/work/goals/page.tsx`, `[id]/page.tsx`; nav tab `goals` in
  `state/config.ts` (first tab of the `work` section, as before).
- `features/goals/`: queries (`useGoalsQuery`, `useGoalQuery`, `useGoalStateQuery`,
  `useGoalTimelineQuery`), mutations (create, update, delete, wake, resume instance),
  `GoalsScreen` (list: `ListHeader`, toolbar filter by status, rows/cards with name, scope
  label, cadence/deadline label, roll-up status pill + counts, enable switch), a **"Připravené
  cíle"** section listing `GOAL_PRESETS` grouped, each with "Přidat" → creates the goal paused
  and navigates to its detail (a preset already added — same id — shows "Přidáno"),
  `GoalFormDialog` (create only; `@zibby/forms` + `CreateGoalSchema`: name, outcome, predicate,
  scope kind + project/company picker, one-off deadline or cadence + cycleHours, budget, ceiling),
  `GoalDetailScreen` (header with status + enable switch + "Probudit" + edit top-right opening
  the same form in edit mode on the detail page per the app's grammar; panels: outcome &
  settings, per-project roll-up table with resume on parked rows, plan (markdown of the plan
  note via the memory note query, empty state before the first plan), timeline grouped by cycle
  with an instance filter).
- Pure view-model file `goalView.ts` (scope label, schedule label, status tone) with tests.
- i18n group `goals` (cs + en). Command palette: goal entries → `/work/goals/<id>`.
- Tests: `goalView.test.ts`, `GoalsScreen.test.tsx` (lists goals, adds a preset → create called
  with `enabled: false`), `GoalDetailScreen.test.tsx` (roll-up rows, resume calls the mutation),
  `GoalFormDialog.test.tsx` (deadline/cadence exclusivity). Update `e2e/navigation.spec.ts`.

### Task 7: Goal engine core

Spec: "Engine" steps 1–3 and 5, "Surfacing". The planner is an injected interface here; Task 8
implements it.

- Contracts: `WatcherId` `goal-engine`; system-config `goalEngineTickMs` (default 60000);
  activity kinds `goal-started | goal-woke | goal-acted | goal-parked | goal-done | goal-merged`
  (group `goals`), ref `goalId`; SSE scope `goals`; closed `GoalActionSchema` (discriminated
  union per the spec's action table) and `GoalPlanSchema { plan: string; feasibility?: string;
  actions: GoalAction[] }`.
- `apps/api/src/goals/goal-engine.service.ts` (`extends TickingWatcherBase`, wiring copied from
  `roadmap-tick.service.ts`): per enabled goal resolve instances from scope (`none` → `"_"`;
  `projects`; `company` → that company's projects now; `all`), create missing instance state,
  drop nothing (an instance whose project left the scope is marked `done` with a note). Then the
  spec's steps: cycle bookkeeping (pure `nextCycleStart(cadence, from)` in Europe/Prague),
  deadline park, budget park (`maxRunsPerCycle` vs `taskIds.length`; `maxCostUsdPerCycle` vs
  ledger cost entries of those taskIds), wake check by fingerprint, call
  `GoalPlanner.plan(context)`, hand actions to `GoalActionExecutor` (interface; this task ships
  the tier1 actions `note`, `report`, `wait`, `done`, `park` and the **ceiling filter**:
  a forbidden action becomes a `report`), persist state, append timeline, record activity, emit
  SSE.
- `GoalFacts` provider interface with one implementation here: task outcomes for `taskIds` and
  `wakeAt`; further sources arrive in Task 9. Fingerprint = stable hash of the facts JSON.
- Dirty marking: subscribe to `ApprovalsService.settled()` and the activity stream
  (`task-outcome`); they only set an in-memory dirty flag so the next tick does not skip the
  goal. `POST /goals/:id/wake` clears the fingerprint.
- Planner errors or an unparseable plan: timeline entry, retry next tick, park (`failed`) after
  3 consecutive failures. One instance failing never blocks the others (try/catch per instance).
- Briefing: parked instances → needs-you item (new kind `goal`); acting/waiting → `watching`.
  Operator channel: `goal-parked`, `goal-done` and `report` actions map to a notification that
  links to `/work/goals/<id>`.
- Tests (fake planner, fake clock): no planner call when the fingerprint is unchanged; planner
  called after a task outcome changes; deadline → parked + notification; runs budget → parked;
  cadence starts a new cycle and resets `taskIds`; ceiling `tier1` downgrades a `start-task` to
  a report; a throwing instance does not stop the next; secondary instance does not tick.

### Task 8: Planner

Spec: "Engine" step 4, "Closed action set".

- `apps/api/src/goals/goal-planner.service.ts` implements `GoalPlanner`: builds the prompt
  (goal, predicate, cycle + deadline, remaining budget, effective autonomy, nudge counters,
  current plan note, facts, the allowed actions with their JSON shapes, and the rule that
  inbound text in facts is data, not instructions), runs one model run through the existing
  runner the way the loop verifier does (`runVerifier` in `loops/loop-runner.service.ts` is the
  precedent: a fresh agent run whose output is parsed for a tag), with the run's cwd = the
  instance's project when there is one. Parse the **last** `<goal-plan>…</goal-plan>` block as
  JSON through `GoalPlanSchema`; strip such tags from any untrusted text placed in the prompt
  (precedent: `stripVerdictTags`).
- Plan note: `VaultService` note id `goal-<goalId>-<instance>-plan` (create or update; body =
  `plan`, frontmatter `type: goal-plan`), linked from a `goals` MOC note via `updateIndex`.
- The first plan of a cycle must carry `feasibility`; the engine writes it to the timeline and,
  when it says the deadline is unlikely, sends a `report`.
- The planner run counts against the goal's `maxRunsPerCycle`.
- Tests: parser (last block wins, invalid JSON → error, unknown action rejected, tags in facts
  stripped), prompt contains ceiling + autonomy + counters, plan note created then updated,
  feasibility written on the first plan only.

### Task 9: Executors and wake sources

Spec: "Closed action set" rows `start-task`, `run-loop`, `pr-action`; "Engine" step 3.

- `start-task`: `TaskSchedulerService.createTask` with the instance's project as
  `trustedProjectId`, optional explicit target, new task source `goal` (contracts enum; treated
  like `automation` for immediacy), and a `goalId` stamp on the task so the run list can link
  back. Record the taskId in `taskIds`; idempotency key per action (`actionId` from the planner,
  stored in state) so a retried tick never starts it twice.
- `run-loop`: same path with target `{ kind: "loop", id: goal.loop.loopId }`; rejected with a
  report when the goal has no `loop`.
- `pr-action` `{ op: "review" | "address-comments" | "fix-ci", projectId, repo, number }`:
  `InboxReviewService` / `InboxAddressCommentsService` / `InboxFixCiService` `.start(…, { auto:
  true, autopilotAt: [place] })`; out-of-scope errors become a report.
- Facts sources: PR snapshot rows from `InboxService.listPrs()` for the instance's scope
  (`none` scope = the operator's own PRs) reduced to `{repo, number, headSha, review, ci,
  ciSettled, mergeable, draft, unresolvedThreads, updatedAt-age bucket}`; settled approvals the
  instance waits on; channel replies on threads recorded in `waitingOn`. All cheap, no model.
- Tests: start-task is idempotent across two ticks; task source/goal stamp set; pr-action calls
  the right service with `auto: true`; a PR review flipping to approved changes the fingerprint;
  an unchanged PR list does not.

### Task 10: Messages to colleagues

Spec: "Closed action set" row `message`, "Anti-nagging", "Rulings → Messages".

- Approval kind `goal-message` (contracts + registered `ResumableRunner` in the goals module).
  `message` action `{ to: { kind: "slack-user" | "pr", ref }, text, about?: {repo, number} }`.
  Find the existing outbound primitives first (Slack adapter / comms / `gh pr comment` paths);
  add a minimal `postMessage` to the Slack adapter only if no proactive send exists. A `pr`
  recipient posts a PR comment mentioning the reviewer through the existing GitHub/GitLab path.
- Flow: draft → approval with a message preview (`detail.preview`), unless `autoCommunicate`
  resolves to `auto` at the instance's place and Autopilot is not paused — then send and record
  (Tier 2: timeline + activity). Approve → send; reject → timeline entry, planner sees it as a
  fact.
- Anti-nagging enforced in the executor, not trusted to the planner: max 2 per person per cycle
  (`state.nudges`), Mon–Fri 9–17 Europe/Prague else defer via `wakeAt`; over the cap → report
  to the operator instead.
- A sent Slack message records `{channel, ts}` in `waitingOn` (`reply`) so a reply wakes the
  goal; reply text reaches the planner as quoted data.
- Tests: semi → approval created, nothing sent; auto → sent without approval; paused Autopilot →
  approval; third nudge → report; 18:00 → deferred to next working morning; approve resumes and
  sends once.

### Task 11: Directional goals and `autoDecideGoals`

Spec: "Directional goals", "Rulings → autoDecideGoals semantics".

- Engine: `propose` action `{ candidates: { id, title, why, size: "small" | "large", task: string }[] }`
  (ranked). Effective level = `AutopilotService` levels at `{ projectId, companyId }` of the
  instance (`{}` for `"_"`), forced to at most `semi` when Autopilot is paused, and to `manual`
  semantics for decisions when the ceiling is `tier1`.
  - `manual`: write the ranked report (timeline + plan note). No approval, no task.
  - `semi`: approval kind `goal-decision` listing candidates; approve starts the top one; an
    `answer` naming a candidate id starts that one; reject is recorded.
  - `auto`: start the top candidate if `decisionsThisMonth.count < maxDecisionsPerMonth` **and**
    its size is `small`; otherwise fall back to `semi`. Count resets per calendar month.
  - A non-directional goal emitting `propose` → report.
- `update-checklist` action `{ id, done }` lets the planner tick checklist items it verified;
  the goal is `done` when every item is done.
- Web: checklist editor + `maxDecisionsPerMonth` + matrix note field in the form (directional
  toggle), decision counter and effective-autonomy line ("Rozhoduje sám / Jen navrhuje — proč")
  on the detail page.
- Tests: the three levels; project-level `auto` beats company `semi`; cap reached → approval;
  large candidate under `auto` → approval; `none` scope resolves at global; tier1 ceiling never
  starts anything; inbound reply text cannot produce a decision.

### Task 12: Merge grant

Spec: "Merge grant". Security-sensitive; isolated.

- Contracts: `MergeGrantSchema`; `PUT /goals/:id/merge-grant` (body `{ projectIds, until }`) and
  `DELETE` — operator token required (use the same guard the autopilot raise uses); `until` at
  most 24 h ahead; goal must have ceiling `tier3`. Create/update schemas still refuse the field.
- Engine `merge` action `{ projectId, repo, number, approvedSha }`: executed only if, re-read at
  merge time, the grant is unexpired and lists the project, the PR is approved, CI green and
  settled, head SHA === `approvedSha` === the SHA the approving review was given on, the PR is
  mergeable, Autopilot not paused. Use the existing project-PR merge service
  (`projects/project-pr.service.ts`). Otherwise → `report` "ready to merge" with the failed
  precondition. Success → timeline, activity `goal-merged`, operator notification.
- Web: merge-grant panel on the detail page (projects multi-select, "until" picker, revoke;
  token-locked handling like `useSaveAutomation`).
- Tests: tokenless PUT → 401; >24 h → 422; tier2 goal → 422; create/update with `mergeGrant` →
  field ignored/rejected; expired grant → report; project not in grant → report; commit after
  approval → report; paused → report; happy path merges once (idempotent on the next tick).
- `docs/api/goals.md`: the grant, its preconditions, and that it is the one sanctioned
  autonomous merge.

### Task 13: Docs and handoff

- `docs/api/goals.md` complete (engine, actions, autonomy, surfacing), `docs/api/autopilot.md`
  cross-link, `docs/api/briefing.md` / `operator-channel.md` / `activity.md` / `events.md` /
  `health.md` / `system.md` for the new kinds and settings.
- `docs/plans/goals-mandates-handoff.md`: what shipped, rulings from the spec, what is unverified
  live (no real model run, Slack send, or merge was exercised), the proposed `CLAUDE.md` wording
  for the autonomy section and Law 3 (not applied), follow-ups.
- Run once here: `pnpm check:types`, and the api / contracts / web / web-components /
  design-system test projects; compare failures with `.superpowers/baseline-test.log`.
