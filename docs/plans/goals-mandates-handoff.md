# Goals as mandates — handoff

Branch `feat/goals-mandates` (worktree `worktrees/goals-mandates`), merge-base `8db513f8e`. Spec:
`docs/plans/goals-mandates-spec.md`, plan: `docs/plans/goals-mandates-plan.md`, reference:
`docs/api/goals.md`.

**Planned last step (done by the controller, not part of the docs task):** after the final review
the branch is integrated into `main` and a MINOR desktop release (1.4.7 -> 1.5.0) is cut and
verified. This is the operator's instruction of 2026-11-26 and supersedes the earlier "no merge,
no push" for that final step only.

## What shipped

By area, with commit ranges (exclusive start, inclusive end).

| Area | Commits | What |
| --- | --- | --- |
| Spec + plan | `8db513f8e..51f28de10` | `goals-mandates-spec.md`, `goals-mandates-plan.md` |
| Autonomy: sixth capability | `51f28de10..465eb3748` | `autoDecideGoals` in `AutomationLevels` (default `manual`); `AUTOMATION_KEYS` derived from the schema shape |
| Autonomy: project layer | `465eb3748..7beae3a66` | `projects` map in `AutopilotAutomation`, `projectId` in `AutopilotLocation`, resolution project > team > company > global; the raise check enumerates projects (token needed); PR automation, roadmap tick and channel triage pass `projectId`; the raise check fails closed on oversize trees |
| Autonomy matrix (web) | `7beae3a66..2fc81c52a` | project rows nested under their company, header-menu exceptions include projects |
| Loop rename | `2fc81c52a..e28b98861` | the old goal loop is now `loop` everywhere (`/api/loops`, `data/loops`, task/run kind `loop`, activity `loop-*`, SSE scope `loop-runs`); its screens, routes and nav entry removed; `goalAutoResume` keeps its name |
| Goal contract, storage, CRUD | `e28b98861..073399945` | `Goal` / `GoalState` / rollup schemas, 11 static `GOAL_PRESETS`, `data/goals/<id>.goal.md` + `state/<id>/`, CRUD + state + timeline + wake + resume routes |
| Goals page (web) | `073399945..f9879d2f1` | `/work/goals` list, presets, create dialog, detail screen |
| Engine core | `f9879d2f1..781f40a1d` | `GoalEngineService` (`goal-engine` watcher, `goalEngineTickMs`), cadence/cycles, deadline and budget parking, facts + fingerprint wake check, closed action set and ceiling filter, activity kinds `goal-*`, SSE scope `goals`, briefing items, operator-channel kinds |
| Planner | `781f40a1d..1c32d81ff` | one read-only model run per plan (no tools), `<goal-plan>` parser, plan note in the vault, run budget accounting, untrusted-data fencing |
| Work handlers | `1c32d81ff..46a17d0de` | `start-task`, `run-loop`, `pr-action` (mirrors Autopilot toggles), PR / approval / reply wake sources |
| Messages | `46a17d0de..48bd9011a` | `message` action: closed recipients, working hours, anti-nagging, approval kind `goal-message`, Slack send + reply wake |
| Directional goals | `48bd9011a..be5afe532` | `propose` per `autoDecideGoals` (manual / semi / auto), approval kind `goal-decision`, checklist, monthly decision cap |
| Merge grant | `be5afe532..976e7a4cc` | operator-token `PUT/DELETE /goals/:id/merge-grant`, `GoalMergeService` with the live precondition list, detail-page panel |
| Dashboard widget "Cíle" | `976e7a4cc..2da40c16d` | Bridge widget `goals`, `GoalSheet` (full log + what comes next) |
| Docs + handoff | this commit | `docs/api/goals.md` as one document, cross-links, `docs/web/overview.md`, this file |

## How to use it

