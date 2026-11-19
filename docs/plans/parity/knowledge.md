# Visual parity — Znalosti (/knowledge/brain, /knowledge/maintenance)
Design: `design/redesign-v2/project/Znalosti.dc.html` (views: 0 Mozek, 1 Hover, 2 Vybraná poznámka, 3 Úprava · jen ke čtení, 4 Aktualizovat vše, 5 Stavy, 6 1100 px, 7 Telefon, 8 Údržba, 9 Pohyb a zdůvodnění, 10/11 themes).
Reference shots: scratchpad `shots/kn-<i>.png`; app before: `shots/app-kb.png`.
Read the mockup source for exact markup/CSS/graph layout logic (it is JS-rendered — read how it positions zones/nodes).

Structural diffs (reply per number):
1. Page title "Znalosti" (not "Mozek"); sub line "<N> poznámek · <M> zdroje" + per-source status dots + chevron (opens source drawer).
2. Search: wider field, placeholder "Hledat v celém mozku — název, cesta, tag", trailing "/" kbd hint; "/" focuses it.
3. Header actions right: Rychlý zápis · Import · Nová poznámka as ghost/text buttons, then "Aktualizovat vše" primary. The "N věcí čeká na tebe" text is not in the design — move it into the source/inbox drawer or drop it from the header.
4. Filter row: source chips with colour dot + "Name · count" (Vault · 167, DevRel KB · 74 …), then folder chips (Paměť / Znalosti / Denní) compact, divider, "Oddělení ▾" and "Tagy ▾" dropdown triggers, "Jen sirotci" toggle. Below: "Neroztříděné · N". Compact, low-chrome — no large pills, no boxed "Všechna oddělení >".
5. Graph = zoned layout, not one random blob: vault zone left, "MOST · INDEX" bridge zone centre (Index hub + "Most · <KB>" bridge nodes), team KB zone right; mono uppercase zone labels ("VAULT · ZIBBYOS", "TÝMOVÉ KB · DEVREL · PLATFORM"); soft radial halo behind each zone. MOC/hub nodes bigger and labelled ("Vývoj — mapa obsahu"); leaf nodes small, unlabelled (Popisky Auto).
6. Colours: vault nodes violet, team KB teal squares, index/hub white ring, open question amber ring, unsorted dashed. Follow the mockup tokens (map to DS tokens; add tokens if missing).
7. Graph controls bottom-centre/right toolbar: + − fit | Popisky: Auto / Vše / Vyp segmented | minimap toggle | physics toggle. Minimap card bottom-right ("minimapa"). Remove the top-right zoom buttons.
8. Legend bottom-left with all six entries (Vault·kruh, Týmová KB·čtverec, Index/MOC·hub, Otevřená otázka·čeká na tebe, Neroztříděné, Odkaz·zvýrazní se při najetí).
9. Tree collapsed by default to a thin vertical rail labelled "Strom" (icon on top) between graph and reader; expands on click.
10. Reader empty state: centred icon, "Vyber poznámku", helper "Klikni na uzel v mozku nebo na položku ve stromu. Dvojklik otevře rovnou úpravu.", then "NAPOSLEDY UPRAVENÉ" list (dot + title + relative date).
11. Selected note (view 2): source badge + mono breadcrumb path + icons + "Upravit" on the top row; title; meta chips (folder › sub, #tags, updated date); body; sections "ODKAZUJE SEM N", "ODKAZY VEN N" as inline dot lists; "OKOLÍ V MOZKU" mini-graph card.
12. Údržba (view 8): two-column card grid exactly as view 8 (Noční destilace with log, Detekce mezer with rows, Self-model card, Týmové KB · ingest pipeline + PR timeline + log), header right segmented filter Vše / Vault / <KB>…
13. 1100 px and phone views (6, 7): match.
SAFETY: never click "Aktualizovat vše", sync, Spustit hned, Save — it hits the operator's real KBs.
