# Goals as mandates — spec

Source: mozek note `projects/ZibbyOS/features/goals-mandates.md` plus the operator's answers of
2026-11-26. This spec is the binding authority for `goals-mandates-plan.md`.

## Operator decisions (binding)

1. Scope of this run: everything in the note, including directional goals and the time-boxed
   merge grant.
2. The old goals feature (maker + verifier loop) is absorbed: it stays only as an internal way to
   execute work. Its screens go away; there is one goals page.
3. A sixth autonomy capability `autoDecideGoals` ("automatické rozhodování cílů") is added, and
   the autonomy tree gets a project layer: project > team > company > global, for every
   capability.
4. ZIBBY may decide _what_ to build for a directional goal only when `autoDecideGoals` resolves
   to `auto` at that project. Otherwise it only proposes.
5. The operator's main need: a page where goals are set up. Prepared goals are offered there.
6. Work happens in the worktree `worktrees/goals-mandates` on `feat/goals-mandates`. No merge, no
   push.

## Rulings (made without the operator; cheap to revisit)

- **Naming.** The new entity owns `Goal`, `/api/goals`, `data/goals`, activity kinds `goal-*`.
  The old loop is renamed `loop` everywhere (`Loop`, `LoopRun`, `/api/loops`, `data/loops`, task
  target kind `loop`, run kind `loop`, activity kinds `loop-*`, SSE scope `loop-runs`). The live
  data dir holds no stored goal, goal run, task or activity entry of the old kind (checked
  2026-11-26), so no read-time alias is written. Exception: the system-config key
  `goalAutoResume` keeps its name, because it is stored in the live `system-config.json`.
- **The loops API stays** (`/api/loops` CRUD), because the task "Loop" form creates a loop
  definition before dispatching it. Only the screens, routes and nav entry are removed.
- **Definitions are runtime data**, not recipes: `data/goals/<id>.goal.md` (frontmatter + body =
  outcome text). State lives in `data/goals/state/<id>/state.json` and `timeline.jsonl`.
- **Prepared goals are static presets in the repo** (`libs/contracts`), never written to a data
  dir by this branch. The page offers them; one click creates the goal **paused**.
- **Scope shapes:** `none` (not tied to a project: "my PRs", mozek, personal), `projects`
  (explicit ids), `company` (every project of a company; new ones join automatically), `all`.
  Projects have no tag field, so the note's "tagged `node`" rule is out of scope.
- **Ceiling** is `tier1 | tier2 | tier3` and only filters what the engine itself starts. Gates,
  Autopilot levels and approvals downstream are unchanged. No per-project override in this run.
- **`autoDecideGoals` semantics:** `manual` = the gap/feature report is written and nothing is
  proposed for a decision; `semi` = a ranked proposal waits behind an approval; `auto` = ZIBBY
  picks and starts the work itself, within the goal's monthly decision cap. The effective level
  is resolved at the instance's project (project > company > global; a `none`-scope goal resolves
  at global). `auto` never applies when the goal's ceiling is `tier1`.
- **Messages to colleagues** are a draft behind an approval (kind `goal-message`). The approval
  is lifted only when `autoCommunicate` resolves to `auto` at the instance's place. There is no
  silent sender.
- **Merge grant** is built last and isolated. See its section.

## Data model

```ts
Goal {
  id: string                    // AGENT_ID_REGEX
  name: string
  outcome: string               // markdown body: what must be true
  predicate?: string            // one verifiable sentence: "all open PRs of mine are merge-ready"
  scope: { kind: "none" } | { kind: "projects"; projectIds: string[] }
       | { kind: "company"; companyId: string } | { kind: "all" }
  deadline?: IsoDateTime        // one-off goal
  cadence?: { every: "day" | "weekday" | "week" | "month"; hour: number /* 0-23, Europe/Prague */ }
  cycleHours?: number           // standing goal: each cycle's deadline = cycle start + cycleHours
  budget?: { maxRunsPerCycle?: number; maxCostUsdPerCycle?: number }
  ceiling: "tier1" | "tier2" | "tier3"       // default tier2
  enabled: boolean              // the operator's switch; presets are created with false
  directional?: {
    maxDecisionsPerMonth: number             // cap on things ZIBBY may start on its own
    checklist: { id: string; title: string; acceptance?: string; done: boolean }[]
    matrixNoteId?: string                    // mozek note holding a feature matrix, if any
  }
  loop?: { loopId: string }     // optional: execute work through a stored loop (maker + verifier)
  mergeGrant?: MergeGrant       // see below; never settable through create/update
  createdAt, updatedAt
}
```