- **Presets** are static data in `libs/contracts/src/goals/goal-presets.ts` (`GOAL_PRESETS`, 11
  entries in the groups PR & CI, maintenance, mozek & personal, directional). They are never
  written to a data dir by the code: the "Připravené cíle" section on `/work/goals` offers them
  and one click creates the goal **paused** (`enabled: false`). A goal made through the create
  dialog is also created paused.
- **Enable a goal:** open `/work/goals/<id>`, check the settings (scope, deadline or cadence,
  budget, ceiling — default `tier2`), then switch it on (enable/pause on the detail page or in the
  dashboard sheet). The engine ticks every `goalEngineTickMs` (default 60 s, `0` disables) on the
  primary instance. A paused goal rolls up as `paused` even with parked instances.
- **Directional goals and `autoDecideGoals`.** The sixth autonomy capability
  ("automatické rozhodování cílů", key `autoDecideGoals`) lives in the autonomy matrix
  (`/governance/autonomy`), per place: project > team > company > global (a goal with scope `none`
  resolves at global). `manual` = a ranked report only, `semi` = a `goal-decision` approval,
  `auto` = ZIBBY starts the top small candidate itself within the goal's `maxDecisionsPerMonth`
  (over the cap or a large candidate falls back to `semi`). `auto` never applies on a `tier1`
  goal or while Autopilot is paused. Raising a cell, a project cell included, needs the operator
  token.
