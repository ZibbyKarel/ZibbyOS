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
