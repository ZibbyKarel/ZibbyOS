# Zibby overlay — HANDOFF

Aktuální stav pro obnovení práce. Přepisuje se při každém milníku.

## Stav (2026-11-15) — HOTOVO, v `main`

- [x] M1 Kontrakt + backend widgetů (`ChatWidget`, `show_widget`)
- [x] M2 Stavební díly (DS `Zibby*`, widget karty, zkratka, hlas, stav rozhovorů, API správy rozhovorů)
- [x] M3 Kontejner `apps/web/features/zibby/ZibbyHost.tsx` + chip v hlavičce
- [x] M4 Integrace: `ChatDock`, `ChatHistorySidebar`, `ChatButton` a zkratka ⌘/Ctrl+J odstraněny; `AppShell` mountuje `ZibbyHost`

API dílů: `PARTS.md`. Rozhodnutí: `DECISIONS.md`.

## Ověřeno

- `pnpm check:types`, `pnpm check:lint` (0 chyb), `node tools/check-names.mjs`.
- `pnpm test`: 9908 prošlo, 30 selhalo — vše v `apps/api` mimo chat (workflows, backup, system-config, ai-providers, review-learning). `system-config` a `ai-providers` padají stejně i bez těchto změn; zbytek nebyl proti základu porovnán jednotlivě, ale žádný z těch souborů se neměnil.
- V prohlížeči (Chromium, sandbox, API s podvrženým rozhovorem): otevření ⌥ Space, let orbu, vlákno s kartami všech druhů (prázdné stavy), historie, menu, Esc, drop souborů, telefon 390×844.

## NEověřeno (chybí v sandboxu)

- Skutečná odpověď modelu a to, že model sám volá `show_widget` (není tu backend modelu).
- Hlas se skutečným mikrofonem: STT, TTS, auto-čtení odpovědí, přerušení.
- Karty s reálnými daty (v sandboxu jsou všechny seznamy prázdné) a tlačítka Schválit/Zamítnout na kartě schválení.
- Playwright e2e sada (`pnpm e2e`) — upraven jen `e2e/briefing.spec.ts`, nespuštěno.

## Otevřené body

1. Vložení souborů ze schránky nefunguje (`CommandLine` nemá paste handler) — nebylo ani v docku.
2. Diktát během běžícího tahu se neodešle, vloží se do konceptu.
3. Druhý drop souborů nahradí první sadu; nad 10 souborů se tiše ořízne.
4. Mrtvé i18n klíče: `chat.dock.launcher`, `chat.history.*`, `chat.voice.*`, `chat.trigger*`, `chat.composer.listening`.
5. Toast může překrýt řádek návrhů / patičku historie.
6. Zmínky nemají deep-link na položku (karta vede na `/activity/channels`); karta CI ukazuje sledované zdroje, ne jednotlivé běhy.
7. Zamítnutí na kartě schválení je na jeden klik (dashboard potvrzuje dialogem).
8. `speakLevel` je vždy 0 (orb při řeči animuje bez amplitudy TTS).
9. Zkratka je v localStorage, ne v souboru (D-8).
