# Zibby overlay — HANDOFF

Aktuální stav pro obnovení práce. Přepisuje se při každém milníku.

## Stav (2026-11-15)

- [x] Průzkum, otázky operátorovi, rozhodnutí (DECISIONS.md)
- [x] M1 Kontrakt + backend widgetů (`ChatWidget`, `show_widget`) — commit `2e3b9ca`, pushnuto do main
- [x] M2 Stavební díly (Sonnet agenti, paralelně, NEcommitují — commituje hlavní model, až všichni doběhnou):
  - [x] B `ZibbyOrb` v DS (`libs/design-system/src/components/ZibbyOrb/`) — hotovo, 9 testů, vizuálně ověřeno
  - [x] A správa rozhovorů: rename / soft-delete / clear / restore / snippet (kontrakt + API + web hooky ve `features/chat/{queries,mutations}`)
  - [x] C widget karty: `apps/web/features/zibby/widgets/` + `ChatWidgetCard`, napojení do `ChatMessage`/`ChatTranscript` (`onPrompt`)
  - [x] E zkratka: `apps/web/features/zibby/shortcut/` (`useZibbyShortcut`, `useZibbyHotkey({onPress,onRelease})`, blok v Nastavení)
  - [x] D1a DS `ZibbyOverlay` (rám: fáze, let orbu z `origin`, sloty, focus trap, compact/telefon)
  - [x] D1b DS vlákno + composer: `ZibbyBubble`, `ZibbyThreadEmpty`, `ZibbySuggestions`, `ZibbyPttButton`, `ZibbyComposerBar`, `ZibbyFooter`, `ZibbyAttachmentChip/Row`, `ZibbyChip`
  - [x] D1c DS historie: `ZibbyTopBar` (+ `ZibbyTopBarMenu`), `ZibbyHistoryPanel`, `ZibbyToast`
  - [x] D4 stav historie: `apps/web/features/zibby/conversations/` (`useZibbyConversations`, `groupConversations`)
  - [x] D3 hlas: `apps/web/features/zibby/voice/` (`useZibbyVoice`, `useSpaceToTalk`, `deriveOrbState`)
- [x] M3 Kontejner (2026-11-15): `apps/web/features/zibby/ZibbyHost.tsx` skládá DS díly + engine (`useChatDock` — jediný mount), hlas, konverzace, hotkey (tap = přepnout, hold = mluvit; `hooks/useZibbySummon`), drag souborů kamkoli (`hooks/useWindowFileDrag` → `CommandLine.injectedFiles`), chip v hlavičce (`header/ZibbyHeaderChip`, nový slot `zibby` v DS `AppHeader`, na telefonu icon-only v `MobileToolbar`), origin = uzel `BrandMark` (`hooks/knotOrigin`), orb stav odvozen v hostu a publikován chipu (`live/ZibbyLiveContext`). Podsložky: `composer/`, `thread/`, `topbar/`, `history/`, `footer/`, `hooks/`, `live/`, `header/`.
- [x] M4 Integrace (2026-11-15): `ChatDock`, `ChatHistorySidebar`, `ChatButton` smazány; `AppShell` mountuje `ZibbyHost` (+ `ZibbyLiveProvider`); ⌘J zrušeno (`CHAT_SHORTCUT_KEY` pryč); `ChatMessage`/`ChatTranscript` přepsány na `ZibbyBubble` (obsahové díly v `ChatMessageParts.tsx`); `CommandLine` dostal `handleRef` (`submitSpoken`), `injectedFiles`, `bareFrame`; DS `InputFrame bare`; `useChatDock({onTurnComplete,onTurnError})`, `send` vrací id, hydratace je one-shot; i18n skupina `zibby`; e2e `briefing.spec.ts` na Alt+Space; docs (`docs/api/chat.md`, `docs/web/overview.md`).
- [ ] Zbývá: commit + push (dělá hlavní model), vizuální kontrola v reálném prohlížeči s plně funkčním API a mikrofonem (hlasový přepis/TTS jen ověřen s fake mikrofonem), případné úklidové mazání mrtvých i18n klíčů `chat.dock.launcher/history.*/voice.*/trigger*` (nechány).

## Jak navázat po přerušení

1. `git status` — necommitnutá práce agentů M2 je v pracovním stromu. Ověřit `pnpm exec tsc --noEmit -p apps/web/tsconfig.json`, `-p apps/api/tsconfig.json`, `-p libs/design-system/tsconfig.json` a testy dotčených složek.
2. Před commitem po změně API: `pnpm self-knowledge:generate`; `docs/api/chat.md` musí být součástí commitu, když se mění `apps/api/src/chat/`.
3. Commit → `git push origin HEAD:main`.
4. Pokračovat prvním neodškrtnutým bodem.

## Poznámky

- 19:10 UTC: Sonnet agenti spadli na 5h limit, po resetu obnoveni přes SendMessage (pokračují ze svých transkriptů). WIP checkpointy jdou na větev `claude/inspiring-wright-ndxxkg` (`--no-verify`), do `main` jen ověřené milníky.
- `apps/web/vitest.components.config.ts` má explicitní globy — každá nová složka `features/zibby/*` tam musí přibýt, jinak se její testy nespustí.

- Test `chat-session.service.test.ts > killTurnProcess` padá i bez našich změn (omezení sandboxu) — ignorovat.
- Agenti nesmí commitovat (lint-staged dělá stash a rozbil by práci ostatních).
