# Workflow branching, phase skipping, and the address-comments gate

Status: in progress (2026-11-18). Supersedes the separate `pr-file-followups` workflow from
`docs/plans/pr-followup-issues.md`: follow-up filing becomes a conditional phase inside
`pr-address-comments`, after an in-run approval gate.

## 1. Engine: conditional phases (`when`)

A phase may carry `when`. The runner evaluates it every time the cursor reaches the phase
(forward advance, back-edge, or gate resume), after the operator-pause check and before the
budget-cap check. False → the phase is **skipped**: no stage spawns, a `StageRun` with status
`skipped` is recorded (so the timeline shows it), an activity record `stage-skipped` is
written, `handoffSource` is left unchanged, and the cursor advances to the next phase in
declared order.

Branching "A or B" is two consecutive phases with mutually exclusive `when`s; whichever runs,
the next phase continues. No jump targets are added (back-edges already exist via `loop`).

```ts
export const PhaseWhenSchema = z.object({
  /** An EARLIER phase (declared order) that has `produces`; its latest output is the input. */
  phase: z.string().min(1),
  /** Default true: the output exists and is non-blank. false: missing or blank. */
  exists: z.boolean().optional(),
  /** JS regex (flag "m") that must match the output text. Needs exists !== false. */
  match: z.string().min(1).max(500).optional(),
  /** The output's <verdict> token (parseStageVerdict) must equal this. Needs exists !== false. */
  verdict: StageVerdictSchema.optional(),
  /** Flip the result (the "else" branch). */
  negate: z.boolean().optional(),
}).strict();
```

Evaluation: `text` = the latest stage's `produces` file of `when.phase` (missing → `""`).
`ok = exists === false ? text.trim() === "" : text.trim() !== ""`; then `ok &&= regex.test(text)`
for `match`, `ok &&= parseStageVerdict(text) === verdict` for `verdict`; `negate` flips `ok`.
A skipped referenced phase has no output → `exists` is false.

Validation (`refineWorkflow`): `when.phase` must be an earlier phase with `produces`;
`match` must compile; `match` and `verdict` are mutually exclusive; neither with `exists: false`.

Recipe example:

```yaml
  - id: route
    ...
    produces: route.md          # writes "route: a" or "route: b"
  - id: build-a
    when: { phase: route, match: "^route: a$" }
  - id: build-b
    when: { phase: route, match: "^route: a$", negate: true }
```

## 2. Engine: `consumes` resolves by name

Today `consumes` always receives the previous producing phase's output, whatever its name.
This silently fed `describe` the replies JSON instead of the address report. New rule, when
advancing forward (after a green phase or a skip): the next phase's handoff is the latest
output of the nearest earlier phase whose `produces` equals the next phase's `consumes` and
that has a `done` stage; otherwise the old behaviour (last produced output). The same rule
applies in `recomputeHandoff`. Back-edges keep passing the failure context unchanged.

## 3. Engine: gate presenter seam

`approval: "ask"` parks the run on a generic `workflow-gate` approval. A domain may present the
gate itself (its own approval kind and card):

```ts
type GatePresenter = (ctx: {
  run: WorkflowRun; workflow: Workflow; phaseId: string; cursor: string | null;
}) => Promise<"handled" | "fail" | "default">;

setGatePresenter(fn: GatePresenter): void;                      // single registrant
decideGate(workflowRunId: string, decision: "approved" | "rejected"): Promise<void>;
replaceArtifact(workflowRunId: string, name: string, content: string): Promise<void>;
```

`parkAtGate` (reason `gate` only) calls the presenter after the parked aggregate is persisted:
`default` → the existing `workflow-gate` approval; `handled` → the presenter created its own
approval and will call `decideGate`; `fail` → the run fails exactly like a rejected gate.
A throwing presenter is logged and treated as `default`. The presenter may call `decideGate`
synchronously (autopilot / auto-push approve on the spot). `replaceArtifact` rewrites the
latest stage copy of a produced file (chmod writable → write → back to 444).

## 4. Address comments on the new engine

Recipe `pr-address-comments`:

```
address → reply → describe (approval: ask) → file (when: { phase: reply, match: "\"followUp\"\\s*:\\s*\"[^\"\\s]" }) → deliver (system)
```

`file`: agent `github-commenter`, sonnet/medium, `consumes: zibby-pr-replies.json`,
`produces: zibby-pr-followups.json`, `prompt` = the former filer brief (read thread + repo
conventions, write specs only, never create anything).

Lifecycle (`prAddressComments.state` gains `approved`):

1. `running` → gate on `describe`: the presenter (address-comments service) reads the report,
   replies and description from the live run and does what `parkPrAddressComments` did after
   the run ended: the same `pr-address-comments` approval and card, the same autoPush/autopilot
   rules, `awaiting-approval`. Nothing to approve (no report, no commits and no replies) → `fail`.
2. Approve → store the operator's replies on the task, `replaceArtifact(zibby-pr-replies.json)`
   so the `file` phase and its `when` see the edits (deleting every brief skips `file`),
   state `approved`, `decideGate(approved)`. Reject → `discarded`, `decideGate(rejected)`.
3. The run continues: `file` runs or is skipped (a failed `file` falls through via `loop.then: deliver`).
4. `deliver` (a `system` phase, action `pr-address-comments.deliver`, see `docs/api/workflows.md`): requires
   state `approved`, then push (fast-forward), file issues from `zibby-pr-followups.json` if present, substitute
   `{{ISSUE}}`, post replies, resolve, update description, re-request review — no second approval. A missing or
   failed `file` output drops the placeholder replies, with a note. It writes `zibby-pr-delivery.md`; a refused
   push is `failed` and fails the stage. A run that ends while still `approved` (cancelled before `deliver`) is
   marked `failed` ("run ended before delivery") by the terminal hook.
5. Terminal hook, state `running` (a recipe without the gate): the legacy post-run park,
   unchanged.

Removed: the `pr-file-followups` workflow, the filer task (`ScheduledTask.prFileFollowUps`),
`startFollowUps`, `FILER_TARGET`, `followUps.taskId`.
