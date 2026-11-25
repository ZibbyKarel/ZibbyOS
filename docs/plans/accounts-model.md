# Accounts model (one phase, on main)

Goal: the simplest possible management of accounts. A company has accounts (GitHub,
GitLab, Jira, Microsoft/Outlook mail, Slack …); the operator has personal accounts (Google
mail, calendar, a personal GitLab, plus the browser sign-ins KDP / MakerWorld). A project
only says **where things are** (`gitRemote`; its team's `board`). Widgets aggregate over
every account.

## Decisions (binding)

1. **The `Integration` entity IS the account.** Code name, ids, routes, on-disk dirs stay
   (`integrations/<id>.json`; ids key credentials, channel items, cursors, roadmap ids,
   approvals — never re-key, never merge). UI wording is "account" / "účet".
2. **Owner = `companyId`, or none = the operator's personal account**
   (`isPersonalAccount`). `projectId` on an integration is gone. `UpdateIntegration`
   accepts `companyId: null` to move an account to the operator.
3. **No stored repo.** `config.repo` (github/gitlab) is runtime-only poll scope the
   watchers fill in; create/update reject it. Repos come from the served projects'
   `gitRemote` (`githubRepoFor` / `gitlabRepoFor` no longer look at the owner or `config.repo`).
4. **Which accounts serve a project** (the one seam: `ResolvedProjectService.resolveIntegrations`):
   the project's effective company's accounts first, then the operator's personal accounts
   of `PROJECT_SCOPED_KINDS` (github, gitlab, jira, sentry). First wins per slot, where the
   slot is the kind — except gitlab, whose slot is `gitlab:<host>`. A personal mailbox /
   calendar / Slack is never inherited by a project.
   `inheritingProjects(account)` = the projects whose resolved set contains that account
   (so a repo is polled by exactly one account). Two accounts of one kind in one company
   are out of scope — first by id wins.
5. **Streams are per account** (unchanged field).
6. **Team `jiraProjectKey` → `board`** (same validation; `null` clears on update). It gets
   real consumers: where code needs "the Jira project key for this project", it is the
   project's team's `board`, falling back to the Jira account's `config.projectKey`.
7. **Project `integrationRouting` stays this phase** (Slack channels; Jira label/JQL rules —
   the only thing telling two projects of one board apart). Not extended, not removed.
8. **Connected services (KDP, MakerWorld) keep their schema and module.** They are simply
   listed with the operator's personal accounts in Settings.
9. **Data migration** is done: `apps/api/src/shared/migrations/accounts.ts` (pre-Nest,
   primary only, marker + backup). Project-owned → project's company, else operator;
   email/calendar → operator. Cursors moved to the per-repo slot.
10. **Deleted:** `requireExactlyOneOwner`, `requireGitRepoForProject`,
    `company-integration-migration.ts` (+ test, script, package.json entry), project-level
    integration create/detail UI, dead `NeedsAttentionPanel` / `IntegrationFormDialog`.

## Where accounts are managed (web)

- **Company detail** — the company's accounts (existing panel; wording → accounts).
- **Settings → access → "Accounts"** — the operator's personal accounts (integrations with
  no `companyId`) + the connected services list. Detail route for a personal account
  lives under settings.
- **Project detail** — read-only: which accounts serve it (resolved set), its `gitRemote`,
  the routing editor. No create, no project-owned list.
- **Team detail** — `board` field.

## Safety rules

- An account with no company (`autopilotLocation`) must never resolve to a more permissive
  autonomy than a company-less project gets today.
- Items of an account that serves no single project (personal mail/calendar) still
  surface (text-match attribution or unattributed notify-only) — never dropped, never throw.
