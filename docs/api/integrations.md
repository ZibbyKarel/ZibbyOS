# Integrations

Integrations are the configured inbound channels ZIBBY watches — Slack, email,
Jira, GitHub, GitLab, Google Calendar. An integration IS an **account**: an identity
plus its credential and streams, owned by a company or by the operator (a personal
account — no `companyId`, see `isPersonalAccount`). The entity, ids, routes and on-disk
dirs keep the name "integration"; the UI says "account". A project never owns one — it
only says where things are (`gitRemote`, its team's `board`). Configuration and credentials are CRUD over
HTTP, but the connection itself is exercised by the channel adapters
documented in `docs/api/channels.md`, not by this module.

**Department membership is derived, not stored.** An integration's only owner is
its company (or the operator) — it carries no `department` field. Which federation department
"has" it follows from what it does: **ops** (the heartbeat watcher) lists every
integration; **comms** (the outward voice) lists the ones with `mandate.reply`
on. Both fall out of `DepartmentsService.roster()` over the integration list ×
the mandate — see `docs/api/departments.md`. The per-integration autonomy levers
(`dispatch` / `reply`) live in the mandate (`docs/api/mandate` behaviour, edited
either in Settings → Mandate or on the integration detail page), never on the
integration entity.

## Pieces

| Piece                | File                                                        | Role                                                                                                                |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Schema               | `libs/contracts/src/integrations/integration.schema.ts`     | `IntegrationSchema`, the per-kind `*ConfigSchema` discriminated union, `CredentialsInputSchema`, `TestResultSchema` |
| Contract             | `libs/contracts/src/integrations/integrations.contract.ts`  | `integrationsContract` — CRUD + credentials sub-resource + connection test                                          |
| Storage              | `apps/api/src/integrations/integrations.storage.service.ts` | `IntegrationsStorageService` — one `<id>.json` per integration                                                      |
| Credentials store    | `apps/api/src/integrations/credentials.store.ts`            | `CredentialsStore` — one gitignored `<id>.json` per integration, write-only over HTTP                               |
| Credential kind rule | `apps/api/src/integrations/credential-kind.ts`              | `credentialMatchesKind` — which credential shape a kind expects                                                     |
| Connection tester    | `apps/api/src/integrations/connection-tester.ts`            | `ConnectionTester` seam, bound to the channels `AdapterRegistry`                                                    |
| Controller           | `apps/api/src/integrations/integrations.controller.ts`      | Implements the contract                                                                                             |

## The credential model

Credentials are kept out of the committed integration entity entirely.
`IntegrationsStorageService.serialize()` strips `hasCredentials` /
`status` / `lastSyncAt` / `lastError` before writing — the on-disk entity file
is config-only (`id`/`kind`/`companyId`/`name`/`enabled`/`config`), so a
watcher tick or a credential swap never touches a git-tracked file. Two things
live in a separate, gitignored place instead:

- **Volatile connection health** (`status`/`lastSyncAt`/`lastError`) — stamped
  by the watcher or by a connection test into a sidecar
  (`<stateDir>/<id>.json`) and re-attached at read time.
- **The secret itself** — `CredentialsStore` writes one `<id>.json` per
  integration under a separate gitignored directory. It is write-only over
  HTTP: the API only ever exposes a computed `hasCredentials: boolean` on the
  entity, never the credential value, and the store does no logging at all so
  a token can't leak through a debug line.

`CredentialsInputSchema` is a closed union of exactly two shapes —
`{ token }` or `{ password }` — and `credential-kind.ts` enforces which one an
integration's `kind` expects:

```ts
credentialMatchesKind(kind, creds); // kind === "email" ? "password" in creds : "token" in creds
```

Email authenticates with a `password`; Slack, Jira, GitHub, and Calendar all
carry a `token` (for Jira this is a Basic `email:token` pair; for Calendar it's
the service-account JSON key). `setCredentials` rejects a mismatched shape
with `422` before it ever reaches the store.

### Creating a Jira issue (`createJiraIssue`)

`apps/api/src/integrations/jira-client.ts` also writes: `createJiraIssue(fetch, baseUrl, auth, spec)`
does `POST /rest/api/3/issue` with `project.key`, `issuetype.name` (default `Task`), `summary`, a
minimal ADF `description` (one paragraph per blank-line block), optional `labels` / `parent` /
`assignee`. `assignee: "operator"` resolves to the token's own account via `GET /rest/api/3/myself`;
any other value is an accountId. Extra `fields` (team, components, …) are merged in; on a `400` the
create is retried once without them and the result carries a `note`. Used by the PR follow-up filer
(`InboxAddressCommentsService.completeFollowUps`, see `./inbox.md`).

`kind` itself is immutable after creation — `config` is a
`z.discriminatedUnion("kind", …)`, so changing kind without a matching config
rewrite would desync the two; `updateIntegration` returns `422` if a patch's
`config.kind` disagrees with the existing `kind`.

## Ownership and which accounts serve a project

- **Owner** = `companyId`, or none for the operator's personal account.
  `PATCH` accepts `companyId: null` to move an account to the operator. The `id` is never
  re-keyed (it keys credentials, channel items, cursors, roadmap ids, approvals).
- **Which accounts serve a project** (`ResolvedProjectService.resolveIntegrations`): the
  project's effective company's accounts first, then the operator's personal accounts of
  `PROJECT_SCOPED_KINDS` (github, gitlab, jira, sentry). First wins per kind; gitlab is one per
  host (`gitlab:<host>`). A personal mailbox, calendar or Slack login is never inherited by a
  project. Two accounts of one kind in one company are out of scope (first by id wins).
- **Repos** are never stored. `config.repo` (github/gitlab) is the watcher's runtime poll scope
  only; create (and update) reject it with `422`. The covered repos always come from the served
  projects' `gitRemote`: `githubRepoFor` (host must be github.com, lowercased `owner/name`) and
  `gitlabRepoFor` (the remote's host must equal `config.host`, path kept as-is, must pass
  `isGitlabShape`). Both ignore the owner.
- **Boot-time data migration** `apps/api/src/shared/migrations/accounts.ts` (runs before Nest,
  primary only, idempotent): backs up `integrations/`, `_projects.json` and `_teams.json` to
  `.accounts-migration-backup`, moves project-owned accounts to the project's company (mailbox /
  calendar, or a project without a company, to the operator), drops `config.repo` (seeding the
  project's `gitRemote` when missing, moving poll cursors to the per-repo slot), renames a team's
  `jiraProjectKey` to `board`, then writes the marker `.accounts-migration.done` last.

## GitLab (`gitlab` kind)

Config: `{ kind: "gitlab", host, streams, username }`. `host` is a bare hostname
(`gitlab.example.com`, optional `:port`). There is no token: all GitLab access goes through the `glab` CLI
(`GitlabClient` in `apps/api/src/git-host`, `glab api <path> --hostname <host>`), which holds
the auth. The repo is derived per project by `gitlabRepoFor` from its `gitRemote`, only when the
remote's host equals `config.host`; `githubRepoFor` likewise only derives from a `github.com` remote.
`resolveGitHostLink` picks the gitlab link first, else the GitHub token link. A `config.repo` in a
create or update body is `422`.

**Shape validation.** `isGitlabShape(host, repo)` (`@zibby/contracts`, next to
`GITLAB_HOST_SHAPE` / `GITLAB_REPO_SHAPE`, the regexes the schema and the web form use) is the
single check that a host is a bare hostname (optional `:port`) and a path is
`segment(/segment)+` of `[\w.-]`. `gitlabRepoFor` returns `null` for anything that fails it, so
every producer of a GitLab link or poll target inherits the check (`resolveGitlabLink`,
`gitlabRepoTargets` → channel and monitor watchers, the inbox's assigned-issues list); the
source-link backfill checks the item's own channel path the same way. Files on disk can be
edited past the schema, and the path ends up in prompts, `-R` arguments and URLs.

**No stored credential.** `needsStoredCredential(kind)` (`integrations/credential-kind.ts`)
is the single check for "this kind keeps a secret": false only for `gitlab`. For it
`PUT /integrations/:id/credentials` is 422 (any payload), `hasCredentials` is always `true`,
the connection test and the channel watcher run without a credentials file (the adapter is
handed `NO_CREDENTIALS`, which it ignores), and the web form has no secret field.

**Connection test.** `GET /user` through `GitlabClient` on `config.host`: ok when the
returned `username` is present and equals `config.username` (case-insensitive); a different
login is a failed test naming both; glab missing, not logged in (401), a 404 or the host
unreachable is a failed test naming the host and `glab auth login --hostname <host>` (once — a
401 already carries the hint from `GitlabClient`).

**glab errors.** `GitlabClient` reads the HTTP status from glab's stderr, which comes in two
formats: `glab: 404 Project Not Found (HTTP 404)` and, for an `{"error":…}` body, just
`glab: HTTP 404`. A 401 message gets the login hint appended (run `glab auth login --hostname <host>`);
a missing binary is `glab is not installed or not on PATH`; a killed/timed-out call is
`glab timed out after 60 s`; exit 0 with non-JSON stdout is `glab returned non-JSON output` (all
`GitlabApiError`). Paginated calls run `--paginate --output ndjson` (one item per line across all pages; plain
`--paginate` prints one array per page back to back, which is not JSON); nothing rewrites JSON text.

**`git-host/` module** (`apps/api/src/git-host/`, `GitHostModule`): `GitlabClient` (`api`, `raw`,
`projectPath`; every GitLab call is a `glab api` through an injectable exec), `resolveGitHostLink`
(project -> `{ kind: "github" | "gitlab", repo, … }`, gitlab first) and `git-host-url.ts`
(`prWebUrl`, `issueWebUrl`, `parsePrUrl`, `parsePrNumber`). The `gitlab` kind is the only
credential-less integration kind. One git host per project. See `gitlab.md` for setup and gaps.

## Connection testing

`POST /integrations/:id/test` calls the `ConnectionTester` seam (bound to the
channels `AdapterRegistry`, so the real adapter — or the fake one under
`CHANNEL_FAKE_DIR` in tests — does the actual probe) and stamps the result
onto the sync-state sidecar: `connected` + `lastSyncAt` on success, `error` +
`lastError` on failure. It returns `409` if no credentials are configured yet
— there is nothing to test.

The GitHub probe (`GET /user`) also reads the `github-authentication-token-expiration`
response header into `tokenExpiresAt` (on the `TestResult` and stamped onto the
sidecar): an ISO date, `null` when the header is absent (the token never expires),
or absent when unknown. The watcher's GitHub poll captures the same header from its
main search/list call on every heartbeat, so the value appears without a manual
test. A stamp that doesn't carry it (failed test, first poll) keeps the previous value. The web card and detail page render it as
"NO EXPIRATION DATE" / "expires in N days" / "token expired".

## Ownership scoping

`createIntegration`/`updateIntegration` 422 on an unknown `companyId`; omit it for a personal
account. In the web app accounts are managed on the company detail page and, for the operator's
personal accounts, in Settings → Accounts (see `docs/web/overview.md`); there is no standalone
`/integrations` route and no project-level account UI.

## Endpoints (`/api/integrations`)

- `POST /integrations` — create (`409` on duplicate id, `422` if
  `config.kind` doesn't match `kind`, `config.repo` is set or the company doesn't exist).
- `GET /integrations` — list.
- `GET /integrations/:id` — get one.
- `PATCH /integrations/:id` — update name/enabled/config/companyId (`null` = personal;
  never `kind`; `422` on a kind change, a `config.repo` or an unknown company).
- `DELETE /integrations/:id` — delete; cascades the credentials file and the
  sync-state sidecar.
- `PUT /integrations/:id/credentials` — set the secret (write-only; `422` on
  a shape that doesn't match `kind`).
- `DELETE /integrations/:id/credentials` — remove the stored secret.
- `POST /integrations/:id/test` — probe the live connection and stamp status
  (`409` with no credentials configured).
