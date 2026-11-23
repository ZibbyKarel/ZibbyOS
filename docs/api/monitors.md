# Monitors — CI/CD status alerts (N3)

<!-- Reviewed 2026-07-29 (roadmap-sync-mine arc): the monitors changes this session
were test-fixture-only (the now-required `GitHubConfig.username`); monitor
behaviour is unchanged. This doc remains accurate. -->

A monitor watches **the state of the world** (a red build), not a
conversation — its events are alerts, never messages to reply to. The
`MonitorAdapter` seam (`apps/api/src/monitors/monitor-adapter.ts`) is
deliberately separate from `ChannelAdapter`: no `send()`, selection happens via
`wants(integration)` — a new source (Sentry) is one
`registry.register(...)` call in `MonitorsModule`, no change to the watcher or
its runtime.

## First monitor: GitHub Actions

- Opt-in through the existing GitHub integration: `config.streams` contains
  `"ci"` (the channel adapter naturally ignores this stream; same PAT, same
  credentials).
- Repo (Phase 129): `config.repo` for a project-owned integration; a company-owned
  integration without `repo` polls each inheriting project's repo, resolved from its
  `gitRemote`. Each repo has its own cursor and status sidecar keyed
  `<integrationId>--<owner>-<name>`, and its alerts/status carry the repo's first
  inheriting project as `projectId`.
- Polls `/repos/{repo}/actions/runs` (newest-first), cursor = the latest
  `created_at` (per integration × adapter, a sidecar under
  `MONITOR_EVENTS_DIR/cursors/`).
- A finished run with conclusion `failure`/`timed_out`/`startup_failure` →
  event `ci-run-failed` with a deterministic id `ci-<repo>-<runId>-<attempt>`
  (a re-poll is a dedup no-op; a workflow retry is a new occurrence). Green or
  in-progress runs are a no-op.

## GitLab CI (`gitlab-ci`)

- Opt-in: a `gitlab` integration whose `config.streams` contains `"ci"`. No stored credential — the
  watcher hands the adapter `NO_CREDENTIALS` and all access goes through `GitlabClient` (`glab api`).
- Repo handling is the GitHub one: `config.repo`, or per inheriting project repo
  (`ResolvedProjectService.gitlabRepoTargets`) with the same `<integrationId>--<path-with-dashes>` keys.
- One poll reads the default branch, the operator's open MRs (`author_username=config.username`) and
  `pipelines?order_by=updated_at&sort=desc`; cursor = newest `updated_at`, so a pipeline that finishes
  red after an earlier poll still surfaces.
- A `failed` pipeline on the default branch, or on one of those MRs (`refs/merge-requests/<iid>/head`,
  the merged-results `refs/merge-requests/<iid>/merge`, or the MR's source branch) → event
  `ci-run-failed`, id `ci-<repo, / as ->-<pipelineId>-<updated_at digits>`: a re-poll is a dedup hit,
  a retried pipeline that fails again (same id, newer `updated_at`) alerts again, like GitHub's
  `run_attempt`. Other pipelines are ignored. The status snapshot is the default branch's failed/success streak.

## Handling (tier path)

A new alert → a JSON file in `MONITOR_EVENTS_DIR` (default
`ZIBBY_DATA_DIR/monitors`), a `monitor-alert` activity entry (integrations
group), and dispatch of an investigation task through the ordinary
`TaskSchedulerService.createTask`, with `trustedProjectId` from the
integration — the classifier routes it, budget/limit guards apply, and the fix
ends up at the structural PR gate (Tier-3) like any other run. A dispatch
failure leaves the event at `new`; the next tick re-dispatches it (an alert
never silently gets lost). Heartbeat: `systemConfig.monitorTickMs` (default
5 min, `0` disables it; the test fixture pins it to `0`).

## CI health as state, not event (N4b)

Alongside alerts (the event path above), every poll also computes the
**current state of the source**: `GithubCiMonitor` looks at the WHOLE fetched
page (not the cursor-filtered slice) to determine red/green from the latest
decisive run (`success` vs. red conclusions; cancelled/in-progress runs don't
decide), and `sinceAt` marks the start of the current unbroken run of that
state. The watcher's snapshot is attributed (integrationId/projectId) and
OVERWRITES the sidecar
`MONITOR_EVENTS_DIR/status/<integrationId>--<adapterKind>.json` — the last
known state survives a restart; there is no history, no dedup.

Surfaces (anti alert-fatigue: a status line exists for as long as the state
persists and disappears on its own — a one-time notification remains the N3
alert):

- **Briefing**: a needs-you item of kind `ci-red` ("CI red since …"), only
  while it's red; turning green announces nothing, the line just disappears.
- **Web**: a chip on the project detail page (`ProjectCiStatusChip` in
  `PageHeader`) — three indicators (tone bad/ok + glyph x/check + text "CI red
  since HH:MM"), never color-only for accessibility. Renders nothing if no CI
  is being watched. Red propagates immediately (invalidated on the
  `monitor-alert` activity SSE); recovery to green is covered by the slower
  poll interval (CI status is genuinely a polled STATE — same posture as
  health/limits).

## HTTP (read-only)

```
GET /api/monitors/events          list alerts (?projectId= &state=new|handled|ignored)
GET /api/monitors/events/:id      a single alert
GET /api/monitors/status          last known CI state per source (?projectId=)
```

Both events and statuses are born only inside the API — a client can never
dev one.
