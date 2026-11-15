# Můstek (Bridge) — redesign: předávka pro implementaci

Tahle složka je **zadání pro redesign Můstku a detailů (sheetů)** v ZibbyOS.
Než začneš psát kód, přečti celý tento soubor.

## Co tu je

| Soubor | Co to je |
|---|---|
| `Bridge Redesign.dc.html` | Dashboard: směr A (výchozí layout, REVIEW, telefon), alternativy B a C, **spec v sekci `<article class="spec">`** |
| `Bridge Sheets.dc.html` | Detaily: PR (Přehled, Změny), Běh (běží / schválení / zaparkováno), Issue, Task, Automatizace, Stav projektu, Rychlá akce, Poznámka, telefon, **spec** |
| `bridge.css` | Sdílené styly obou stránek = **zdroj pravdy pro tokeny** (barvy, rádiusy, typová škála, tiery widgetů) |
| `screenshots/` | Screenshoty všech pohledů z design canvasu (pojmenované podle pohledu) — vizuální reference |

### Jak číst `.dc.html`
Jde o mockupy pro design canvas, **nejsou spustitelné mimo něj a nejsou to produkční komponenty.**
- Struktura a markup vznikají v JS uvnitř `<script type="text/x-dc">`, ve třídě `Component`. Metody jako `widget()`, `prRow()`, `runsBody()`, `frame()`, `prSheet()`, `changes()`, `runSheet()` odpovídají budoucím komponentám.
- Pole třídy (`PRS`, `EPICS`, `FILES`, `RUNSTATE`, `PH`, `LOGS`…) jsou **mock data**. Používej je jen jako ukázku tvaru dat, nikdy je nekopíruj do aplikace.
- Spec je čitelné HTML v `<article class="spec">` na konci markupu obou stránek. **Spec má přednost před tím, jak je mockup náhodou nakreslený.**

## Základní pravidlo

> **Design říká, jak to vypadá a jak je to uspořádané. Aplikace říká, co to umí a s jakými daty.**

- Vizuální jazyk, hierarchie (tiery), druhy widgetů, anatomie sheetu → podle designu.
- Data, API, chování, oprávnění, existující funkce → podle aplikace. Datovou vrstvu neměň, pokud to není nutné; když ano, napřed se zeptej.

## Protokol pro rozdíly design ⇄ aplikace

Každý rozdíl zapiš do `docs/design/bridge-redesign/GAPS.md` (vytvoř ho) jako řádek tabulky:
`| ID | Typ | Kde | Popis | Co jsem udělal | Potřebuje rozhodnutí? |`

| Typ | Situace | Co udělat |
|---|---|---|
| **A — jen v aplikaci** | Funkce, pole, akce nebo widget existuje v aplikaci, ale v designu chybí | **Zachovat funkci.** Přestylovat podle nejbližšího druhu / tieru / sekce sheetu (viz spec). Nic neodstraňuj. Zapsat. |
| **B — jen v designu** | Design ukazuje něco, co aplikace nemá (např. „Hold to approve“, predikce rozpočtu „dojde za ~2 dny“, Viewed u souborů, routing %) | Když jde **jen o UI nad daty, která už existují** → udělej. Když to potřebuje nová data nebo backend → **nestav to**. Komponentu připrav s volitelným propem, nebo ji vynech, a zapiš. |
| **C — konflikt** | Design a aplikace se liší v chování (jiné stavy, jiné akce, jiné pořadí) | Chování podle aplikace, vzhled podle designu. Zapiš s návrhem řešení. |
| **? — nejasné** | Nevíš, kam to patří | Nehádej. Zapiš do GAPS.md a **otázky sbírej na konec fáze**, ne po jedné. |

Mapování stavů → tónů (spec, sekce „Stav → tón“) je závazné. Když aplikace má stav, který v tabulce není, přiřaď ho podle významu (potřebuje mě = amber, chyba = rose, pracuje = violet, kontrola běží = sky, hotovo = emerald, klid = idle) a zapiš jako A.

## Fáze

Každá fáze = vlastní branch a PR. **Po každé fázi se zastav** a ukaž: co se změnilo, screenshot před/po, nové řádky v GAPS.md, otázky.

0. **Inventura (bez změn kódu).** Najdi v kódu všechny widgety Můstku, jejich rám a hlavičku, layouty (DEFAULT, REVIEW), AnchoredSheet a všechny druhy sheetů. Vytvoř `MAPPING.md`: design název → soubor a komponenta v kódu → poznámka. Rovnou založ GAPS.md s tím, co vidíš.
1. **Tokeny.** Převeď `bridge.css` proměnné na tokeny v Tailwind theme / design system: barvy, `ink`/`ink2`/`ink3`, rádiusy, typová škála ze spec a `--rowpad` pro density. Bez vizuálních změn komponent.
2. **Rám widgetu.** `tier` (`hero | primary | standard | ambient | collapsed`) a `species` prop, nová hlavička (větný tvar, počet, YOU pilulka, aside, ovládání při hoveru / focusu), hook `useWidgetPriority` podle vzorce ve spec. Drag, resize, J/K a density musí dál fungovat.
3. **Druhy widgetů, jeden po druhém:** Runs (kolejnice) → Project status (dlaždice) → Pull requests (stack list) → Issues → Proposals (rozhodovací karty) → Automation → Budgets → Mentions → Team knowledge → TODO → Quick actions → Pinned.
4. **Briefing hero + layouty** DEFAULT a REVIEW + telefon (jeden sloupec seřazený podle tieru, ostatní jako souhrnné řádky).
5. **Rám sheetu:** hlavička (glyf druhu, kopírovatelné ID, Zpět ze zásobníku, J/K s počítadlem, expand, zavřít), max 1 banner, patička s footerNote. Ukotvení vlevo nebo vpravo podle místa, ztlumení ostatních widgetů.
6. **PR sheet** + PrDiff (strom souborů, ± bary, unified/split, sbalování souborů, inline vlákna, Viewed, skryté generované soubory, upozornění na oříznutí; lazy-load).
7. **Run sheet** + RunRail / RailItem (minulost / přítomnost / budoucnost, smyčka kol, agent, model, routing, checkpointy, klik přepne log), bannery, LIVE/INPUT/OUTPUT, composer.
8. **Kompaktní sheety:** Issue, Task, Automatizace, Stav projektu, Rychlá akce, Poznámka.
9. **Telefon:** PR a Běh jako plné stránky.

## Hotovo znamená (každá fáze)
- typecheck, lint a testy projdou; existující testy neměň jen proto, aby prošly
- žádná funkce nezmizela (projdi MAPPING.md)
- screenshot vedle odpovídajícího screenshotu ze `screenshots/` (přes Playwright, pokud ho projekt má)
- kontrast textu aspoň 4.5:1, ikonová tlačítka mají `aria-label`, ovládání skryté do hoveru je dosažitelné klávesnicí
- GAPS.md aktualizovaný

## Nedělej
- Nekopíruj inline styly ani class názvy z `.dc.html` 1:1. Postav to na existujících primitives a tokenech.
- Nepoužívej mock data z mockupů.
- Neměň API ani datové modely bez dotazu.
- Nepřidávej barvu pro rozlišení typu widgetu. Barva = jen stav.
- Nerozbij: volnou 12sloupcovou mřížku (drag/resize), uložené layouty, J/K, density, detail vedle řádku.
