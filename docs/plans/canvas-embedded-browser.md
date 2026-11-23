# Canvas — embedded browser next to the chat (MVP)

Source design: Claude Design artifact "Zibby — artefakty vedle chatu" (Sklo + Rozevření).
Code name is **canvas** (the existing `artifacts` resource is the workflow-delivery registry —
do not touch or reuse it).

## Decisions

- A canvas is a small HTML page the chat agent publishes through a new MCP tool
  `publish_canvas`. The chat agent cannot write files (Write/Edit are hidden), so the tool takes
  the HTML as input and the API writes it.
- Storage: `CANVAS_DIR ?? dataDir("canvas")` → `<id>/meta.json` + `<id>/v<n>/index.html`.
  A new version is a new folder; old ones never change. `id` = 10 chars `[a-z0-9]`
  (subdomain-safe).
- Serving: a **second HTTP listener** (plain `node:http`) on `CANVAS_PORT ?? PORT + 1`
  (dev 3334, desktop 4334), started from `apps/api/src/main.ts` after `app.listen` — never in
  `onModuleInit`, so the ~90 e2e boots don't bind it.
  - Host-based (desktop/localhost): `http://<id>.canvas.localhost:<port>/v<n>/` — every canvas
    its own origin, iframe gets `allow-same-origin`.
  - Path-based (phone / remote host): `http://<host>:<port>/a/<id>/v<n>/` — shared origin, so the
    iframe never gets `allow-same-origin`; the phone opens it top-level in the system browser.
  - Different port = different origin from ZibbyOS in both modes.
- Web derives the canvas origin like `API_URL` does: remote (page not on localhost) →
  `NEXT_PUBLIC_REMOTE_CANVAS_URL` (e.g. a second `tailscale serve` port → 4334; unset → no
  phone link, card says "open on the Mac"), else `NEXT_PUBLIC_CANVAS_URL ?? <API_URL port + 1>`.
  localhost → host-based isolated URL, otherwise path-based. Add both to `apps/web/.env.example`.
- Phone: no split. Card in the thread + the latest canvas of the conversation pinned as a small
  thumbnail at the right edge; tap opens the system browser.
- Thumbnail = the live page in a scaled, non-interactive, lazy iframe without
  `allow-same-origin` (no snapshot pipeline yet).
- App is dark-only today → host injects dark tokens; no `z:theme` message yet.

## Security (all MVP)

- Canvas server headers:
  `Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; worker-src blob: 'self'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`.
  On path-based (`/a/…`) responses the CSP also carries `sandbox allow-scripts allow-modals
  allow-pointer-lock` so a page opened top-level on the phone gets an opaque origin (no shared
  storage between canvases). Only GET/HEAD. Strict `id`/version regex → no path traversal. Only `index.html` + the two
  injected host files (`/__zibby/canvas.js`, `/__zibby/canvas.css`) are served.
- iframe: `sandbox="allow-scripts allow-pointer-lock allow-modals"` + `allow-same-origin` only in
  host-based mode; `allow="fullscreen; clipboard-write"`. No top-navigation, popups, forms,
  downloads.
