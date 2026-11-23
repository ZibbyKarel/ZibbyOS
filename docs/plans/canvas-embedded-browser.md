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

# Phase 2

Parameters, a controlled network, downloads, page → chat actions, versions, export.
Same process: P1 contracts → (P2 API ∥ P3 bridge ∥ P5 DS ∥ P6 desktop) → (P4 MCP ∥ P7 web).
File ownership: P2 = `canvas.store.ts`, `canvas-server.ts`, `canvas-fetch.ts`, `canvas.controller.ts`,
their tests, `apps/api/test/canvas.e2e.test.ts`, `docs/api/canvas.md`; P3 = `canvas-assets.ts` only
(the conductor documents the bridge). Subagents never commit and lint only the files they touch.

## Phase 2 decisions
- **Manifest** — optional `<script type="application/zibby+json">{…}</script>` in the page,
  parsed at publish (first match, JSON, validated by `CanvasManifestSchema`; invalid →
  `CanvasStoreError("bad-manifest")`). Stored on the code version in `meta.json`.
- **Two version kinds** — `code` (a new `v<n>/index.html`, as today) and `params` (meta only:
  `base` = the code version it applies to, `params` = the COMPLETE effective values). A code
  version's effective params = its manifest defaults. The listener serves a params version as
  its base html. UI label is computed (`v2`, `v2.1`, `v2.2` — params versions count up per base).
- **Params reach the page** as `<script>window.__ZIBBY_PARAMS__=<json, "<" escaped as <></script>`
  injected right before `canvas.js` (inline scripts are already allowed by the CSP).
- **Restore** never deletes: it appends a copy of the chosen version as the new current one.
- **Network** stays `connect-src 'none'`. `zibby.fetch(url)` goes page → host → API proxy:
  origin must be in the manifest `net` AND granted by the operator (per canvas, `grants.json`).
