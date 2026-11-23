# Autopilot (autonomy levels)

ZIBBY's autonomy is a table: one level per capability, per company and team.

- `manual` — ZIBBY doesn't do it; the operator handles it.
- `semi` (Poloautomat) — ZIBBY picks the work up and prepares it; the outcome waits for the
  operator's approval.
- `auto` (Automat) — ZIBBY also approves its own outcome and reports it (Tier 2). A short
  allowlist of gate `ask` classes is lifted for it; never-rules and merge are not affected.

ZIBBY itself is always on and cannot be switched off. What can be paused is its autonomy: while **paused** nothing new starts and nothing is sent.
Pending approvals and unfinished work wait. Resuming, and raising any cell (manual < semi <
auto), needs the operator token. Pausing and lowering never do, so the operator chat can pause.

Code: `apps/api/src/autopilot/`. Contract: `libs/contracts/src/autopilot/`.
Web: the header's Zibby pill shows what ZIBBY may do on its own (`Ručně` / `Poloautomat` /
`Automat` / `Smíšené`, or `Autonomie pozastavena`) and opens a menu with the global level slider and,
while paused, the "Obnovit autonomii" button (needs the operator token). The page at
`/governance/autonomy` (tab „Úrovně autonomie“) only sets levels per company and team. `ApprovalNotifier`
pops a system notification for every new approval (`approval-requested` activity event).

## State

`autopilot.json` in the data dir (`AUTOPILOT_DIR` overrides it) holds the state:

```json
{
  "paused": false,
  "since": "2026-11-19T12:00:00.000Z",
  "by": "operator",
  "automation": {
    "global": {
      "autoReview": "auto",
      "autoAddressComments": "auto",
      "autoImplement": "semi",
      "autoCommunicate": "semi",
      "autoFixCi": "manual"
    },
    "companies": { "acme": { "autoCommunicate": "auto" } },
    "teams": { "frontend": { "autoReview": "manual" } }
  }
}
```

`by` is `operator` or `chat`. A missing or malformed file counts as not paused with every cell
`manual`. A pre-redesign file (`level: off|full` with boolean toggles) is migrated on read
(`migrateLegacyAutopilotState`): `false` -> `manual`; `true` -> `auto` when the level was
`full`, else `semi`; a tree without `autoCommunicate` takes it from the stored
`scope.communication`. A legacy state without a tree starts nothing. The file is rewritten in
the new shape on the next change.

## The five capabilities

| Key                   | `semi` or `auto` starts                                              | `auto` lifts (gate class)                                                                |
| --------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `autoReview`          | PR-inbox code reviews (`PrAutomationService`)                        | `reviews`: `pr-review` and the pr-review `workflow-gate` sign-off                        |
| `autoAddressComments` | addressing review comments (`PrAutomationService`)                   | `comments`: `pr-address-comments` (fix push, thread replies), and a hook `gh.pr_comment` |
| `autoImplement`       | roadmap pickup (roadmap tick)                                        | none (opening a PR is Tier 2 anyway)                                                     |
| `autoCommunicate`     | none (channel items arrive on their own)                             | `communication`: `channel` replies (GitHub, GitLab, Jira, Slack, …)                      |
| `autoFixCi`           | PR CI triage + fix on the operator's own PRs (`PrAutomationService`) | `ci`: the `pr-fix-ci` push, and a flaky-CI rerun instead of a `pr-ci-rerun` approval     |

`companies` / `teams` are keyed by id and hold only the cells the node overrides. Precedence is
team > company > global (`resolveAutopilotLevels`; `resolveAutopilotAutomation` /
`AutopilotService.automationFor` turn it into "starts" flags, all false while paused). A global
row that is all `manual` (the pill's `Ručně`) is a master off: every company/team exception
resolves to `manual` too (`isGlobalManual`), so nothing is picked up or auto-approved and
`isOn()` is false; the exceptions stay stored and apply again once the global row is raised.
Configured automations don't go through this tree and keep running. The pill is greyed (muted
tone, sleeping orb) in `Ručně` as while paused. The gate
class follows the same tree (`AUTOPILOT_SCOPE_TOGGLE`, `AutopilotService.scope(at)`): a
`channel` reply resolves at the item's project's company, or the integration's company.
`Project.teamId` never picks the team level: several teams work in one project. Only the PR
automation applies team cells, at the PR's own teams (`docs/api/inbox.md`); the roadmap tick
and channel replies resolve at company > global. A review or address-comments task the PR
automation starts is stamped with the places it resolved at (`prReview.autopilotAt` /
`prAddressComments.autopilotAt`: one `{ companyId, teamId }` per team of the PR, or just the
company). Its approvals, the pr-review workflow sign-off and the gate check behind them
(`AutopilotContext.at`) resolve there, covered when any of the places is `auto`. Other
approvals from tasks and workflow gates (a review the operator started, say) resolve at global.
A flaky-CI rerun carries no place, so `auto` CI anywhere covers it (`scopeAnywhere`).

