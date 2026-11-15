# Zibby overlay — HANDOFF

Aktuální stav pro obnovení práce. Přepisuje se při každém milníku.

## Stav (2026-11-15)

- [x] Průzkum, otázky operátorovi, rozhodnutí (DECISIONS.md)
- [x] M1 Kontrakt + backend widgetů (`ChatWidget`, `show_widget`) — commit `2e3b9ca`, pushnuto do main
- [ ] M2 Stavební díly (Sonnet agenti, paralelně, NEcommitují — commituje hlavní model, až všichni doběhnou):
  - [x] B `ZibbyOrb` v DS (`libs/design-system/src/components/ZibbyOrb/`) — hotovo, 9 testů, vizuálně ověřeno
  - [ ] A správa rozhovorů: rename / soft-delete / clear / restore / snippet (kontrakt + API + web hooky ve `features/chat/{queries,mutations}`)
  - [ ] C widget karty: `apps/web/features/zibby/widgets/` + `ChatWidgetCard`, napojení do `ChatMessage`/`ChatTranscript` (`onPrompt`)
  - [ ] E zkratka: `apps/web/features/zibby/shortcut/` (`useZibbyShortcut`, `useZibbyHotkey({onPress,onRelease})`, blok v Nastavení)
  - [ ] D1a DS `ZibbyOverlay` (rám: fáze, let orbu z `origin`, sloty, focus trap, compact/telefon)
  - [ ] D1b DS vlákno + composer: `ZibbyBubble`, `ZibbyThreadEmpty`, `ZibbySuggestions`, `ZibbyPttButton`, `ZibbyComposerBar`, `ZibbyFooter`, `ZibbyAttachmentChip/Row`, `ZibbyChip`
  - [ ] D1c DS historie: `ZibbyTopBar` (+ `ZibbyTopBarMenu`), `ZibbyHistoryPanel`, `ZibbyToast`
  - [ ] D3 hlas: `apps/web/features/zibby/voice/` (`useZibbyVoice`, `useSpaceToTalk`, `deriveOrbState`)
- [ ] M3 Kontejner (po M2): `apps/web/features/zibby/` — `ZibbyOverlayHost` skládá DS díly + engine (`useChatDock`), stav rozhovorů (seskupení Dnes/Včera/…, undo toast), přílohy přes drop kdekoli, chip v hlavičce, origin = uzel motýlku (`BrandMark`)
- [ ] M4 Integrace: odstranit `ChatDock` z `AppShell`, zrušit ⌘J, přepojit volající (`CommandLine`, `DepartmentScreen`, `NoteDock`, `ChatAboutButton`), i18n parita, testy, e2e, `check:lint`/`check:types`, vizuální kontrola v prohlížeči, push do main

## Jak navázat po přerušení

1. `git status` — necommitnutá práce agentů M2 je v pracovním stromu. Ověřit `pnpm exec tsc --noEmit -p apps/web/tsconfig.json`, `-p apps/api/tsconfig.json`, `-p libs/design-system/tsconfig.json` a testy dotčených složek.
2. Před commitem po změně API: `pnpm self-knowledge:generate`; `docs/api/chat.md` musí být součástí commitu, když se mění `apps/api/src/chat/`.
3. Commit → `git push origin HEAD:main`.
4. Pokračovat prvním neodškrtnutým bodem.

## Poznámky

- Test `chat-session.service.test.ts > killTurnProcess` padá i bez našich změn (omezení sandboxu) — ignorovat.
- Agenti nesmí commitovat (lint-staged dělá stash a rozbil by práci ostatních).