- **Gate** — page-initiated chat actions never send on their own: `ask` only prefills the
  composer; `propose` shows a banner the operator approves (then it's an operator message).
  "Fix it" (errors) is an operator click → sends the error log.
- **Operator token** on `POST /canvas/:id/grants` only (`requireOperatorTokenIf(true, …)`): the
  chat agent has Bash and could curl the API, so a grant must prove it came from the operator's
  UI (the web client sends the token on every request). params/restore/fetch stay open — the agent
  can already set params via MCP and has its own network.
- **Page-authored text never becomes an operator message unseen**: `ask` and "Fix it" prefill the
  composer (the operator presses Enter); `propose` shows the FULL prompt in the banner before
  Approve sends it.
- Deferred (phase 3): snapshot thumbnails, own Electron window/protocol, PDF/PNG export,
  pin to Knowledge/Goal, history filter, version hover preview, live `z:theme`, warm-kept
  iframes, FLIP/light-line animations. And TODO #17.

## Contract (P1, `libs/contracts/src/canvas/`)
```ts
CanvasParamSchema = z.object({
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
  label: z.string().min(1).max(60),
  type: z.enum(["number", "text", "boolean", "select"]),
  unit: z.string().max(12).optional(),
  min: z.number().optional(), max: z.number().optional(), step: z.number().positive().optional(),
  options: z.array(z.string().min(1).max(60)).max(30).optional(),   // select only
  value: z.union([z.number(), z.string().max(500), z.boolean()]),  // the default
});
CanvasParamValuesSchema = z.record(z.string(), z.union([z.number(), z.string().max(500), z.boolean()]));
CanvasManifestSchema = z.object({
  params: z.array(CanvasParamSchema).max(40).default([]),
  // https origins only; transformed to `new URL(x).origin` so store, proxy and web compare one string
  net: z.array(z.string().url().refine(u => u.startsWith("https://")).transform(u => new URL(u).origin)).max(10).default([]),
});
CanvasVersionSchema += {
  kind: z.enum(["code", "params"]).default("code"),
  base: z.number().int().min(1).optional(),       // params only
  params: CanvasParamValuesSchema.optional(),     // params only (complete values)
  manifest: CanvasManifestSchema.optional(),      // code only, when the page has one
  by: z.enum(["agent", "operator"]).optional(),
}
CanvasFetchResultSchema = z.object({ status: z.number().int(), contentType: z.string(), body: z.string() }); // text only
CanvasFetchDeniedSchema = z.object({ error: z.enum(["not-allowed", "needs-grant", "blocked"]), origin: z.string() });
```
Routes (all `pathPrefix "/api"`, `strictStatusCodes`):
- `getCanvas` (exists).
- `setCanvasParams` `POST /canvas/:id/params` body `{ params: CanvasParamValues, note? }` →
  200 CanvasMeta | 400 | 404. Merges onto the current effective params; every value is checked
  against the base manifest (declared id, type, min/max, select options) → else 400. `by:"operator"`.
  Coalescing: when the latest version is already a `by:"operator"` params version on the same
  base, it is updated in place (params + `at`) instead of appending — a slider drag is one version.
- `restoreCanvasVersion` `POST /canvas/:id/restore` body `{ version }` → 200 CanvasMeta | 404.
- `grantCanvasOrigin` `POST /canvas/:id/grants` body `{ origin }` → 200 `{ grants: string[] }` | 400 (not in manifest `net`) | 401 (no operator token) | 404.
- `canvasFetch` `POST /canvas/:id/fetch` body `{ url }` → 200 CanvasFetchResult | 403 CanvasFetchDenied | 404 | 502 Error.

## P2 — API (`apps/api/src/canvas/`)
- Store: `parseManifest(html)`; `publish` records `manifest` on code versions, `by:"agent"`;
  `setParams(id, values, {note, by})`; `restore(id, version)`; `effective(id, version) →
  {html, params} | null` (params version → base html); `grants(id)` / `grant(id, origin)`
  (`<id>/grants.json`, atomic). All writes through the existing queue.
- Listener: injects the params script; `?download=1` → same html with
  `Content-Disposition: attachment; filename="<slug>-v<n>.html"` (export). Path-mode sandbox
  gains `allow-downloads`.
- Fetch proxy (`canvas-fetch.ts`): GET only, http(s) only, `URL.origin` in manifest `net` of the
  CURRENT code version → else `not-allowed`; not granted → `needs-grant`; resolve DNS and refuse
  `https.request` with a custom `lookup` that resolves and REJECTS loopback / 0.0.0.0/8 /
  private / link-local 169.254/16 / CGNAT 100.64/10 / ULA fc00::/7 / fe80::/10 / `::ffff:`-mapped
  forms of those / `.local` / `localhost` → `blocked` (the socket connects to the validated IP, so
  no DNS rebinding window); redirects not followed automatically — a 3xx re-runs the full check on
  `Location` (max 3); 10 s timeout; body cap 2 MB (stream + abort); no cookies/credentials/auth
  headers; text responses only (`text/*`, json, xml, csv, javascript) else 502. Unit tests incl.
  SSRF cases (lookup stubbed).
- e2e: params/restore/grants/fetch-denied routes.

## P3 — bridge (`canvas-assets.ts`, `CANVAS_JS`)
New `window.zibby` API (standalone fallbacks in brackets):
- `params` (from `__ZIBBY_PARAMS__`), `on("params", fn)` fired on host `z:params {params}`.
- `set(partial)` → updates `zibby.params`, fires `params` locally, sends `z:params-changed {params}` [local only].
- `state` + `on("state", fn)` from `z:hello` payload `state`; `saveState(obj)` → `z:state {state}` (JSON ≤ 64 KB, else throws) [no-op].
- `ask(text)` → `z:ask {text ≤ 2000}` [no-op]. `propose({title, prompt})` → `z:propose` [no-op].
- `fetch(url)` → Promise; `z:fetch {url}`, resolved by host `z:reply {ok, result|error}` with the
  SAME envelope id; 15 s timeout [rejects "Open in ZibbyOS to use the network"].
- `download(filename, data, mime)` — string or ArrayBuffer/Uint8Array (→ base64); ≤ 20 MB →
  `z:download {filename, mime, data, encoding:"utf8"|"base64"}` [anchor + Blob download].
- Link clicks on `zibby://…` → `z:open-zibby {href}` [ignored].
Host → canvas: `z:hello {theme, lang, state}`, `z:params {params}`, `z:reply`, plus existing.

## P4 — MCP (`apps/api/src/chat/chat-mcp.controller.ts`)
- `set_canvas_params {id, params, note?}` → store.setParams(by:"agent") → pushWidget (new version) → text.
- `get_canvas {id}` → manifest params + current effective values + version list (labels, notes).
- Both in the skip lists / persona like `publish_canvas`. `publish_canvas` description documents
  the manifest, `zibby.params/set/on`, `fetch` + `net`, `download`, `ask`/`propose`, `saveState`, `zibby://`.

## P5 — DS (`CanvasPanel`, `CanvasCard`)
- `CanvasPanel` new optional props: `versions: {key, label, at, note?, current}[]`,
  `viewingKey`, `onViewVersion(key)`, `onRestoreVersion(key)` (a "Viewing v2 · Restore" strip
  when `viewingKey` isn't current); `banner: {title, body?, confirmLabel, onConfirm, onDismiss}`
  (proposal / network grant); `previewWidth: "phone"|"tablet"|"full"` + `onPreviewWidthChange`
  (frame max-width 390 / 820 / none, centered); `onFixErrors` (button next to the error count);
  `onExport`. Labels as props with English defaults. TestIds for each.
- `CanvasCard`: `loading="lazy"` on the thumbnail iframe.

## P6 — desktop
- `will-frame-navigate`: deny a SUBFRAME navigation whose current URL is a canvas origin
  (`*.canvas.localhost:<CANVAS_PORT>` or `localhost:<CANVAS_PORT>/a/`) to anything off that
  origin (same canvas `/v<n>/` reloads stay allowed). Unit-test the predicate.

## P7 — web
- `features/canvas/queries/useCanvasQuery.ts` + mutations (`useSetCanvasParamsMutation`,
  `useRestoreCanvasVersionMutation`, `useGrantCanvasOriginMutation`, `useCanvasFetchMutation`).
- `useCanvasBridge` gains: `post(type, payload)`; handlers `onParamsChanged`, `onState`,
  `onAsk`, `onPropose`, `onFetch(url) → Promise<result>` (replies `z:reply` with the request id),
  `onDownload`, `onOpenZibby`; `z:hello` payload carries `state` (and the real theme).
- `ZibbyCanvasPanel`: versions menu from `useCanvasQuery`; params changed → debounced 1.5 s
  POST params; state → module-level `Map<canvasId, state>`; ask → prefill composer
  (`injectedText`); propose → banner showing title AND the full prompt, confirm → `sendMessage(prompt)`; fetch → API; on
  `needs-grant` → banner "Canvas wants to read from <origin>" → grant → retry; download → Blob +
  anchor (filename sanitised); open-zibby → `router.push` for `zibby://<segment>/<rest>` with
  segment in the dashboard segment list; fix errors → prefill composer with the error log as a quoted block; export →
  open `<path url>?download=1`; preview width state.
- Live params: keep the iframe's LOADED code version (`frameVersion`) separate from
  `canvas.version`. A new `params` version with the same `base`: `by:"agent"` → post `z:params`,
  `by:"operator"` → nothing (the page already has it); neither reloads. Any other new version →
  load its src.
- i18n `zibby.canvas.*` (cs + en).