A hook `git.push` onto `zibby/*` is covered while the overlay is on at all (`isOn()`: not paused
and some cell anywhere is `auto`). The file is read once at boot and cached, because the gate
evaluator is synchronous. Use the API to change it: a hand edit only takes effect after a restart.

## Endpoints

| Route                | Auth                                     | Notes                                                            |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `GET /api/autopilot` | none                                     | The state plus `pendingApprovals` (the count waiting now)        |
| `PUT /api/autopilot` | operator token to resume or raise a cell | `{ paused?, automation? }`; omitted fields keep the stored value |

`automationRaises(prev, next)` compares every cell at every node (teams under every known
company) and asks for the token when any rises; pausing and lowering return `200` without it.
Setting the same state again is a no-op (the file isn't written). Slack notifications are only
sent while the overlay is on; changing the table is never pushed to Slack. The per-project
`_config.json` toggles and `Company.roadmapDefaults` are deprecated and no longer read.

The chat MCP tool `autopilot_off` pauses ZIBBY (`by: "chat"`). There is no tool that resumes it
or raises a level. The self-API also denies the `autopilot` router, so `api_call` can't reach
it either.

## What it covers

The allowlist is matched in two places, and both are hard-coded in `autopilot.service.ts`.

**Gate side** (`AUTOPILOT_COVERED_RULES`). This applies only to a **locked system rule** that
has these ids. The intent itself is also checked, so editing a rule's match can never widen
the overlay:

- `floor-gh.pr_comment` for intent `gh.pr_comment`. The hook classifies a `gh api` POST as
  this when it targets a PR review comment, a comment reply, or an issue/PR comment, with
  its fields given inline. Reviews (`/pulls/<n>/reviews`) are never `gh.pr_comment`: every
  review POST, whatever its `event`, stays `gh.api_write` (ZIBBY posts its own reviews
  server-side through the `pr-review` flow). An `--input` body (a file or `-`) can't be
  inspected, so it stays `gh.api_write` too, as do PATCH and DELETE.
- `floor-gh.api_write`, but only for intent `gh.pr_comment`. `gh.pr_comment` is a subclass
  of `gh.api_write`, so a rule on action `gh.api_write` also matches a comment. The system
  `gh.api_write` rule therefore also hits a comment, and its `ask` is lifted only for that
  comment. If the operator moved it to `deny`, or any other rule on `gh.api_write` asks or
  denies, that still wins.
- `floor-git.push` for intent `git.push`, but only onto a `zibby/<…>` branch (ZIBBY's own run
  branches), or onto the head of a PR the operator authored when the caller passes it as
  `ownedBranch` (approval side only, see below; ZIBBY opens its PRs with the operator's token,
  so those count too). The ownership is never part of `IntendedAction`, so a hook intent can't
  claim it: a hook push onto a non-`zibby/*` branch still asks. The hook names that `branch` only for a push with exactly one refspec, with
  `src:dst` and `refs/heads/` normalised (`HEAD:zibby/x` counts). These are not covered:
  several refspecs, a `:dst` delete refspec, `--all`, `--mirror`, `--tags`, `--delete`/`-d`,
  push options (`-o`/`--push-option`), `--repo`, any flag other than `-u`/`-q`/`-v`, no
  refspec at all, and every force push (`-f`, `--force*`, a `+` refspec, which is
  `git.force_push`). For those pushes the hook lists every destination in `branches`
  instead, and a branch rule (`gr-push-main`) matches if any of them is its branch.

A covered hit resolves as `notify` and carries `via: "autopilot"`. It is folded into the
floor bucket only when it is strictly stricter than what is already there. The evaluator
then picks the strictest result across the agent's own rules, the department rules and the
floor. This means another global `ask` on the same intent still wins. An agent's or
department's `ask`, `deny` or `requires_approval` also still wins: agent tightening holds.

**Approval side** (`autopilotCoversApproval`). A park site checks this right after it raises
a fresh approval. A match alone is not enough: the park site then builds the gate intent the
approval stands for (`autopilotIntentFor`: `gh.pr_comment` for a review or replies, or
`git.push` with the exact head branch) and asks `GateEvaluatorService.autopilotDecides` with an
`AutopilotContext` (`autopilotContextFor`: the approval's scope toggle, and `ownedBranch` when
the task's `ownPr` says the operator authored the PR). That
call evaluates the intent for the run's own agents and department (an agent target: that
agent; a workflow target: every phase agent and the workflow's department). It approves, with
`decidedBy: "autopilot"`, only when every evaluation resolves through the overlay
(`via: "autopilot"`). An operator, agent or department `ask`/`deny`, a department
`tierDefault: ask`, an unresolvable target or a missing intent leave the approval pending.

| Approval kind         | Covered when                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pr-review`           | action `github.pr.review`. Posted as `COMMENT`; autopilot never picks a review event                                        |
| `workflow-gate`       | it carries `suggestedReviewEvent` and the run's task carries `prReview` (a real pr-review task). Posted as `COMMENT`        |
| `pr-address-comments` | action `github.pr.comment` (replies), or a `git.push` onto a `zibby/*` head or the operator's own PR, with no open question |
| `pr-fix-ci`           | a `git.push` onto the head of the operator's own PR (`prFixCi.ownPr`)                                                       |
| `channel`             | action `channel-reply`, and the draft is autopilot-eligible (below)                                                         |

A workflow gate is never covered by its artifact name alone: a workflow whose last phase
writes `zibby-pr-review.md` but whose run has no pr-review task keeps its operator checkpoint.

**Channel replies.** A parked reply is sent by autopilot only when the tier alone parked it.
`parkOrSurface` computes an explicit eligibility flag, and the park site approves only with it.
The flag is set only when all of these hold:

- the verdict is actionable and its confidence is at least the triage floor;
- the mandate allows a reply for the integration;
- the project policy didn't force Tier 3 (`respond_as: "draft_only"`, or a VIP sender with
  `vip_escalation`);
- the reply gate (`channel-reply`, plus `send_email` for email) resolves to `allow` or
  `notify`, with no `ask` or `deny`.

A parked reply always has a concrete draft; no draft means no approval.

Everything else is not covered: merge, deploy, payments, spend past cap, deletes, force push
and rebase, `gh.api_write` other than a comment, email, operator questions, PR opening sign-off, Jira creates,
graduations, and so on.

## Guarantees

- **Overlay only.** Stored gate rules are never modified, and pausing (or lowering a cell from
  `auto`) restores the exact previous evaluation (`gate-evaluator.autopilot.test.ts`).
- **Never-rules hold.** A `deny` stays `deny`, and every non-covered `ask` stays `ask` (same test).
- **Pending stays pending.** Only park sites that raise a new approval call `approve`.
  Approvals already waiting when a cell is raised to `auto` are left alone, and the change
  notice reports how many there are.
- **Comms graduation isn't fed.** A channel reply that autopilot sends is not recorded as an
  operator decision in the graduation ledger.

## Accountability

- Every action the overlay lets through records an `autopilot-action` activity entry. Gate
  hits record the action, branch and rule. Approvals record `decidedBy: "autopilot"` on the
  record and the approval id.
- Every change (pause, resume, levels) records `autopilot-changed`. The summary names the
  classes now on `auto` and the pending count.
- Only `autopilot-action` maps to the operator-channel event `autopilot-action` (Tier 2, on by
  default, toggled in `notify.events`). A change of the table (`autopilot-changed`) stays in the
  activity log and is not pushed to Slack. An approval that autopilot decided does not also send an
  `approval-waiting` ping.
