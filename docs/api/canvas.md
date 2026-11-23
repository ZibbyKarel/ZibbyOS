# Canvas

Chat canvases: small HTML pages the chat agent publishes (`publish_canvas` MCP tool) and the
overlay shows next to the chat in a sandboxed iframe. Plan and security model:
`docs/plans/canvas-embedded-browser.md`. Not the `artifacts` registry.

| Piece      | File                                                                |
| ---------- | ------------------------------------------------------------------- |
| Contract   | `libs/contracts/src/canvas/` (`CanvasMetaSchema`, `canvasContract`) |
| Store      | `apps/api/src/canvas/canvas.store.ts` (`CanvasStore`)               |
| Controller | `apps/api/src/canvas/canvas.controller.ts`                          |
| Listener   | `apps/api/src/canvas/canvas-server.ts` (`createCanvasServer`)       |
| Host files | `apps/api/src/canvas/canvas-assets.ts` (`canvas.js` / `canvas.css`) |

- Storage: `CANVAS_DIR ?? dataDir("canvas")` → `<id>/meta.json`, `<id>/v<n>/index.html`.
  Versions are append-only; all writes are atomic (tmp + rename). `publish` rejects empty html,
  html over 2 MB, an unknown `id` and an invalid manifest (`CanvasStoreError`).
  Extra file: `<id>/grants.json` (granted origins, string array).
- Manifest: optional first `<script type="application/zibby+json">{params, net}</script>` of the page,
  validated by `CanvasManifestSchema` at publish (`bad-manifest`) and stored on the code version.
- Version kinds: `code` (own `v<n>/index.html`, `manifest`, `by:"agent"`) and `params` (meta only:
  `base` = the code version, `params` = the COMPLETE values, `by`). A code version's effective params
  are its manifest defaults. `setParams` validates against the base manifest (declared id, type,
  min/max, select options → `bad-params`) and merges onto the current effective params. An
  operator params edit on top of an operator params version of the same base is coalesced in place
  (one slider drag = one version); agent edits always append. `restore(id, v)` appends a copy
  (code: new `v<n>/index.html`; params: same base + values) as the current version, never deletes.
  All writes go through one queue.
- Routes (`/api`): `GET /canvas/:id`; `POST /canvas/:id/params {params, note?}` (400 invalid, 404);
  `POST /canvas/:id/restore {version}` (404); `POST /canvas/:id/grants {origin}` — operator token
  required (401), origin must be in the CURRENT code version's `net` (400); `POST /canvas/:id/fetch {url}`.
- Fetch proxy (`canvas-fetch.ts`): GET only, `https` only, no cookies/auth (`accept` + a generic
  user-agent). Order of checks: origin in manifest `net` else 403 `not-allowed`; origin granted else 403
  `needs-grant`; `localhost`, `*.localhost`, `*.local`, blocked IP literals or any resolved address
  in 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, 224/3, `::`, `::1`, fc00::/7,
  fe80::/10, ff00::/8 or their `::ffff:` forms → 403 `blocked` (the check runs in the socket's
  `lookup`, so the connection goes to the validated IP). Redirects are not followed blindly: a 3xx
  re-runs all checks on `Location` (max 3, else 502). 10 s timeout, 2 MB body cap, text content
  types only (`text/*`, json, `+json`, xml, `+xml`, javascript); failures → 502.
- `GET /api/canvas/:id` → `CanvasMeta` (versions, current) or 404.
- Pages are served by a second plain `node:http` listener on `CANVAS_PORT ?? PORT + 1`, started
  from `main.ts` after `app.listen` (never in `onModuleInit`); `EADDRINUSE` only logs a warning.
  Binds `CANVAS_HOST ?? 127.0.0.1` — the phone reaches it through `tailscale serve`, not the LAN.
  - Host-based: `http://<id>.canvas.localhost:<port>/` (current) and `/v<n>/` — isolated origin.
  - Path-based: `/a/<id>/` and `/a/<id>/v<n>/` — shared origin, so the CSP also carries
    `sandbox allow-scripts allow-modals allow-pointer-lock allow-downloads`.
  - `/__zibby/canvas.js|css` are injected at the start of `<head>` (created if missing), preceded
    by `<script>window.__ZIBBY_PARAMS__=…</script>` with the served version's effective params
    (`<` and U+2028/2029 escaped). A params version is served as its base html.
  - `?download=1` → same html plus `Content-Disposition: attachment; filename="<title-slug>-v<n>.html"`.
    The path-mode sandbox includes `allow-downloads`.
  - GET/HEAD only (405 otherwise), strict id/version regexes, 404 for everything else; every
    response carries the canvas CSP, `nosniff`, `no-referrer`, `no-store`.
- `canvas.js` bridge: envelope `{v:1,id,type,payload}`; host sends `z:hello` (with a
  `MessageChannel` port), then `z:ping` / `z:visibility`; canvas answers `z:hello-ack`,
  `z:ready`, `z:error` (max 20), `z:pong`, `z:open-url`, `z:key` (Esc, ⌘⇧↵, ⌘\, ⌥Space, ⌥H).
  Theme: `?theme=light|dark` on the page URL (else `prefers-color-scheme`) sets `data-theme` and `window.zibby.theme`.
  Standalone (`window === window.top`): `window.zibby.standalone`, links open normally.
- Phase 2 bridge (`zibby.params/set/on`, `saveState`, `ask`, `propose`, `fetch`, `download`,
  `zibby://` links): host messages `z:params`, `z:reply`; canvas messages `z:params-changed`,
  `z:state`, `z:ask`, `z:propose`, `z:fetch`, `z:download`, `z:open-zibby`. Spec:
  `docs/plans/canvas-embedded-browser.md` → "P3 — bridge".
