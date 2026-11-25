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
4. Add an account of kind `gitlab` (company-owned, or personal with no company): `host` (bare
   hostname), `streams` (`issues`, `pulls`, `ci`) and `username` (the operator's login). The
   repos come from the served projects' `gitRemote` when its host equals `host`; `config.repo` is
   rejected. The connection test is `GET /user`.

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

Recipes live outside the repo and say `gh`. For a GitLab project one note is appended after the
budgeted grounding block (both engines, `gitlab-host-note.ts`; see `memory.md`): the project is on GitLab at `<host>`
(`<path>`), use `glab` where instructions say `gh`, "PR" means merge request, pass host and path
to `-R`, and merging stays with the operator. GitHub projects, projects without a remote and runs
without a project get no note (the prompt is byte-identical).

## Known gaps

- No security alerts source and no releases source for GitLab projects; those widgets stay empty.
- No stored token: needs `glab` on PATH and a keyring login per host; expired tokens need a re-login.
- The default `merge` update of a branch always goes through an agent run; the API rebase
  (`PUT …/rebase`) is used only for an explicit `rebase` on a conflict-free MR.
- The `rebase` merge method is refused on GitLab (no merge-time equivalent).
- `REQUEST_CHANGES` = a summary note plus `unapprove` (no stable REST for "changes requested"); it
  shows as `changes-requested` only if GitLab itself reports that reviewer state. An empty one is
  refused (422).
- Re-requesting a review from someone who already is a reviewer is not possible through REST: it
  is reported as "already a reviewer, not re-requested", never as done.
- No team / CODEOWNERS-group review bucket: group owners are shown as teams of the people already
  on the MR, but there is no "requested from a group" state.
- People who only commented (never added as reviewer, never approved) are not listed as reviewers.
- No stacked-MR detection; no stacked-draft following.
- Threads have no `isOutdated` / `diffHunk` (GitLab exposes neither on a discussion).
- Review posting is not atomic: a mid-way failure leaves earlier discussions live and a retry can
  duplicate them.
- Inbox lists take the first 100 entries, the CI monitor the first 50.
- Chat turns and the direct spawners that do not use grounding (`phase-advisor`, orchestrator
  agent, slack digest, dictation) get no GitLab host note; only agent runs and workflow stages do.
- The legacy parked-approval PR path still calls `gh`.
- Gate wrapper / obfuscation gap shared with `gh`: `rtk`, `sudo`, `command`, `xargs`, `bash -c`,
  `sh -c`, `eval`, a `VAR=…` prefix, `env`, `time`, `nohup`, `exec`, `timeout`, adjacent-quote
  splitting (`gl""ab`), full-path invocations (`/opt/homebrew/bin/glab`) and shell aliases are not
  classified.
- A GraphQL merge mutation through `glab api graphql` is `ask` (an API write), not `deny` — the
  same as `gh api graphql`.
- A push option written by hand into `.git/config` (`push.pushOption`) is not seen by the gate;
  only the command line (`-o`, `--push-option`, `-c`, `--config-env`, `git config …`) is.
- `glab mr create --fill` / `--push` pushes the branch but is classified as opening an MR (notify
  tier), not as a `git push`.
- An older released ZibbyOS build skips `gitlab` integration rows and reads a `graduations.json`
  that contains a `kind: "gitlab"` row as empty (and may rewrite it). Run only the updated app
  against data that has GitLab integrations.
- Ids derived from a repo path (e.g. the CI monitor alert id) flatten `/` to `-`, so `a/b-c` and
  `a-b/c` collide.
- A `host:port` integration host never matches a git remote (the remote's host carries no port),
  so an account on such a host covers no repo.
- Recipes outside the repo still say `gh` (hence the injected note).
