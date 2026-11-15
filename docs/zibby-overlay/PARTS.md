# Zibby overlay — PARTS (API stavebních dílů)

Referenční tahák pro skládání kontejneru (M3). Zdroj pravdy je kód; tohle je mapa.

## Design system (`@zibby/design-system`)

Všechny díly: `data-testid` prop, `<Name>TestId` enum, bez `className`, ref-as-prop.

- **`ZibbyOrb`** — `state?: ZibbyOrbState` (sleep|ready|wake|listen|think|search|work|speak|needs|done|error|paused), `size?` (px, 64), `level?` (0–1), `label?`. Export i `ZIBBY_ORB_STATES`.
- **`ZibbyOverlay`** — rám. `open`, `onOpenChange`, `onPhaseChange?(closed|summoning|open|leaving)`, `origin?: {x,y}|null` (viewport px, odkud orb letí), `orb` (box 140 px), `label`, `topBar?`, `history?` + `historyOpen?` + `onHistoryOpenChange?` + `historyLabel?`, `status?`, `live?`, `hint?`, `thread`, `scrollKey?`, `suggestions?`, `attachments?`, `composer`, `footer?`, `toast?`, `dropActive?` + `dropTitle?` + `dropHint?`, `onFilesDrop?(File[])`, `onDragActiveChange?`, `compact?` (telefon).
  - Fokus při otevření: prvek s atributem `ZIBBY_OVERLAY_AUTOFOCUS_ATTR` (`data-zibby-autofocus`), jinak první focusable v composeru.
  - Esc/backdrop: nejdřív zavře historii, pak overlay; ignoruje `defaultPrevented`.
  - z-index 50 (jako Dialog) kvůli DS menu portálům.
- **`ZibbyTopBar`** — `title`, `onRename?(next)`, `renaming?` + `onRenamingChange?`, `historyOpen`, `onHistoryToggle`, `historyLabel?`, `historyKbd?`, `historyControls?`, `renameHint?`, `titleInputLabel?`, `actions?`.
- **`ZibbyTopBarMenu`** — `items: {id?, label, icon?, onSelect, disabled?, danger?}[]`, `label?`, `icon?`.
- **`ZibbyIconButton`** — `icon`, `label`, `size?: md|sm|xs`, `mirror?`.
- **`ZibbyHistoryPanel`** — `title?`, `count?`, `closeLabel?` + `onClose?`, `newLabel?` + `onNew?`, `searchLabel?`, `searchPlaceholder?`, `clearSearchLabel?`, `query`, `onQueryChange`, `groups: {label, items: {id,title,time,snippet?,active?}[]}[]`, `emptyLabel?`, `onOpen(id)`, `onRename?(id,next)`, `onDelete?(id)`, `renamingId?` + `onRenamingIdChange?`, `renameLabel?(title)`, `deleteLabel?(title)`, `renameInputLabel?`, `footer?`.
- **`ZibbyToast`** — `message`, `actionLabel?`, `onAction?`.
- **`ZibbyBubble`** — `author: "me"|"zibby"`, `children`; me: `attachments?`, `meta?`, `onEdit?`, `editLabel?`; zibby: `avatar?` (28 px), `streaming?`, `cards?`, `actions?`.
- **`ZibbyThreadEmpty`** — `children`. **`ZibbySuggestions`** — `lead?`, `items: {label, onSelect, icon?, lead?}[]`, `label?`.
- **`ZibbyPttButton`** — `mode?: hold|tap`, `size?: md|lg` (lg = 76 px telefon), `active?`, `level?`, `onTalkStart?`, `onTalkEnd?`, `label` (povinný), `children?`, `disabled?`.
- **`ZibbyComposerBar`** — `leading?`, `children?`, `trailing?`, `label?`. **`ZibbyComposerInput`** — holý input.
- **`ZibbyFooter`** — `start?`, `end?`.
- **`ZibbyAttachmentChip`** — `name`, `kind?: image|pdf|code|sheet|file`, `src?`, `sizeLabel?`, `onRemove?`, `removeLabel?`. **`ZibbyAttachmentRow`** — `children`, `align?: start|end`, `label?`.
- **`ZibbyChip`** (tlačítko v hlavičce) — `orb?` (20 px), `children`, `kbd?`, `label` (povinný) + atributy buttonu.

## Web (`apps/web/features/zibby/`)

- **`shortcut/`** — `useZibbyShortcut()` → `{shortcut, setShortcut, reset, isDefault}`; `useZibbyHotkey({enabled?, onPress, onRelease({heldMs})})` (window capture; při vypnutí uprostřed držení `onRelease` NEzavolá); `ZibbyShortcutKbd`; `formatShortcut`, `useShortcutPlatform`. Blok v Nastavení: `features/settings/components/ZibbyShortcutSection.tsx`. i18n skupina `zibbyShortcut`.
- **`conversations/`** — `useZibbyConversations({busy})` → `activeId, activeTitle, count, query, setQuery, groups, loading, open, startNew, rename, clearActive, remove, toast{message, undo?}, dismissToast, busy`. Musí být uvnitř `ChatProvider`. `busy` = `thinking` z `useChatDock()`; při busy jsou open/startNew/clearActive/remove(active) no-op. i18n skupina `zibbyConversations` (`toast.undo` = „Vrátit“).
- **`voice/`** — viz kód (`useZibbyVoice`, `useSpaceToTalk`, `deriveOrbState`).
- **`widgets/`** — `ChatWidgetCard({widget, onPrompt?})`; napojeno v `features/chat/components/ChatMessage.tsx` / `ChatTranscript.tsx` (prop `onPrompt`).

## API (`/api/chat`)

`renameConversation` PATCH `/conversations/:id` `{title}` · `deleteConversation` DELETE · `clearConversation` POST `…/clear` · `restoreConversation` POST `…/restore` · `listConversations?q=` vrací `snippet`. Hooky: `features/chat/mutations/use{Rename,Delete,Clear,Restore}ChatConversationMutation`.

## Známé díry k dořešení v M3/M4

- `useChatDock` hydratuje aktivní vlákno ze serveru jednou za mount — po smazání aktivního rozhovoru ověřit, že remount nepřevezme serverový výběr.
- Ikony `panel`, `sync`, `chevron-left` v DS chybí (použity `layout`, `retry`, zrcadlený `chevron`).
- Toast v rámu sedí 118 px nad spodkem sloupce — může překrýt řádek návrhů.