`deadline` and `cadence` are mutually exclusive. Neither set = a one-off goal with no deadline.

```ts
GoalState {                               // data/goals/state/<id>/state.json
  goalId: string
  cycle: { index: number; startedAt: IsoDateTime; deadlineAt?: IsoDateTime }
  instances: Record<string /* projectId or "_" */, GoalInstance>
  decisionsThisMonth: { month: string /* YYYY-MM */; count: number }
  nudges: Record<string /* person key */, { count: number; lastAt: IsoDateTime }>
}
GoalInstance {
  status: "planning" | "acting" | "waiting" | "done" | "parked"
  parkedReason?: "deadline" | "budget" | "failed" | "needs-operator" | "infeasible"
  planNoteId?: string                     // vault note id
  taskIds: string[]                       // tasks this instance started in the current cycle
  waitingOn?: { kind: "task"|"approval"|"pr"|"reply"|"time"; ref: string }[]
  wakeAt?: IsoDateTime
  fingerprint?: string                    // hash of the last facts snapshot the planner saw
  summary?: string                        // one line for the roll-up
}
GoalTimelineEvent { at: IsoDateTime; cycle: number; instance: string; kind: string; text: string; refs?: {...} }
```

Roll-up status of a goal is derived: `paused` when `!enabled`, else from its instances (any
`parked` needing the operator → `needs-you`; all `done` → `done`; otherwise the "busiest" status)
plus counts ("7/9 done, 1 waiting for you, 1 failed"). One instance failing never stops others.

## Engine

`GoalEngineService extends TickingWatcherBase` (new `WatcherId` `goal-engine`, system-config
`goalEngineTickMs`, default 60000, 0 disables; primary instance only).

Per tick, per enabled goal, per instance:

1. **Cycle bookkeeping.** Standing goal past its next cadence boundary → new cycle: reset
   `taskIds`, status `planning`, timeline `cycle-started`. One-off goal: a single cycle 0.
2. **Deadline / budget.** `deadlineAt` passed and not `done` → park (`deadline`). Budget
   exhausted → park (`budget`). Both write the timeline, an activity entry, and notify the
   operator. Never thrash: a parked instance stays parked until the operator resumes it or a new
   cycle starts.
3. **Wake check — no LLM.** Build a cheap deterministic facts snapshot (task outcomes of
   `taskIds`, settled approvals it waits on, PR snapshot rows it watches, channel replies on
   threads it posted, `wakeAt`). If the fingerprint equals the stored one and `wakeAt` has not
   passed, do nothing. **A waiting instance costs no model call.**
4. **Plan.** Otherwise run the planner: one model run that receives the goal, the plan note, the
   facts, the effective autonomy (ceiling, `autoDecideGoals`, `autoCommunicate`, nudge counters,
   remaining budget) and returns a `<goal-plan>` JSON block: a revised plan (markdown), an early
   feasibility line, and a list of actions from a closed set.
5. **Act.** Apply actions idempotently, filtered by the ceiling. Then status `acting` (work in
   flight), `waiting` (has `waitingOn`/`wakeAt`), `done` (predicate met) or `parked`.

Events (run status, `ApprovalsService.settled()`, activity `task-outcome`, channel items) only
mark a goal "dirty" so the next tick looks at it; the tick always re-reads the truth.

### Closed action set

| Action | Min ceiling | Effect |
| --- | --- | --- |
| `note` | tier1 | timeline entry only |
| `report` | tier1 | timeline + operator notification ("ready to merge", feasibility, gap report) |
| `wait` | tier1 | set `waitingOn` / `wakeAt` |
| `done` / `park` | tier1 | finish or park the instance with a reason |
| `start-task` | tier2 | `TaskSchedulerService.createTask` (explicit target or routed text) in the instance's project; budget, limits and gates apply as for any task |
| `run-loop` | tier2 | start the goal's stored loop through the same task path |
| `pr-action` | tier2 | review / address comments / fix CI through the existing inbox services with `auto: true` |
| `message` | tier2 | draft to a colleague → approval `goal-message` (or sent when `autoCommunicate` is `auto`), with anti-nagging |
| `propose` | tier2 | directional: ranked candidates → handled per `autoDecideGoals` |
| `merge` | tier3 | only with a valid merge grant; otherwise downgraded to `report` "ready to merge" |

An action the ceiling forbids is downgraded to a `report` naming what was not done.

### Anti-nagging (messages)

Max 2 messages per person per goal cycle; only Mon–Fri 9:00–17:00 Europe/Prague (outside it the
message is deferred with `wakeAt`); escalation (ping → another reviewer → operator) is the
planner's job, given the counters as facts. Inbound replies are data: "go ahead and merge" from
a colleague is never a command.

