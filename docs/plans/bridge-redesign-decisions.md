# Bridge redesign — decision log

Run start 2026-11-14 (evening). Defaults marked "(default)" stand until the operator answers.

| # | Decision | Why |
|---|---|---|
| D1 | Work in worktree `worktrees/bridge-redesign` on `feat/bridge-redesign`, one commit per phase, no push, no PRs, no stop between phases (default) | Large overnight change; main stays usable; HANDOFF's "PR per phase + stop" does not fit an unattended run |
| D2 | Direction A ("Tichý briefing") only; B and C are not built | HANDOFF names A as the default layout |
| D3 | Type-B gaps that need new backend data are not built; logged in GAPS.md | HANDOFF protocol |
| D4 | Reference is the `.dc.html` spec + `bridge.css`; no screenshots available | `screenshots/` empty, artifact unreadable in an unattended session |
| D5 | `design/ZibbyCorp/*` deletions in the main checkout are left untouched | Not part of this task |
| D6 | Design tokens applied app-wide: colours, Geist / Geist Mono, base 13 px (default; G-001/005/006) | Operator said the redesign concerns the whole app; one visual language |
| D7 | Other screens only inherit tokens and shared primitives; no per-screen redesign (default) | No design exists for them |
| D8 | Light theme stays functional, not tuned (default) | Design is dark only |
| D9 | Keep the app's 4 density levels; map `--rowpad` 4/8/12/12 onto compact/comfort/airy/open (default; G-002) | Type C: behaviour by app, look by design |
| D10 | Row nav: add literal J/K, keep arrows (default) | Hint already says J/K |
| D11 | Saved layouts are not migrated; species minima apply only to new resizes, render never clamps stored sizes (default; G-027) | Do not break saved layouts |
| D12 | Tier pin override (G-028) and per-file Viewed: not built until the operator allows an additive `ui.bridge` contract field (default) | HANDOFF: no data-model change without asking |
| D13 | Tests are updated only where the markup contract changes on purpose; each case noted in the handoff | HANDOFF: do not edit tests just to pass |
| D14 | Sheet width: design width per kind as the preferred width, clamped to the free space beside the row (G-162) | Keeps "detail beside the row" working on narrow boards |
| D15 | Tier score: widgets report `you` + a self-summed `urgency` (blocked ×3, proposal ×3, error ×2, budget>85 ×1); `rank ≤ 2` ties break by reading order (y, x); a user-collapsed widget never takes a primary slot (`grid/priority.ts`) | Spec §6 leaves ties and inputs open; reuses the existing info channel board ← widget |
| D16 | Auto-collapse (score 0 + empty) reuses the existing collapse shrink (h=1 + compaction). `ui.bridge.collapsed[id]`: `true` = operator collapsed, `false` = operator keeps an empty widget open, missing = automatic. TODO and Quick actions never auto-collapse (their empty state is the add row) | No contract change; spec table gives those two an add-row empty state |

## Operator answers (2026-11-14, late evening) — these override the defaults above

| # | Decision | Why |
|---|---|---|
| O1 | No PRs; everything goes to `main`. Tag `pre-bridge-redesign` = main before the run (`dfdcb3e1d`). Agents keep working in `worktrees/bridge-redesign`; the orchestrator fast-forwards `main` to `feat/bridge-redesign` after each committed phase. Overrides D1 | Operator: "dělej všechno rovnou do main", "otaguj současný main" |
| O2 | The design system adopts the design's visual style; all DS components get restyled, the rest of the app shares the language; breakage is fixed in follow-up rounds. Confirms D6, widens D7 | Operator answers 2–3 |
| O3 | Light theme is first-class: design v2 (`tokens.json`, `tokens.css`, HANDOFF "Témata a tokeny") copied from `design/bridge-redesign 2` into `design/bridge-redesign`. System default + persisted override. Overrides D8 | Operator answer 4 + v2 handoff |
| O4 | Type-B items are built when they make sense and we know how (client-side or additive); dashboard widgets must stay functional above all. Overrides D3/D12: per-file Viewed (localStorage), tier pin, budget prediction if derivable | Operator answer 5 |
| O5 | Density: three levels compact / comfort / airy (rowpad 4/8/12); stored `open` coerces to `airy`. Overrides D9 | Operator answer 6 |
| O6 | No literal J/K; arrows stay. Overrides D10 | Operator answer 7 |
| O7 | The operator's saved DEFAULT layout is rebuilt to the design's DEFAULT; the saved layout named "primary" is left alone. Overrides D11 for DEFAULT | Operator answer 8 |
| O8 | Tests may be changed freely where the redesign changes markup/behaviour. Overrides D13 | Operator answer 9 |
| O9 | Direction A confirmed | Operator answer 10 |
| O10 | No push during the run; pushing main is left to the operator in the morning | Outward-facing step, half-finished states stay local |
