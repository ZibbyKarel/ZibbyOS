# GitLab

GitLab is a supported git host alongside GitHub. A project is on exactly one host: when its
link resolves to GitLab, GitLab is used everywhere and its GitHub PRs are not listed.

## Setup

There is no stored token. Every call goes through the `glab` CLI (`GitlabClient`,
`glab api <path> --hostname <host>`), so:

1. Install `glab` and put it on the API's `PATH`.
2. Log in once per host: `glab auth login --hostname gitlab.example.com`. The login lives in
   glab's keyring, so a headless host without one is unsupported.
3. Personal access tokens expire. When glab starts failing with 401, log in again.
4. Add an integration of kind `gitlab` (project or company owned): `host` (bare hostname),
   `repo` (full path, e.g. `group/sub/project`; company-owned may omit it and use the project's
   `gitRemote` when its host equals `host`), `streams` (`issues`, `pulls`, `ci`) and `username`
   (the operator's login). The connection test is `GET /user`.

## What maps to what

| Concept          | GitHub                  | GitLab                                      |
| ---------------- | ----------------------- | ------------------------------------------- |
| PR               | `pulls/:n`              | `projects/:id/merge_requests/:iid` (`!iid`) |
| Review threads   | GraphQL `reviewThreads` | `discussions` (resolvable ones)             |
| Approve          | review `APPROVE`        | `POST approve` / `unapprove`                |
| CI               | check-runs / actions    | pipelines, jobs, job traces                 |
| Rerun failed     | `rerun-failed-jobs`     | `POST pipelines/:id/retry`                  |
| Channel mentions | search `mentions:`      | the operator's pending todos                |

Where: inbox MRs and assigned issues (`inbox.md`), CI monitor and project CI (`monitors.md`,
`project-ci.md`), the channel adapter (`channels.md`), review, address-comments, rebase, fix-ci
(`inbox.md`), the gate classification of `glab` (`gates.md`: `glab mr merge` and `…/merge` API
writes are denied, `glab mr create` notifies, other writes ask) and the `git-host/` module
(`integrations.md`).

## Agent runs

Recipes live outside the repo and say `gh`. For a GitLab project the grounding block gets one
injected note (both engines, `gitlab-host-note.ts`): the project is on GitLab at `<host>`
(`<path>`), use `glab` where instructions say `gh`, "PR" means merge request, pass host and path
to `-R`, and merging stays with the operator. GitHub projects, projects without a remote and runs
without a project get no note (the prompt is byte-identical).

## Known gaps

- No security alerts source and no releases source for GitLab projects; those widgets stay empty.
- No stored token: needs `glab` on PATH and a keyring login per host; expired tokens need a re-login.
- The default `merge` update of a branch always goes through an agent run; the API rebase
  (`PUT …/rebase`) is used only for an explicit `rebase` on a conflict-free MR.
- The `rebase` merge method is refused on GitLab (no merge-time equivalent).
- `REQUEST_CHANGES` = a summary note plus `unapprove` (no stable REST for "changes requested").
- No stacked-MR detection; no stacked-draft following.
- Threads have no `isOutdated` / `diffHunk` (GitLab exposes neither on a discussion).
- Review posting is not atomic: a mid-way failure leaves earlier discussions live and a retry can
  duplicate them.
- Lists take the first 100 entries.
- The legacy parked-approval PR path still calls `gh`.
- Gate wrapper gap shared with `gh`: `rtk`, `env`, `sudo`, `command` and full-path invocations
  (`/opt/homebrew/bin/glab`) are not classified.
- Recipes outside the repo still say `gh` (hence the injected note).
