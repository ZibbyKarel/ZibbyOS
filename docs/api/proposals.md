# System proposals — automation and goal proposals (TODO 14, #27)

Automations that "propose without acting" write one structured **proposal record**
per suggestion, with provenance, confidence and expiry. The operator lists them,
dismisses one or rewrites its wording; producers respect those decisions on their
next run. The producers keep writing their existing vault notes, so the briefing is
unchanged.

Contract: `libs/contracts/src/proposals/` (`proposalsContract`, mounted as
`appContract.proposals`). Implementation: `apps/api/src/proposals/`.

## Endpoints

| Method | Path                 | Body                                                                                                                                                                | Result                         |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| GET    | `/api/proposals`     | —                                                                                                                                                                   | `200 Proposal[]`               |
| PATCH  | `/api/proposals/:id` | `{ action: "dismiss" } \| { action: "approve" } \| { action: "edit", text }` (1–500 chars; whitespace runs, newlines included, collapse to one space, then trimmed) | `200 Proposal` / `404` / `409` |

- `GET` lists the **open, unexpired** proposals, sorted by confidence (high first),
  then `lastSeenAt` newest first. An `agent-factory` proposal whose approval was
  already decided on the approvals page (or no longer exists) is hidden too. One `list("pending")` read
  decides this. If that read fails, nothing is hidden.
