# Zibby overlay — MEMORY

Trvalá fakta pro každého, kdo na tomhle pokračuje (i po resetu kontextu).

## Kde co je

- Design (stažený z artifactu): `design/zibby/` — `Zibby.dc.html` (spec), `Bridge Redesign.dc.html` (živý overlay: hledej `zsummon`, `zcardEl`, `zmsgEl`, třídy `.zl .zcol .zth .zc .zh`), `zibby.css`, `orb.js`, `orb.css`.
- Starý chat (nahrazovaný): `apps/web/features/chat/` — `ChatDock.tsx` (UI), `useChatDock.ts` (engine), `ChatContext.tsx` (stav + zkratka), `ChatMessage.tsx`, `ChatRunCard.tsx`, `ChatHistorySidebar.tsx`, hlas v `hooks/`.
- Shell: `apps/web/components/layout/AppShell/AppShell.tsx` (mountuje `ChatProvider` + `ChatDock`).
- Kontrakt: `libs/contracts/src/chat/` (`chat.schema.ts`, `chat.contract.ts`).
- API: `apps/api/src/chat/` — `chat-session.service.ts` (turn loop, tool eventy), `chat-mcp.controller.ts` (MCP nástroje modelu), `chat-tool-result.registry.ts` (most MCP → turn), `chat-transcript.store.ts` (soubory rozhovorů), `chat-persona.ts` (prompt).
- Dashboard widgety k znovupoužití dat: `apps/web/features/bridge/widgets/`.

## Prostředí

- `pnpm` (ne npm). `rtk` a `graphify` v tomhle cloud kontejneru **nejsou** — volat příkazy bez `rtk`, `graphify update` přeskočit.
- Validace po editaci: `pnpm exec prettier --write <f>`, `pnpm exec eslint --fix <f>`, `pnpm exec vitest run <path> --project web` (viz CLAUDE.md).
- V `apps/web` žádné inline `style`, žádné vlastní Tailwind třídy — skládat z DS. Testy přes `data-testid` enum.
- i18n: `apps/web/i18n/messages/{cs,en}.json`, default `cs`.

## Pravidla práce

- Push přímo do `main` (potvrzeno operátorem 2026-11-15). Commity malé, po každé dokončené části.
- Po každém milníku aktualizovat `HANDOFF.md`.
