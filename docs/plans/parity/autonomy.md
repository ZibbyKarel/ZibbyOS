# Visual parity — Autonomy (/governance/autonomy)
Design: `design/redesign-v2/project/Autonomy.dc.html` (views: 0 Hlavička a režimy, 1 Úrovně autonomie, 2 Telefon, 3 Model a pravidla, 4 Tmavé, 5 Světlé).
Reference shots (orchestrator): scratchpad `shots/au-<i>.png`; app before: `shots/app-au.png`.
Read the mockup source for exact markup/CSS (`Autonomy.dc.html`, `bridge.css`, `entity.css`, `detail.css`).

Structural diffs to fix (numbered; reply per number):
1. Mode control on the page: compact segmented group "Režim Zibbyho" (Manuál / Poloautomat / Automat) inside a bordered box on the title row, right side. Not large radio cards. Radio cards stay only inside the header popover (ModePopover).
2. Lane meanings live in the matrix column headers: orb + lane name + one-line meaning per column; under the Automat header the note "Teď jako Poloautomat" (when global level caps it). Delete the separate legend row above the table.
3. Table frame: one bordered card with vertical column dividers. Each row: icon (globe = global, building = company, people = team), label, and under the label a muted line ("N týmy" / "Dědit vše" action). Team rows nested under their company with tree connector lines.
4. Chips (work classes) in cells: borderless text with drag-handle dots (⋮⋮). Background fill + small dot only when the chip is an own override at that level (not inherited).
5. Empty cell renders "—" (muted). No "Zatím nejde…" / "Nic" texts in cells; the "not available yet" note appears once, in the affected column header.
6. Read-only (no operator token) state: slim one-line inline notice above the table (icon + text + action), not a big card.
7. Do NOT build: footer explanatory text, simulation chips, view switcher — design-board furniture.
8. Do NOT touch the top nav / AppShell chrome.
9. Phone (view 2): match layout at 390px.
