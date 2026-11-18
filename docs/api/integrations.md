# Integrations

Integrations are the configured inbound channels ZIBBY watches — Slack, email,
Jira, GitHub, Google Calendar. Each integration belongs to exactly one project
(one project = one company): configuration and credentials are CRUD over
HTTP, but the connection itself is exercised by the channel adapters
documented in `docs/api/channels.md`, not by this module.

**Department membership is derived, not stored.** An integration's only owner is
its project — it carries no `department` field. Which federation department
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
is config-only (`id`/`kind`/`projectId`/`name`/`enabled`/`config`), so a
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

`kind` itself is immutable after creation — `config` is a
`z.discriminatedUnion("kind", …)`, so changing kind without a matching config
rewrite would desync the two; `updateIntegration` returns `422` if a patch's
`config.kind` disagrees with the existing `kind`.

GitHub `repo` (Phase 129): required on a project-owned GitHub integration
(`IntegrationSchema`/`CreateIntegrationSchema` refine it next to the owner XOR, and
`updateIntegration` returns `422` for a patch that would drop it), optional on a
company-owned one, where each inheriting project's repo comes from its `gitRemote`
(`githubRepoFor` in `libs/contracts`). `pnpm migrate:company-integrations` (dry-run
by default, `--apply` writes) also merges ≥2 project-owned GitHub integrations of
one company sharing token + username into a repo-less `<companyId>-github`, but only
when every project's `gitRemote` resolves to its old `repo` and GitHub reports the
repo under that same name (a renamed repo skips the group with a reason). A company
that already owns a GitHub integration is skipped. Tokens are compared, never printed.

## GitLab (`gitlab` kind)

Config: `{ kind: "gitlab", host, repo?, streams, username }`. `host` is a bare hostname
(`gitlab.example.com`, optional `:port`); `repo` is the full project path at any nesting
depth (`group/sub/name`). There is no token: all GitLab access goes through the `glab` CLI
(`GitlabClient` in `apps/api/src/git-host`, `glab api <path> --hostname <host>`), which holds
the auth. A project-owned gitlab integration must name its `repo`; a company-owned one may omit
it, then `gitlabRepoFor` takes the project's `gitRemote` path, but only when the remote's host
equals `config.host`. `githubRepoFor` likewise only derives from a `github.com` remote.
`resolveGitHostLink` picks the gitlab link first, else the GitHub token link. A PATCH that would
leave a project-owned github **or** gitlab integration without `repo` is 422
(`a project-owned <kind> integration needs a repo`).

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
`GitlabApiError`). `--paginate` prints one merged array; nothing rewrites JSON text.

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

## Project scoping

Every integration carries a `projectId` foreign key and `createIntegration`/
`updateIntegration` both 422 on an unknown project. `listIntegrations` accepts
an optional `?projectId=` filter. There is no standalone `/integrations`
route in the web app — integrations are managed from their owning project's
detail page (see `docs/web/overview.md`'s routing section, the project
`integrations/[integrationId]` detail route); the API itself is otherwise
project-agnostic (you can still `GET /integrations` unfiltered).

## Endpoints (`/api/integrations`)

- `POST /integrations` — create (`409` on duplicate id, `422` if
  `config.kind` doesn't match `kind` or the project doesn't exist).
- `GET /integrations` — list, optionally `?projectId=` scoped.
- `GET /integrations/:id` — get one.
- `PATCH /integrations/:id` — update name/enabled/config/projectId (never
  `kind`; `422` on a kind change or an unknown reassigned project).
- `DELETE /integrations/:id` — delete; cascades the credentials file and the
  sync-state sidecar.
- `PUT /integrations/:id/credentials` — set the secret (write-only; `422` on
  a shape that doesn't match `kind`).
- `DELETE /integrations/:id/credentials` — remove the stored secret.
- `POST /integrations/:id/test` — probe the live connection and stamp status
  (`409` with no credentials configured).