- `approve` is for `gap-detect` only: the operator just created an automation from
  the suggestion (the Bridge widget's Approve → prefilled create-automation dialog).
- `404`: unknown id. `409`: `edit` of an `agent-factory` proposal (edit the
  candidate on its agent page), `approve` of a non-`gap-detect` proposal, or any
  action on an already decided (`dismissed`/`approved`) proposal.

## The record

```ts
{
  id: string;                 // "prop_" + 12 hex of sha256(source, dedupe key) — stable across reruns
  source: "pattern-extract" | "gap-detect" | "agent-factory";
  kind: "automation" | "goal";  // default "automation" for records without it
  goal?: { presetId?; name; outcome; predicate? }; // only on kind "goal"
  text: string;               // ≤ 500, the producer's current wording
  editedText?: string;        // ≤ 500, the operator's wording — wins everywhere
  confidence: "low" | "medium" | "high";
  occurrences: number;        // evidence count the producer saw
  provenance: { automationId?; noteId?; approvalId?; agentId?; taskId? }; // taskId: gap-detect sample task
  createdAt; lastSeenAt; expiresAt: string; // ISO
  status: "open" | "dismissed" | "approved"; // dismissed/approved are terminal
  decidedAt?: string;
}
```

- **Confidence**, against the producer's own minimum `m` (all three use `m = 3`):
  `low` ≤ m, `medium` ≤ 2m, `high` otherwise.
- **Expiry**: `expiresAt = lastSeenAt + 30 days`. Each producer run that still sees
  the proposal refreshes both. Expired records are not listed but are kept on disk.
- **Upsert** (`ProposalsService.upsert`): a new id is created `open`; an existing one
  gets new `text`, `occurrences`, `confidence`, `lastSeenAt`, `expiresAt`,
  `provenance` and keeps `status`, `editedText`, `decidedAt`, `createdAt`. A
  dismissed or approved proposal is never re-opened. `expireUnseen(source, keys)`
  sets `expiresAt = now` on open records of `source` the producer no longer reports.

## Store

One JSON array at `<data>/proposals/proposals.json` (`PROPOSALS_DIR` overrides the
directory). Writes are atomic (tmp + rename) and serialized in-process.

- **Reads fail open.** A missing, unreadable or corrupt file reads as `[]`, never a 500.
  A file counts as corrupt when it is unparseable or not an array. A valid array with
  some invalid records is salvaged per record: the valid ones are kept, and the invalid
  raw items go to `proposals.json.rejected-<ts>` on the next write.
- **Writes never destroy evidence.** Before writing over a corrupt file, the store
  renames it to `proposals.json.corrupt-<ISO ts without colons>` (original bytes kept)
  and logs a warning. An unreadable file (any error other than ENOENT) makes the write
  fail, so it is never overwritten. The producers' notes are still written, because
  `syncNoteLines` fails open.

## Producers

| Source            | Dedupe key              | Provenance                                         | Note                   |
| ----------------- | ----------------------- | -------------------------------------------------- | ---------------------- |
| `pattern-extract` | `action:decision`       | `{ automationId, noteId: "patterns-suggestions" }` | `patterns-suggestions` |
| `gap-detect`      | normalised task summary | `{ automationId, noteId: "automation-gaps" }`      | `automation-gaps`      |
| `agent-factory`   | candidate agent id      | `{ agentId, approvalId }`                          | — (approval queue)     |

`automationId` is the firing automation's id, passed by the scheduler
(`extract(now, { automationId })` / `detect(now, { automationId })`); an unattributed
run omits it. The note writers go through `ProposalsService.syncNoteLines`: dismissed
items are skipped and edited ones are written with `editedText`. It fails open, so a
proposals-store error falls back to the producer's own text. When nothing qualifies
any more, the producer still rewrites the note if it holds dismissed lines (matched on
the producer text or the edited wording); otherwise the note is left alone.

**Dismissing an `agent-factory` proposal** persists `dismissed` first, then rejects its
pending `agent-proposal` approval (a failure after persisting is logged as a warning and the
dismissed record is still returned) through `ApprovalsService.reject` (the approvals page's
`POST /api/approvals/:id/reject` path), so the registered runner deletes the
candidate agent the same way. If the approval is already decided, dismissal only
updates the record.

## Activity

Dismiss, approve and edit record `proposal-decided` (group `approvals`), summary
`"dismissed|approved|edited <source> proposal"`, refs
`{ itemId: <proposal id>, action: "dismiss" | "approve" | "edit", noteId?, agentId?, approvalId?, automationId? }`.
The producers record no run-completion activity of their own. A new agent-factory
candidate shows up as `approval-requested` (refs.status `agent-proposal`).

## Automation vs goal (#27)

The Bridge widget is "Návrhy automatizací a cílů" ("Automation and goal proposals"); every card
carries a kind badge. The decision is made by `gap-detect` (`goalDraftFor`) from its existing
signal — a task the operator keeps creating by hand (≥ 3× in 30 days):

- **goal** when the recurring task is an ongoing, measurable outcome that has a goal preset
  ("keep CI green", "dependencies up to date", "security patches in 7 days", "my PRs merge-ready",
  "no forgotten PRs"). Detected by a small keyword table onto `GOAL_PRESETS`; the proposal carries
  `goal = { presetId, name, outcome, predicate }`.
- **automation** for everything else (a fixed trigger → action, e.g. "post standup").

`pattern-extract` and `agent-factory` stay automation/agent proposals. A rerun re-decides the kind
(the record id is unchanged); a dismissed/approved proposal is never reopened.

**Accepting** a goal proposal (Approve button, label "Vytvořit cíl") makes the web client call
`POST /api/goals` with the preset's scope/cadence/ceiling (or a weekday 09:00 standing goal when
there is no preset) and **`enabled: false`** — the goal is created PAUSED, the operator reviews and
starts it on the goals page, and it obeys the autonomy levels like any goal. Only then is the
proposal marked `approved`. An automation proposal still opens the prefilled create-automation dialog.

## Why the widget was empty (#27)

The producers were switched off: `gap-detect` was seeded `enabled: false` and `nightly-patterns`
had been disabled, so nothing wrote proposals (the stored ones had expired 2026-11-12). The seed now
enables `gap-detect`, and a one-time marker (`.proposal-producers-enabled.done` in the automations
dir) re-enables both on the next boot; afterwards the operator's toggle is respected.