- Bridge: host posts `z:hello` with a `MessageChannel` port to the exact canvas origin (host-based;
  path-based frames have an opaque origin, so `*` aimed at that frame's window); after that only the port is used. Host accepts window messages only from
  `iframe.contentWindow` + the expected origin. Envelope `{ v: 1, id, type, payload }`, unknown
  types dropped.
- Electron: `permissions.ts` already denies everything to non-`WEB_ORIGIN` origins. External
  links from the canvas go through the bridge (`z:open-url`); the host allows only
  `http:`/`https:`, shows a confirm with the full URL visible (per domain, remembered for the
  session) and only then opens a new window → existing `setWindowOpenHandler` sends it to the
  system browser. Without the confirm `openUrl` would be an exfil path around
  `connect-src 'none'`.
- Known ceiling (ponytail): the iframe can still navigate itself to an external URL (sandbox
  without top-navigation does not stop self-navigation) — that is the same exfil class; phase 2
  closes it (Electron `will-frame-navigate` / host reload on unexpected `load`).

## Execution
T1 → (T2 ∥ T3 ∥ T6) → (T4 ∥ T5) → Opus review (T2 server + bridge reviewed by the orchestrator).
Work on `main`. Subagents do not commit; the orchestrator commits each wave with
`git commit -- <paths>` (unrelated `package.json` change in the tree stays out). No push
without asking.

## Tasks

### T1 — contracts (`libs/contracts`)
- `src/canvas/canvas.schema.ts`: `CANVAS_ID_PATTERN = /^[a-z0-9]{10}$/`,
  `CanvasVersionSchema {version: int>=1, at: iso, note?: string}`,
  `CanvasMetaSchema {id, title, conversationId?, versions: CanvasVersion[], current: int}`.
- `src/canvas/canvas.contract.ts`: `GET /api/canvas/:id` → 200 `CanvasMeta` / 404.
  Wire into the root contract like `artifacts`. Contract test next to it.
- `src/chat/chat.schema.ts`: add `"canvas"` to `CHAT_WIDGET_KINDS` and a variant
  `{kind: "canvas", id, version, title}` to `ChatWidgetSchema` (additive/optional only).
  Fix the exhaustive `switch` in `apps/web/features/zibby/widgets/ChatWidgetCard.tsx` with a
  temporary `case "canvas": return null;` so the build stays green until T7.

### T2 — API canvas module + server (`apps/api/src/canvas/`)
- `canvas.store.ts` (`CanvasStore`, Nest provider): `publish({title, html, conversationId?,
  id?, note?}) → CanvasMeta` (new id or next version of existing id; reject html > 2 MB, empty
  html, unknown id), `get(id)`, `readHtml(id, version)`. Dir from `resolveCanvasDir()`.
- `canvas.controller.ts` implementing the T1 contract; `canvas.module.ts` exporting the store;
  register in `AppModule`.
- `canvas-server.ts`: `createCanvasServer(store) → http.Server`. Routes:
  host `<id>.canvas.localhost` → `/` (current) and `/v<n>/`; path `/a/<id>/` and
  `/a/<id>/v<n>/`; `/__zibby/canvas.js|css` (both modes, also `/a/<id>/__zibby/...` is NOT
  needed — inject absolute `/__zibby/...` URLs). Injects
  `<meta name="color-scheme" content="dark"><link rel=stylesheet href="/__zibby/canvas.css"><script src="/__zibby/canvas.js"></script>`
  at the start of `<head>` (create `<head>` if missing). 404 otherwise. Headers per Security.
- `canvas-assets/canvas.css`: transparent `html,body` background, `color-scheme: dark`,
  `overscroll-behavior: contain`, the design tokens (`--ink --ink2 --ink3 --line --line2 --p1
  --p2 --amber --sky --violet --emerald --rose --c1 --c2 --c3`, values from the DS dark theme),
  Geist font stack.
- `canvas-assets/canvas.js` (plain ES2020, no build): `window.zibby` bridge.
  Standalone = `window === window.top` (no timer). Embedded: waits for `z:hello` (window
  message, checks `event.source === parent`) carrying a port, replies `z:hello-ack` on the port;
  messages raised before the port arrives (`z:ready`, errors) are queued and flushed. Sends
  `z:ready` on `load`, `z:error` on
  `window.onerror`/`unhandledrejection` (message + stack, rate-limited), answers `z:ping` with
  `z:pong`, handles `z:visibility` (dispatches `zibby:visibility` event). Intercepts clicks on
  `<a href>` with a different origin → `z:open-url`; `zibby.openUrl(url)` same.
  Forwards ZibbyOS shortcuts pressed inside the canvas as `z:key` (Esc, ⌘⇧↵, ⌘\\, ⌥Space,
  ⌥H) and `preventDefault`s them; all other keys stay in the page.
  **Standalone mode**: `zibby.standalone = true`, external links open normally.
- `main.ts`: after `app.listen`, `createCanvasServer(app.get(CanvasStore)).listen(canvasPort)`;
  log the URL; on `EADDRINUSE` log a warning and keep the API running.
- Tests: store unit test, server test via supertest on the raw server (routes, injection,
  headers, traversal, 404), controller e2e like `test/artifacts.e2e.test.ts` with `CANVAS_DIR`.

### T3 — DS (`libs/design-system`)
- `ZibbyOverlay`: new optional slots `side` (desktop) and `pinned` (compact/phone), and props
  `sideMode: "split" | "full"`, `sideRatio` (0.35–0.65, default 0.5), `onSideRatioChange`.
  With `side`: column becomes left part (no `mx-auto w-[740px]`), panel on the right, a
  draggable divider (pointer events, transparent shield over the panel while dragging so the
  iframe does not swallow the mouse). `full`: panel spans the overlay below the top bar, column
  hidden (`inert`). History still overlays from the left. CSS transitions on transform/opacity
  (≈420–620 ms, `cubic-bezier(.2,.8,.2,1)`), `prefers-reduced-motion` → 150 ms fade.
  Esc order: history → full → side (call new `onSideDismiss(mode)`), then overlay.
  Include `iframe` in the Tab-trap focusable selector. Visual language ("Sklo") from the mockup
  `Zibby Artefakty.dc.html` (path given in the task) — glass panel, edge, header.
- `CanvasPanel`: glass panel `role="region"` labelled by title. Header ("address bar"): title,
  version chip, status (`loading | ready | error | unresponsive`), error-count badge, actions
  Reload, Open in browser, Full/Back, Close (all labelled, English defaults, props for i18n).
  Body renders the `<iframe>` from props `src`, `sandbox`, `allow`, `frameRef`, `title`;
  overlays for `error` / `unresponsive` with action slots.
- `CanvasCard`: card for the thread — scaled live thumbnail iframe (`src`,
  `pointer-events:none`, `loading="lazy"`, `sandbox="allow-scripts"`), title, version, either
  `onOpen` (button) or `href` (anchor, `target="_blank" rel="noopener"`). `size="pin"` variant
  for the phone pinned thumbnail.
- TestId enums, tests, stories per the DS skill.

### T4 — chat MCP tool (`apps/api/src/chat/`)
- `publish_canvas` in `chat-mcp.controller.ts` (pattern: `show_widget`): input
  `{title, html, id?, note?}` → `CanvasStore.publish` (conversationId from the turn) →
  `toolResults.pushWidget(conversationId, {kind:"canvas", id, version, title})`; returns
  `{id, version}` text so the model can publish v2 with the same `id`.
- `grep -rn show_widget apps/api/src libs/contracts/src` first and mirror every place it is
  listed (persona tool list, opencode prompt, skip lists). Add it to the skip list at `chat-session.service.ts` (`if (name === "show_widget" || …)`).
- Exclude `"canvas"` from the `show_widget` kind enum.
- Tool description = the authoring rules: only content (host draws the chrome); never set
  background on html/body/large containers; colours only from the tokens; fluid layout
  480–1400 px, no `100vw/100vh`/fixed widths; libraries only from jsdelivr/unpkg/cdnjs at an
  exact version; no `fetch` (network is blocked); three.js `alpha:true`,
  `setClearColor(0,0)`, pause on `zibby:visibility` hidden; to change a canvas pass its `id`.
  One line in `chat-persona.ts` that canvas exists for visual/interactive answers.
- Import `CanvasModule` in `ChatModule`. Unit test in `chat-mcp.controller.test.ts`.

### T5 — web (`apps/web`)
- `features/canvas/canvasUrl.ts` (+test): `canvasOrigin()` / `canvasUrl(id, version)` /
  `canvasIsolated()` from `API_URL` (localhost → host-based + isolated, else path-based).
- `features/canvas/useCanvasBridge.ts` (+test): given `frameRef` + expected origin: posts
  `z:hello` with port on iframe load, status `loading → ready`, 10 s load timeout → `error`,
  `z:error` → error list, ping every 2 s / 5 s → `unresponsive`, `z:open-url` →
  confirm (http/https only, full URL shown) then `window.open(url, "_blank", "noopener")`,
  `z:key` → same handlers as the window shortcuts, sends `z:visibility`. Returns
  `{status, errors, reload}`.
- `ChatContext`: `canvas: {id, version, title} | null`, `canvasMode: "split" | "full"`,
  `openCanvas`, `closeCanvas`, `setCanvasMode`. Close on conversation switch.
- `features/zibby/widgets/CanvasWidgetCard.tsx` (replace the T1 `null` case): desktop
  `onOpen` → `openCanvas`; phone `href = canvasUrl(...)` (path-based).
- `features/zibby/ZibbyCanvasPanel.tsx`: `CanvasPanel` + `useCanvasBridge`; Open in browser
  uses the path-based URL.
- `ZibbyHost.tsx`: pass `side` / `sideMode` / ratio (persist in localStorage, try/catch) /
  `onSideDismiss`; phone → `pinned` = `CanvasCard size="pin"` of the latest canvas widget in
  `messages`. Shortcuts: ⌘⇧↵ full/back, ⌘\ close/reopen last canvas.
- i18n keys in `cs.json` + `en.json`.

### T6 — desktop
- `config.ts`: `CANVAS_PORT = 4334`; pass `CANVAS_PORT` to the API child env; include it in the
  port-taken check. Verify an iframe to `*.canvas.localhost:4334` is not blocked by
  `externalLinks.ts` (subframe navigation isn't routed by `will-navigate`).

## Phase 2 (not now)
`zibby.params`/`z:params` + manifest, `zibby.fetch` via host allowlist, `z:ask`/`z:propose` as
action cards, downloads, versions menu + param-only versions, warm/suspended iframes,
snapshot thumbnails, FLIP animations + light line, Electron own window/protocol, width preview,
export, `zibby://` links, light theme. And TODO #17 (chat-widget details in the overlay).
