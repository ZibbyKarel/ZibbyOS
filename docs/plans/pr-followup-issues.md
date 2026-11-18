# PR review follow-up issues

Status: implementing (2026-11-18). Branch `feat/pr-followup-issues`.

## Problem

In the `pr-address-comments` workflow a reviewer often asks for a follow-up ("let's do that in a
separate ticket"). The reply phase answers "I'll create a follow-up", but nothing is filed — the
operator never sees it.

## Flow

1. **address** phase: a thread where the reviewer asks for (or agrees to) a follow-up gets the new
   outcome `followup: <what is to be done + what was agreed in the thread, one line>` — e.g. who
   handles it ("the PR author takes it"), the team/board it goes to, labels. A `followup` thread is
   handled (it does not make the report `partial` on its own), but **any `followup` keeps the push
   gate** like `question` does: the issue is a new outward write the click did not authorise.
2. **reply** phase: for a `followup` thread the draft body contains the placeholder `{{ISSUE}}`
   (e.g. `"Makes sense, follow-up: {{ISSUE}}"`) and the entry carries
   `"followUp": "<brief for the issue: what, why, agreed assignee/team/labels>"`. `resolve: true`
   is allowed on a `followup` thread.
3. **approval** (the existing `pr-address-comments` approval, one decision): the card highlights
   every reply with a `followUp` ("Follow-up issue will be created") and lets the operator edit the
   brief next to the reply body. Clearing the brief = no issue for that thread.
4. **after approve + push** (`InboxAddressCommentsService.push`): when at least one approved reply
   has a non-empty `followUp`, ZIBBY starts the **follow-up filer** run (workflow
   `pr-file-followups`, one agent phase) and stops; `postFollowUp` waits for it. No follow-ups →
   the phase is skipped and `postFollowUp` runs exactly as today.
5. **filer run** (agent, read-only on the outside world): reads the PR threads, the approved
   briefs, and the repo's own conventions for filing issues — skills under `.claude/skills/**`,
   `.agents/**`, `.zibby/zibby-skills/config.yml` (`jira:` key: board, issue types, team, labels),
   `.github/ISSUE_TEMPLATE/**`, CONTRIBUTING — and writes ONLY `zibby-pr-followups.json`: one
   issue spec per thread. It honours what was agreed in the thread (assignee = operator, a given
   team, labels). It never creates anything itself (the gate would ask again — the operator already
   decided); read-only Jira/GitHub lookups to resolve account or field ids are fine.
6. **ZIBBY files the issues** deterministically from that file (Jira REST when the project has a
   Jira integration, else the PR's own git host: GitHub `POST /repos/{repo}/issues`, GitLab
   `POST projects/:id/issues`), replaces `{{ISSUE}}` in each reply with the created issue as a
   markdown link (`[KEY-123](url)` / `[#45](url)`), then runs `postFollowUp` (replies, resolve,
   description, re-request review) — no second approval.
7. Failure: an issue that could not be created → its reply is NOT posted (never post a literal
   placeholder; "a reply is concrete or it is not drafted") and its thread is not resolved; the
   reason goes to `followUps.note`. A filer run that fails or writes nothing → no issues, all other
   replies still post.

## Data

- `PrThreadOutcomeSchema.kind` += `"followup"`.
- `PrThreadReplySchema` / `OperatorThreadReplySchema` += `followUp?: string` (trim, max 4000).
- `ScheduledTask.prAddressComments.followUps?`:
  `{ state: "filing" | "done" | "failed", taskId?: string, created?: { threadId, key, url }[], note?: string }`.
- `ScheduledTask.prFileFollowUps?`: `{ parentTaskId: string, state: "running" | "done" | "failed" }`
  — stamped on the filer task; the scheduler's terminal hook (gated on `running`, same as the other
  `park*` branches) reads `zibby-pr-followups.json` and hands it to a handler
  `InboxAddressCommentsService` registers on `TaskSchedulerService` in `onModuleInit` (no DI cycle).
- `zibby-pr-followups.json`:
  `[{ "threadId", "tracker": "jira" | "git-host", "title", "body" (markdown), "issueType"?, "projectKey"?,
  "labels"?: string[], "assignee"?: "operator" | "<jira accountId | git-host login>", "parent"?: "<KEY>",
  "fields"?: { "<jira field id>": <value> } }]`. Validated with zod; unknown thread ids (not an
  approved follow-up reply of this task) are dropped.

## Jira create

`createJiraIssue` in `apps/api/src/integrations/jira-client.ts`: `POST /rest/api/3/issue`,
`project.key` = spec `projectKey` ?? integration `projectKey`, `issuetype.name` = spec ?? `Task`,
description as minimal ADF (paragraph per blank-line block), `assignee: "operator"` →
`GET /rest/api/3/myself` accountId. Extra `fields` are merged; if Jira answers 400, retry once
without `fields` and record that in the note. Integration lookup reuses the project → Jira
integration resolution `inbox-issues.service.ts` already does.

## Recipe

`~/Documents/AI/ZibbyOS/recipes/workflows/pr-file-followups.workflow.md` (operator recipes live
outside the repo): one agent phase `file`, agent `github-commenter`, model sonnet,
`consumes: task.md`, `produces: zibby-pr-followups.json`, department `dev`.