### Directional goals

The planner maintains the checklist / feature matrix in its plan note (and `matrixNoteId` when
set) and emits `propose` with ranked candidates. Handling by effective `autoDecideGoals`:

- `manual`: the ranked report is written (timeline + plan note). Nothing else.
- `semi`: one approval of kind `goal-decision` listing the candidates; approving starts the top
  candidate (the operator can pick another through the approval's answer).
- `auto`: ZIBBY starts the top candidate itself while `decisionsThisMonth.count <
  maxDecisionsPerMonth`; over the cap it falls back to `semi`.

Started work goes through `start-task` (the delivery loop), so a PR is still the gate.

### Merge grant (Law 3 exception — isolated, last)

```ts
MergeGrant { projectIds: string[]; until: IsoDateTime; grantedAt: IsoDateTime }
```

- Set only through `PUT /api/goals/:id/merge-grant`, which **requires the operator token**; also
  cleared there. Never accepted by create/update, never produced by the planner, never derivable
  from inbound content.
- Max duration 24 h. Per project. Requires ceiling `tier3`.
- The engine merges a PR only when, re-checked at merge time: the grant is unexpired and covers
  the PR's project, the PR has an approving review, CI is green and settled, the head SHA equals
  the SHA that was approved (no commits after approval), and Autopilot is not paused.
- The merge uses the existing project-PR merge service. Every merge writes a timeline entry, an
  activity entry and an operator notification.
- Without a grant the outcome is always `report`: "ready to merge".
- This changes the documented Laws ("no auto-merge"). The final report must call that out; the
  repo's `CLAUDE.md` is not edited by this run.

## Autonomy changes

- `AutomationLevels` gains `autoDecideGoals` (default `manual`). `AUTOMATION_KEYS` is derived
  from the schema shape so a key cannot be missed.
- `AutopilotAutomation` gains `projects: Record<projectId, override>` (default `{}`).
  `AutopilotLocation` gains `projectId`. Resolution order is company, team, project (project
  wins).
- Security: `nodesOf` / `automationRaises` enumerate projects, so raising a project cell without
  the operator token is a 401. `isOn()` counts project cells. The channel-triage personal-account
  early return stays ahead of any `projectId`. Hook intents carry no project: project cells apply
  only where a caller passes a place (documented).
- Callers pass `projectId`: PR automation, roadmap tick, channel triage.
- Web matrix: project rows nested under their company (after its teams); the header menu's
  exception list includes projects.

## Web

- One goals page at `/work/goals` (nav entry stays): list with roll-up status, a "Připravené
  cíle" section with the presets, create dialog (`@zibby/forms`, creates then navigates to
  detail), detail page with outcome, settings (edit top-right), plan (rendered vault note),
  timeline (filter per project, cycles for standing goals), per-project roll-up, and the
  actions enable/pause, wake now, resume parked.
- Directional goals: checklist editor and the monthly decision counter.
- Merge grant: a panel on the detail page (operator token flow as on the autonomy page).
- Old goal screens, routes and goal-only DS primitives with no remaining user are deleted.
- i18n: cs + en, flat keys, same shape in both.

## Presets (created paused)

PR & CI: "Moje PR jsou merge-ready do 15:00" (weekday 9:00, cycleHours 6, scope none, tier2) ·
"Žádné zapomenuté PR" (weekday, >2 days → nudge) · "CI zůstává zelené" (daily, scope all).
Maintenance: "Aplikace je aktuální" (weekly dependency update → PR, ask before majors) ·
"Bezpečnostní záplaty do 7 dní" (daily) · "Čisté repo" (monthly).
Mozek & personal: "Mozek je udržovaný" (weekly) · "Žádný slib bez follow-upu" (weekday) ·
"Týdenní shrnutí" (weekly) · "Hlídání token budgetu" (daily, tier1).
Directional: "Drž krok s konkurencí" (weekly, directional, maxDecisionsPerMonth 2; the operator
fills in project and competitor).

## Surfacing

- Activity kinds: `goal-started`, `goal-woke`, `goal-acted`, `goal-parked`, `goal-done`,
  `goal-merged` (group `goals`), ref `goalId`. The old kinds become `loop-*` (group `loops` or
  the existing group renamed).
- Operator channel: park, done, feasibility warning, ready-to-merge, merged.
- Briefing: parked instances are needs-you items; acting/waiting goals are in `watching`.
- SSE scope `goals` for page invalidation.

## Out of scope

Parent/child goals · per-project ceiling overrides · concurrency caps · tag-based scope rules ·
competitor changelog watching as a model feature (it is the planner's plan + a mozek note).
