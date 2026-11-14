# Bridge redesign — handoff

Goal (2026-11-14, overnight run): implement the redesign described in
`design/bridge-redesign/HANDOFF.md` (Bridge dashboard + sheets first, rest of the app via tokens).

- Branch `feat/bridge-redesign`, worktree `worktrees/bridge-redesign` (own `graphify-out` copy); `main` is fast-forwarded to it after each phase (O1). Tag `pre-bridge-redesign` = main before the run.
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
| 1 | Tokens (bridge.css → DS theme) | opus | done (331360c3a) |
| 2 | Widget frame: tier, species, header, `useWidgetPriority` | orchestrator + opus | in progress (`grid/priority.ts` written; frame + wiring at opus) |
| 3 | Widget species (12) | sonnet ×N | pending |
| 4 | Briefing hero + DEFAULT / REVIEW + phone | opus | pending |
| 5 | Sheet frame (header, back stack, J/K counter, expand, banner) | orchestrator + opus | pending |
| 6 | PR sheet + PrDiff | opus | PrDiff body in progress (parallel); sheet header after phase 5 |
| 7 | Run sheet + rail | opus | RunDetail body in progress (parallel); sheet header after phase 5 |
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

## Run notes

- Parallel agents share the worktree; each owns a file set and never edits GAPS.md except the
  phase owner — gap rows come back in agent replies and the orchestrator records them.
- DS tests: run from `libs/design-system` (`pnpm exec vitest run src/components/<X>`); the
  `--project design-system` flag finds nothing. Baseline failure: `ApprovalCard.test.tsx` "tints the symbol".
- Phase 5 plan (sheet frame): back stack kept in `DetailSheet` (in-sheet `onOpen` pushes, outside
  selection change clears, Backspace / Alt+← pops, Esc closes); J/K counter from `[data-rk]` rows;
  preferred width per kind clamped to free space (D14); expand = all but 3 columns; anchored widget
  stays above the dim overlay.
- Design v2 (light theme, `tokens.json`) is in `design/bridge-redesign`; phase 1b (themes, theme
  switch, 3 densities) runs at opus in parallel with phases 2 / 6-body / 7-body.
- After the Bridge phases: phase 10 = restyle ALL design-system components to the new language (O2),
  then fix what broke on other screens.

## State at ~midnight (uncommitted work in the worktree — commit when agents are quiet and tsc is clean)

Done, uncommitted: phase 1b (themes v2, 3 densities), phase 2 (WidgetFrame tiers + priority wiring),
PrDiff body (new `FileDiffView`, Viewed in localStorage), diff token mapping in `globals.css`.
Running: run detail body (opus), phase 3 widget groups A/B/C (briefs in the session scratchpad:
shared rules = this file + decisions; A = Runs, Project status, Automation; B = PRs, Issues,
Proposals; C = Budgets, Mentions, Team KB, TODO, Quick actions, Pinned), phase 5 sheet frame +
PR sheet header (opus), phase 10 group A core DS primitives (opus).
Still to launch: phase 4 (briefing hero, DEFAULT/REVIEW presets per design, operator's saved
DEFAULT rebuilt — O7, phone column by tier), phase 8 compact sheet bodies, phase 9 phone pages,
phase 10 groups B/C (remaining DS components), then a fix round on other screens, GAPS.md update
from agent replies, full validation, ff-merge into main.

Gap rows reported by agents, not yet written to GAPS.md:
- C: light-theme `state-block`/`warn`/`accent` are amber FILL (2.04:1) — text must use `accent-fg`.
- B: idle as text is 2.54:1 in light — dots only.
- B: PrDiff outdated threads (no line) stay in `PrThreads`, not inline.
- A: mockup's "Collapse all" / "Submit review" in PrDiff not built (not in spec).
- Budgets widget reports no urgency (over-85 % already counted in `you`).
- Collapsed header keeps one grid row height instead of 38px (D16).

## State at ~01:00

Done, uncommitted (on top of the midnight list): run detail body (phase 7), phase 3C widgets
(+ DS `Meter`, `FeedRow`, `ReadingItem`, `PaperSheet`, `ActionPill`, `LauncherTile`), phase 10B
shell/chat DS components, phase 10A core DS primitives (437 tests green, DS tsc clean).
Running: 3A, 3B, phase 4, phase 5, 10C. Then: phase 8, phase 9, fix round, sweep, merge.

~02:00: also done, uncommitted: 10C data-display DS, 3A, 3B (+ `cn.ts` fix for `text-*` tokens),
phase 5 sheet frame + PR sheet header, `.md-prose` code/link tokens. Running: phase 4, phase 8
(compact sheet bodies, sonnet), brand (bow-tie mark + splash from `design/brand/`, opus — operator
request added at night). Phase 9 (phone pages) launches after phase 4.

Gap rows to write (3A/3B/5): Runs "now" box not collapsible; automation kind icon neutral; project
"failing for 3 h" no data (G-080); proposals cost (G-090), PR sections + chips (G-040/045), bot
avatar (G-041), +/- lines (G-042), PR compact variant (G-050) not built; anchored widget
collapse-to-narrow-list not built; PR checks x/y counts and split merge button have no wired data;
IssueSheet uses "bug" glyph; sheet banner only for failing CI; `BoardRow.sheetSide` deprecated;
RunSheet `pending` shows as idle; sheet copy label English outside `DetailSheet`; Task copies `TSK-…`.

Open items from 10A (operator decisions, defaults taken):
- `Tag` prop `uppercase` is now a no-op (~10 usages in `apps/web/features/inbox`) — remove in the sweep.
- `Progress` default tone is grey (`ink2`), `Card` default radius 10px.
- `Card` `edge` (coloured left stripe) and `corners` kept for API stability although the design bans stripes.
- `AgentBadge` still fills the tile with the department colour (design: neutral avatars).
- `Tag tone="accent"` stays amber on project ids / usage tags (decorative colour, against "colour = state").
- 10B: chat user bubble is neutral, ChatDock "Clear" is secondary; Wordmark tracking and header 56px kept.
