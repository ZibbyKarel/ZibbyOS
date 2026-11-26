# Goals

A goal is a mandate the operator gives ZIBBY: an outcome plus constraints (scope, deadline or
cadence, budget, autonomy ceiling). This document covers the contract, storage and CRUD API; the
engine that plans and acts is built on top of it. Spec: `docs/plans/goals-mandates-spec.md`.
Not to be confused with the loop (`docs/api/loops.md`, maker + verifier).

## Model

`libs/contracts/src/goals/`: `Goal` (`goal.schema.ts`), `GoalState`, `GoalInstance`,
`GoalTimelineEvent`, `GoalRollup` and `rollupGoal` (`goal-state.schema.ts`), `GOAL_PRESETS`
(`goal-presets.ts`), `goalsContract` (`goals.contract.ts`).

- `deadline` and `cadence` are mutually exclusive; `cycleHours` needs `cadence`; `ceiling` defaults to `tier2`.
- `mergeGrant` exists on `Goal` only. Create and update reject it (422); a later route sets it.
- Roll-up status: `paused | planning | acting | waiting | needs-you | done`, counts
  `{ total, done, parked, active }` and `needsYou`. Disabled = `paused`; no instances = `planning`;
  any parked instance (every `parkedReason`) = `needs-you`; all done = `done`; otherwise the
  busiest of acting > planning > waiting.
- `GOAL_PRESETS`: 11 prepared goals (`enabled: false`, Czech text, `group`). Data only, never written to disk.

## Files on disk

```
<data>/goals/<id>.goal.md              frontmatter = every field except id/outcome; body = outcome
<data>/goals/state/<id>/state.json     GoalState (atomic write)
<data>/goals/state/<id>/timeline.jsonl append-only GoalTimelineEvent lines
```

`GOALS_DIR` overrides `<data>/goals`. A missing or corrupt state file reads as an empty state
(cycle 0, no instances); corrupt timeline lines are skipped.

## Routes (`/api`)

| Route                                        | Notes                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /goals`                                 | goals, each with its `rollup`                                            |
| `POST /goals`                                | 201; 409 duplicate id; 422 invalid / `mergeGrant`                        |
| `GET /goals/:id`                             | 404                                                                      |
| `PATCH /goals/:id`                           | partial; 422 as for create (also if the merged goal is invalid)          |
| `DELETE /goals/:id`                          | removes the definition and `state/<id>/`                                 |
| `GET /goals/:id/state`                       | `{ state, rollup }`                                                      |
| `GET /goals/:id/timeline?instance=&cycle=`   | newest last, at most 500                                                 |
| `POST /goals/:id/wake`                       | clears every instance's `fingerprint`, logs a `wake` event               |
| `POST /goals/:id/instances/:instance/resume` | parked -> `planning`, clears `parkedReason`; 404 unknown, 409 not parked |