- **Granting a merge.** Only on a goal with ceiling `tier3`: `/work/goals/<id>` -> "Merge grant"
  panel -> pick the projects (inside the goal's scope), the "until" time (at most 24 h ahead),
  save with the operator token (or `PUT /api/goals/:id/merge-grant`). Revoke with the same panel
  or `DELETE`. GitHub projects only. Without a valid grant a `merge` action is only a report
  "ready to merge". Full precondition list: `docs/api/goals.md` -> Merge grant.
- **Dashboard:** add the "Cíle" widget on the Bridge board and pick goals in its settings (none =
  every enabled goal); a row opens the goal sheet.

## Rulings

Made without the operator, cheap to revisit. Each with what it costs if it turns out wrong.

### From the spec

- **Naming.** The new entity owns `Goal`, `/api/goals`, `data/goals`, `goal-*` activity kinds; the
  old loop is renamed `loop` everywhere; `goalAutoResume` keeps its name because it is stored in
  the live `system-config.json`. No read-time alias (the live data dir holds no stored entry of
  the old kind, checked 2026-11-26). Cost if wrong: a stored old-kind entry written after that
  check would not be read.
- **The loops API stays** (`/api/loops` CRUD) because the task "Loop" form creates a loop
  definition before dispatching it; only screens, routes and nav entry are gone. Cost: a dead-ish
  API surface if the form is dropped later.
- **Definitions are runtime data** (`data/goals/<id>.goal.md`, state under `state/<id>/`), not
  recipes. Cost: goals are not versioned with the repo or the iCloud recipes.
- **Prepared goals are static presets in `libs/contracts`**, created paused on click. Cost:
  changing a preset does not update goals already created from it.
- **Scope shapes** `none | projects | company | all`; no tag-based scope (projects have no tag
  field). Cost: the note's "tagged `node`" rule needs a project tag field first.
- **Ceiling** (`tier1|tier2|tier3`) only filters what the engine itself starts; gates, Autopilot
  levels and approvals downstream are unchanged; no per-project override. Cost: no way to give one
  project a lower ceiling than the goal.
- **`autoDecideGoals` semantics** (manual = report only, semi = approval, auto = start within the
  monthly cap, resolved at the instance's project; never `auto` on tier1). Cost: a different
  reading of "auto" would change what runs unattended.
- **Messages to colleagues** are always a draft behind a `goal-message` approval, lifted only when
  `autoCommunicate` resolves to `auto` at the instance's place; no silent sender. Cost: more
  approvals than a fully autonomous sender.
- **Merge grant** built last and isolated (see the Law 3 note below).

### From the controller's ledger

- **Task 1:** a goal-only `auto` cell turning `isOn()` true is accepted, same as every other
  capability. Cost: the `zibby/*` push overlay is active when only goals are `auto`.
- **Task 2 (pre-flight):** Task 2 makes the minimal web type fix (`EMPTY_AUTOMATION` gets
  `projects: {}`) so the branch stays green; Task 3 does the UI. Cost: a few duplicate lines if
  wrong.
- **Task 5:** a disabled goal rolls up as `paused` even with parked instances — a paused goal must
  not nag the operator. Cost: a hidden parked instance until the goal is re-enabled (the detail
  table still shows it).
- **Task 5:** create/update routes take passthrough transport bodies and the handler parses
  strictly to answer 422 (ts-rest answers 400 itself), the same pattern as the mandate route;
  nothing unvalidated reaches disk. Cost: looser web body types.
- **Task 6:** goals created from the dialog are also created paused and enabled on the detail
  page — safe default under the autonomy contract. Cost: one extra click per new goal.
- **Dashboard widget (plan change, 2026-11-26):** with nothing picked the widget shows every
  enabled goal (precedent `ProjectStatusWidget`). Cost: a fuller widget than the operator may
  expect until they pick.
- **Task 7 (pre-flight):** Task 7 defines every action of the spec table in the closed union;
  executors not yet built downgrade to `report`; Task 11 adds `update-checklist` to the union.
  Cost: one schema edit later (already done).
- **Task 9:** a `_` (no-project) instance's `start-task` / `run-loop` creates a project-less task,
  never text-matched to a project — goals without a project (mozek, weekly summary) must be able
  to act, and planner text must not pick a project. Cost: such tasks cannot touch a repo; a goal
  that needs one must name projects in its scope.
- **Task 10:** in `auto` a Slack message is sent without approval only to a user id present in the
  goal definition or the instance's own channel items / PR participants; any other workspace
  member gets an approval — bounds prompt-injection exfiltration. Cost: more approvals for new
  recipients.
- **Task 10:** thread replies are not ingested (mine-and-mentions); a sent message sets a fallback
  wake (next working morning, at least 12 h away) so a goal never waits forever. Cost: a slower
  reaction to a reply.
- **Task 11:** `propose` min ceiling lowered tier2 -> tier1 so a tier1 goal still gets the ranked
  manual report; the handler forces `manual` at tier1 and every start goes through `start-task`'s
  ceiling check. Cost: nothing unless `start-task`'s ceiling check regresses.
- **Task 12:** GitLab PRs are never auto-merged under a grant (the host cannot give the approving
  review's commit SHA) — fail closed, always "ready to merge". Cost: the grant is GitHub-only
  until GitLab approval SHAs are readable.
- **Task 12:** only approvals from `OWNER` / `MEMBER` / `COLLABORATOR` count (stricter than the
  spec's "an approving review") — outsiders cannot unlock a merge. Cost: a legitimate outside
  reviewer's approval does not count.
- **Task 12:** the goal merge calls `ProjectPrService.merge` directly and skips the gate's
  "merge = never" system rule — the token-set grant is the operator's explicit exception (spec,
  Law 3 exception). This must be stated next to the `CLAUDE.md` Laws wording (see the proposal
  below). Cost: if someone expects the gate to still stop goal merges, it does not; the controls
  are the operator-token grant, its 24 h cap and the live re-check.

## Proposed `CLAUDE.md` wording — NOT applied

`CLAUDE.md` is not edited by this run. Ready to paste:

### (a) Autonomy-levels paragraph

> **Autonomy levels** refine the tiers per capability (code review, review comments,
> implementation, communication, CI fix, goal decisions) and per place — global, company, team and
> project, the most specific one winning (project > team > company > global): `manual` (the
> operator does it), `semi` / Poloautomat (ZIBBY prepares, the outcome waits for approval) or
> `auto` / Automat (the covered `ask` classes move to Tier 2, plus pushes onto ZIBBY's or the
> operator's own PR branches). For goal decisions, `auto` lets ZIBBY pick and start the work for a
> directional goal itself, within the goal's monthly decision cap. Never-rules are not affected, and
> neither is merge, except through the merge grant below. Raising a level at any place, a project
> included, or resuming ZIBBY needs the operator token; anyone in the operator chat can **pause**
> it, which stops everything new. See `docs/api/autopilot.md` and `docs/api/goals.md`.

### (b) Law 3 and the "Never" bullet

Law 3, replacing its last sentences about merge:

> 3. **No autonomous commit to the outside world** — no auto-merge, no bare push to a shared
>    branch, no auto-spend past budget. Opening a PR is the one sanctioned autonomous push (Tier-2,
>    act-then-report): it only _requests_ review. The **one sanctioned autonomous merge** is a
>    goal's **merge grant**: set by the operator with the operator token, per project, time-boxed
>    to at most 24 hours, only on a goal with the `tier3` ceiling, GitHub only. ZIBBY merges a PR
>    under it only when, re-checked live at merge time, the grant is unexpired and covers the
>    project, the PR has an approving review from a repo owner/member/collaborator on the current
>    head, CI is green and settled, the PR is `mergeable_state: clean` and Autopilot is not
>    paused; every merge is logged and reported. This path calls the project-PR merge service
>    directly and does **not** go through the gate's "merge = never" system rule — the grant is the
>    operator's explicit, token-protected exception. Without a valid grant the outcome is always
>    "ready to merge". Never-rules are not affected. An `auto` autonomy level moves the covered
>    `ask` classes to Tier 2 for its capability and place; it never grants a merge.

The "Never" bullet:

> - **Never.** Auto-merge, auto-deploy, financial transactions, credential entry, permission
>   changes, irreversible deletes. (These are the default system rules. Deploy, purchase/payment
>   and delete stay off-limits unless the operator explicitly moves that rule to another tier.
>   Merge is off-limits except through the operator-token, time-boxed merge grant on a `tier3`
>   goal, which does not pass through the gate's "merge = never" rule and is re-checked at merge
>   time.)

## Unverified live

Nothing below was exercised against real services; all of it is covered by unit and API tests with
mocks only.

- No real model planner run (the claude and opencode planner commands were checked by argv /
  init-event tests; one live claude 2.1.332 init check showed `tools: []`, but no goal was ever
  planned by a real model).
- No real Slack send, including the `im:write` scope the DM needs (`conversations.open`) — the
  live token may lack it.
- No real merge on GitHub; the precondition read (`ProjectPrService.mergeState`) was tested
  against stubbed responses.
- opencode read-only mode is verified by an argv test only.
- Playwright e2e is stale at baseline (14/16 specs red, see the memory note) and was not run; the
  navigation spec was touched twice.
- No browser check of the widget, the sheet or the goal pages (component tests only).
- Open for the final review: that the planner facts give a `projectId` and the full 40-hex head
  SHA so a valid `merge` action can actually be emitted.

## Known gaps and follow-ups

Deferred minors and notes from the ledger, grouped by area.

**Autonomy (tasks 1-3)**

- `NO_AUTOMATION` test is tautological: assert that the override schema keys equal
  `AUTOMATION_KEYS`. `AUTOMATION_KEYS` lost `readonly`. A long doc comment in
  `autopilot.schema.ts`.
- The raise-check cap of 20 000 nodes is reachable by a large real table; it fails closed (a
  tokenless lowering answers 401). Raise the cap or check per capability, and log when it trips.
- Channel triage: an unreadable integration skips the personal-account check and now also picks up
  project cells (pre-existing fail-open, one level wider). Return `{}` when the integration is
  null.
- `pr-automation.service.test.ts` uses `mkdtemp` without cleanup.
- Matrix UI: dead i18n key `autopilot.teamsCount`; the expand button says "places" for a company
  with only teams; "Projekt · " has a trailing separator when there is no company (same for
  teams); the header-menu exceptions cannot tell a project from a same-named team; no test for
  collapse hiding project rows, and the `ZibbyModeControl` test mocks projects `[]`.
- Hook intents carry no project: project cells apply only where a caller passes a place.
- `CLAUDE.md` still lists five capabilities (see the proposal above).

**Loop rename (task 4)**

- `docs/api/loops.md:132` and `loop-run.schema.ts:35` mention the obsolete `GOAL_AUTO_RESUME=1`
  env flag. The `goalAutoResume` labels (cs + en) still say "goals" and should say loops /
  smyčky.
- DS `SegmentedRing` is now unused outside the DS.
- `docs/audit/batches/api-goals.md` has the stale name (historical).
- The live `activity-view.json` has stale group keys that fall back to defaults (pre-existing).

**Contract, storage, CRUD (task 5)**

- The passthrough-body / strict-handler / 422 pattern is duplicated (goals + mandate); extract a
  helper on the third copy.
- `goal-state.store` `remove()` runs outside `withPathLock`; `deleteGoal` removes the definition
  before the state (an orphan state dir on failure).
- `timeline.jsonl` is unbounded and read whole per request (the cap is on read only).
- Wake events use the instance `*`, so an instance filter hides them.
- `null` on a non-clearable PATCH field probably answers 400 (transport) instead of 422.
- Note: `GET /goals/:id` returns a plain `Goal` (no roll-up); the roll-up is on `GET /goals` and
  `GET /goals/:id/state`.

**Goals page and forms (task 6)**

- The create dialog does not say the goal is created paused (add a one-line hint).
- The deadline is displayed in Europe/Prague but the input is read in the browser zone (the hint
  says "your time zone"); a deadline truncated to minutes is re-sent on unrelated edits.
- Delete invalidates before navigating, so the detail can flash a 404 error.
- `goals.form.timing` and `goals.form.deadline` are both "Termín".

**Engine (task 7)**

- The notification title is the English activity summary under a Czech headline (precedent of all
  events); stored operator-channel `events` lists do not get goal events (opt-in precedent).
- The briefing needs-you item for a parked goal uses `cycle.startedAt`, not the park time.
- A project returning into scope stays `done` for a one-off goal.
- `pragueParts` builds a new `Intl.DateTimeFormat` per call.
- Cost budget within one plan is a snapshot (the runs cap is the in-plan guard);
  `remainingBudget` reads the ledger every tick for idle goals with a cost cap; a stale dirty ref
  matching no instance stays in the set while any goal keeps failing.
- Note: a resumed budget-parked instance may plan but spending actions stay refused until the
  budget is raised.

**Planner (task 8)**

- Re-run / resume of a planner run returns 404 and planner run ids show as `missing` tasks — hide
  Re-run for `goal-planner`.
- `isGoalPlanNoteId` (`/^goal-.+-plan$/`) also drops operator notes named like that; check the
  frontmatter type too.
- An instance waiting over budget shows as `acting` with no activity line.
- Note: `maxRunsPerCycle: 1` means one plan, then park (documented); the project `CLAUDE.md`
  auto-loads into the tool-less planner run (bounded impact).

**Work handlers (task 9)**

- A crash between `createTask` and `recordTask` can start a task twice (stamp `actionId` on the
  task and look it up before creating).
- PR-watching goals are detected by keywords in the goal text (ponytail marker).
- `source: "goal"` / `goalId` are settable over HTTP like `automation`.
- The `mergeable` map grows for the process lifetime.
- Goal `fix-ci` checks only own PRs; Autopilot's `decideCiAutofix` also needs `headSha` + failing
  CI, triage and retry limits. The head-freshness check reads the whole task list per `pr-action`.
- Cannot-verify: `listPrs` `errors[].projectId` shape is assumed.

**Messages (task 10)**

- A message stuck in `sending` after a crash is never reported as outcome unknown.
- The nudge cap is per ref and per goal (`slack:<id>` vs `pr:<login>`, several goals) — documented
  limit.
- Mixed permanent + transient lookup errors report only the transient cause
  (`goal-message.service.ts` ~443); the message id's cycle index is read outside the store lock
  (~392).
- `goals.e2e` "wake, resume and timeline" shows a rare 401 on `POST /api/goals` (no guard on that
  route; likely a cross-process e2e collision) — treat as a known flake.

**Directional goals (task 11)**

- `ApprovalsService.answer` `goal-decision` branch is untested (tests call `decisions.resume`
  directly); the "inbound reply text cannot produce a decision" test is weak.
- The manual report goes to the timeline + activity only, not the plan note.
- A decision resume starts a task even when the instance is parked / done.
- An all-done checklist finishes only the instance that ticked the last item.
- The form sends a stale directional snapshot — it can overwrite planner-ticked `done` flags, and a
  rename drops `id` + `done`.
- The `approval.schema` comment says detail is JSON; it is plain text. The approval sheet has no
  candidate picker (the answer is API-only).
- `startTop` writes `used + 1` from a pre-start read, not inside `store.update`.
- Cannot-verify: whether the planner prompt offers `propose` / `update-checklist` to
  non-directional goals (the handler rejects them anyway).

**Merge grant (task 12)**

- FIX IN FINAL WAVE: the merge-time span check bounds only `until - grantedAt`; a hand-edited grant
  with both in the future passes. Also require `until - now <= 24 h` in
  `goal-merge.service.ts` `grantUnmet`, with a test. (Check whether the final wave landed it
  before release.)
- An approval dismissed or a change request between the check and the merge is not pinned (small
  window).
- A PR with 100 or more reviews/checks fails closed forever (documented in `docs/api/goals.md`).
- ZIBBY's own account is not excluded from the approval roll-up (safe today: an APPROVE needs an
  operator pick); guard it before any auto-approve path exists.

## Test status vs baseline

Baseline (`.superpowers/baseline-test.log`, `pnpm test` on main, 2026-11-26): 2 failed /
10978 passed — api `test/activity.e2e.test.ts` and web-components
`features/zibby/shortcut/shortcut.test.ts`.

Run once on 2026-11-26 at `2da40c16d` (plus the docs), one project at a time.

| Command | Result |
| --- | --- |
| `PATH="$PWD/node_modules/.bin:$PATH" pnpm check:types` | green (exit 0) |
| `pnpm exec vitest run --project contracts` | green |
| `pnpm exec vitest run --project api` | 394/395 files passed; 2 failed tests in `src/runner/runner-core.test.ts` (see below) |
| `pnpm exec vitest run --project web` | 6 files, 42 tests, green |
| `pnpm exec vitest run --project web-components` | 1 failed file: `features/zibby/shortcut/shortcut.test.ts` (baseline red) |
| `pnpm exec vitest run --project design-system` | "No test files found" (exit 1) — the project has no test files; not a failure |

Failures not in the baseline:

- api `src/runner/runner-core.test.ts` (2 tests, both opencode), under the full parallel api run:
  - "reads an opencode run's JSONL with the opencode formatter, cost and session extractors":
    `expected '● Shell$ ls ...' to contain '⛨ gate shell rm x → allowed'`
  - "opencode idle watchdog > does not fire while the run waits for an operator decision":
    `waitForStatus: held_... never reached awaiting-approval (now error)`
  - Re-running that file alone: PASS (48) FAIL (0). It is a load-dependent flake (timing / gate
    plugin side effect under parallel e2e) in code this branch does not touch; not a regression.
- The baseline red `test/activity.e2e.test.ts` passed in this run (the full suite is
  nondeterministic under parallel e2e); `apps/api/test/goals.e2e.test.ts` passed.
