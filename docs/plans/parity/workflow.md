# Visual parity — Workflow detail (/work/workflows/[id])
Design: `design/redesign-v2/project/Workflow Detail.dc.html` (views: 0 Editor, 1 Loops & checkpoints, 2 Editing states, 3 Run mode, 4 Workflow settings, 5 Phone, 6 Components & rationale, 7/8 themes).
Reference shots: scratchpad `shots/wd-<i>.png`; app before: `shots/app-wd.png` (route /work/workflows/delivery).

Structural diffs (reply per number):
1. Read-only default (not editing): NO inspector panel — canvas is full width. The workflow-settings inspector appears only in edit mode with nothing selected (view 4 §1), or via ⋯ menu → "Workflow settings".
2. Fit to view at readable scale: cards must be legible (~80–100%), not 47% with tiny text. Fit should cap the minimum zoom; long flows scroll/pan instead of shrinking to unreadable.
3. Phase card: avatar (initials + engine mark) · phase NAME as title (e.g. "Plan"), agent name as subtitle ("Architect"), one mono meta line below a divider ("opus · high" + ¶ custom-prompt glyph + / skill glyph). The app shows agent id as title — fix.
4. Connectors: handoff file label as plain text above the connector start ("plan.md"); checkpoint = amber diamond ON the connector. Remove the "4/4" corner badges from cards. Loop = arc over the top with "⇄ up to 3× ▮▮▮" label on the arc.
5. Tool step = terminal card (dots title strip, mono command line); sub-workflow = stacked card ("↳ Docs update", "3 phases"); PR end node = pill with lock "Parks for review".
6. Zoom control bottom-left: "− Fit · 80% + ⛶" in read mode; in edit mode toolbar "− 100% + ⛶ | grid snap | undo redo | Auto-layout". Minimap only in edit mode. Expand (⤢) button top-right of canvas.
7. Header: "‹ Workflows / <name> [dept chip] 📌" left; right: Edit · Duplicate · Run workflow (primary) · ⋯. Edit mode: name becomes inline input, "✓ No problems", "● Unsaved changes", right Discard · Save ⌘S.
8. ⋯ menu (view 4 §3): Workflow settings ⌘, · Run history · Open .workflow.md · Duplicate · Export · Delete workflow… (red).
9. Run workflow opens a small anchored sheet (view 4 §2), not a dialog: Project, Task, Complexity segmented, Outputs toggles, Advanced row, estimate + Cancel/Start run ⌘↵.
10. Inspector (THE side panel — view 0 §2 and view 4 §1): 392px, resizable, header = icon/avatar + title + subtitle ("Agent phase · 4 of 6" / "Nothing selected · applies to every run") + ⋯ + ✕. Sections NUMBERED (1 Who, 2 Prompt, 3 Files, 4 Loop & retries, 5 Checkpoint, 6 Advanced / settings: 1 General, 2 Run defaults, 3 Budget, 4 Default advisor, 5 Workflow instructions, …) with a chevron; collapsed sections show a one-line summary right-aligned ("opus · 2 calls", "1 840 chars"). Fields are low-chrome: labels small muted, selects as text + chevron (no big boxed inputs), segmented controls for engine (Default/Claude Code/opencode/OpenAI), tier (haiku/sonnet/opus/fable), thinking (low/medium/high), complexity (light/standard/deep); "Requires" as toggle chips; agent "Who" card with Change ▾. Compare carefully with the current Inspector — the operator explicitly called out the side panel.
11. Edit mode left palette = collapsed icon rail (+, agent, tool, sub-workflow); "A" opens it.
12. Phone view (5): match.
SAFETY: never click Run/Start run/Save/Delete on the live app. Use page.route fixtures if needed.
