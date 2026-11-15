# Zibby overlay — DECISIONS

Rozhodnutí k náhradě chat docku overlayem „Zibby“. Nejnovější dole. Neměnit zpětně — přidat nový záznam.

## Zadání operátora (2026-11-15)

- Design: artifact „ZibbyCorp“, stránky `Zibby.dc.html` (spec + orb) a `Bridge Redesign.dc.html` (živý overlay). Referenční soubory: `zibby.css`, `orb.js`, `orb.css`.
- Zibby **kompletně nahrazuje** současný chat (ChatDock) — musí umět vše, co dock.
- Vyvolání z jakékoli stránky nastavitelnou zkratkou, default **⌥ Space** (Win/Linux Ctrl Space).
- Inline **chat widgety** (karty) ve vlákně.
- Doručení: **push přímo do `main`** (operátor výslovně potvrdil, bez PR).
- Práce: Sonnet subagenti píší většinu kódu; hlavní model drží architekturu, kontrakt, integraci a review.

## Rozsah v1 (potvrzeno operátorem)

Parita s dockem (mentions, #scope, /skill, přílohy, model, about, hand-off na úkol, diktování, historie, briefing karta, run karta) **plus**:

1. Hlas push-to-talk (drž Space, pusť = odešle), hands-free, přerušení řeči, TTS odpovědi + ztlumení.
2. Správa rozhovorů: přejmenování, smazání a vyčištění s „Vrátit“ (5 s), fulltext se zvýrazněním, skupiny Dnes/Včera/Tento týden/Starší.
3. Animace vyvolání z motýlku (850 ms let, blur pozadí, rázová vlna, návrat).
4. Telefon: fullscreen varianta.

Widgety: běhy, pull requesty, issues (zadání) + schválení, úkoly, briefing, zmínky, stav projektu, CI (vybráno). Rozpočet/limity **ne**.

## D-1 Widget = reference, ne snapshot

`ChatWidget` (discriminated union `kind`) nese jen `kind` + id/filtry. Karta si živá data načte existujícími query hooky → soubory zůstávají zdrojem pravdy, karta je vždy aktuální a interaktivní.

## D-2 Widget cestuje v `ChatToolEvent.widget`

Žádný nový SSE typ ani pole zprávy: `ChatToolEvent` dostal volitelné `widget`. Tím ho zdarma nese SSE `tool` event, perzistence (`toolEvents` v transcriptu) i klientský stream.

## D-3 Model widget vyvolá MCP nástrojem `show_widget`

Handler zvaliduje vstup a pushne widget do `ChatToolResultRegistry`; běžící turn ho emituje jako tool event `{ name: "show_widget", status: "ok", callId: "w-…", widget }`. Generický „ok“ event pro `show_widget` ze stream řádku se potlačuje (jinak by byl dvakrát). `create_task` dál dává run kartu přes `runRef` (beze změny).

## D-4 Stav zůstává v `ChatContext`, ne zustand

Spec zmiňuje zustand `useZibby`; repo zustand nemá a `ChatProvider` už drží vše potřebné. Rozšiřujeme ho (API `open`/`openAbout`/`dockOpen` zůstává kvůli existujícím volajícím), nový UI kód žije v `apps/web/features/zibby/`, engine (`useChatDock`, stream, mutace) se znovupoužije z `features/chat`.

## D-5 Orb je DS komponenta `ZibbyOrb`

Brand prvek použitý v hlavičce, vlákně i overlayi → `libs/design-system`. Port `orb.js` (canvas 2D, sdílený rAF), API `<ZibbyOrb state size level />`.

## D-6 Mazání rozhovoru je soft-delete

„Irreversible deletes“ je Never-rule → smazání přesouvá soubory rozhovoru do koše na disku (obnovitelné přes `restore`); „Vyčistit“ uloží snapshot. Undo v UI = volání restore.

## D-7 Zkratka ⌘/Ctrl+J končí

Nahrazuje ji nastavitelná zkratka Zibbyho (default Alt+Space; na ne-Mac i Ctrl+Space). Uložení viz HANDOFF (rozhodne agent podle existujícího settings úložiště).

## D-8 Zkratka se ukládá v localStorage (`zibby-shortcut`)

Stejně jako téma/pohyb (`state/appearance.tsx`): zkratka je per-prohlížeč a per-OS (⌥ na Macu, Ctrl+Space jinde, kolize se liší stroj od stroje), takže do sdíleného `SystemConfig` nepatří. Vědomá odchylka od „files are source of truth“; případný přesun = pole `zibbyShortcut` v `SystemConfig`. Kolizní varování neblokuje uložení. Na ne-Macu platí při výchozím nastavení i alias Ctrl+Space.

## D-9 Koš rozhovorů

`<chatDir>/.trash/<conversationId>/` (delete přesouvá, clear kopíruje). Druhý snapshot téhož id starší složku přejmenuje na `.trash/<id>.<epoch-ms>/` — API ji neobnoví, ale na disku zůstává. Id rozhovoru se validuje (`isValidConversationId`), neplatné → 404.
