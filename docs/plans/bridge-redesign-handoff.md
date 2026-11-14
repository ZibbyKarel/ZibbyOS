# Bridge redesign — handoff

Goal (2026-11-14, overnight run): implement the redesign described in
`design/bridge-redesign/HANDOFF.md` (Bridge dashboard + sheets first, rest of the app via tokens).

- Branch `feat/bridge-redesign`, worktree `worktrees/bridge-redesign` (own `graphify-out` copy).
- Orchestration: Fable orchestrates, decides, and implements only the most critical pieces;
  sonnet / opus subagents do the rest. Subagents never commit; the orchestrator commits per phase.
- Decisions: `docs/plans/bridge-redesign-decisions.md`. Design⇄app gaps:
  `docs/design/bridge-redesign/GAPS.md`. Code map: `docs/design/bridge-redesign/MAPPING.md`.
- Commit: `PATH="$PWD/node_modules/.bin:$PATH" rtk git commit -m "…" -- <paths>`; on a
  self-knowledge drift block run `pnpm self-knowledge:generate`, add the note, retry.
- Never kill processes by name. Never run repo-wide `check:lint` after single edits.

## Work items

| # | Phase | Owner | Status |
|---|---|---|---|
| 0 | Inventory: MAPPING.md + GAPS.md | sonnet | done |
| 1 | Tokens (bridge.css → DS theme) | opus | in progress |
| 2 | Widget frame: tier, species, header, `useWidgetPriority` | orchestrator + opus | pending |
| 3 | Widget species (12) | sonnet ×N | pending |
| 4 | Briefing hero + DEFAULT / REVIEW + phone | opus | pending |
| 5 | Sheet frame (header, back stack, J/K counter, expand, banner) | orchestrator + opus | pending |
| 6 | PR sheet + PrDiff | opus | pending |
| 7 | Run sheet + rail | opus | pending |
| 8 | Compact sheets | sonnet | pending |
| 9 | Phone pages | sonnet | pending |
| 10 | Rest of the app on new tokens, final validation | sonnet | pending |

## Verified facts

- Bridge code: `apps/web/features/bridge` (route `app/(company)/dashboard`); DS primitives
  `WidgetFrame`, `WidgetBoard`, `AnchoredSheet`, `BoardRow`, `Rail`, `DiffView` in `libs/design-system`.
- Grid is custom (`features/bridge/grid/layout.ts`), layouts persist in `ui.bridge` (contracts
  `system.schema.ts`). Densities in app: compact | comfort | airy | open.
- Row nav currently uses ArrowUp/ArrowDown, not literal J/K. No sheet back stack, expand or counter yet.
- Tokens: `libs/design-system/src/theme/globals.css` (`@theme`), light + dark themes exist; design is dark only.
- `design/bridge-redesign/screenshots/` is empty; the claude.ai artifact could not be read
  (needs an interactive permission prompt). Reference = `.dc.html` spec + `bridge.css`.
- Component tests: `--project web-components`; DS: `--project design-system`.

## Resume notes

Read this file, the decisions log and GAPS.md; `git log --oneline main..feat/bridge-redesign`
shows which phases are committed. Continue with the first non-done row above.

## Next (not done in this run)

—
