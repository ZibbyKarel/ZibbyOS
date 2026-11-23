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
  html over 2 MB and an unknown `id` (`CanvasStoreError`).
- `GET /api/canvas/:id` → `CanvasMeta` (versions, current) or 404.
- Pages are served by a second plain `node:http` listener on `CANVAS_PORT ?? PORT + 1`, started
  from `main.ts` after `app.listen` (never in `onModuleInit`); `EADDRINUSE` only logs a warning.
  Binds `CANVAS_HOST ?? 127.0.0.1` — the phone reaches it through `tailscale serve`, not the LAN.
  - Host-based: `http://<id>.canvas.localhost:<port>/` (current) and `/v<n>/` — isolated origin.
  - Path-based: `/a/<id>/` and `/a/<id>/v<n>/` — shared origin, so the CSP also carries
    `sandbox allow-scripts allow-modals allow-pointer-lock`.
  - `/__zibby/canvas.js|css` are injected at the start of `<head>` (created if missing).
  - GET/HEAD only (405 otherwise), strict id/version regexes, 404 for everything else; every
    response carries the canvas CSP, `nosniff`, `no-referrer`, `no-store`.
- `canvas.js` bridge: envelope `{v:1,id,type,payload}`; host sends `z:hello` (with a
  `MessageChannel` port), then `z:ping` / `z:visibility`; canvas answers `z:hello-ack`,
  `z:ready`, `z:error` (max 20), `z:pong`, `z:open-url`, `z:key` (Esc, ⌘⇧↵, ⌘\, ⌥Space, ⌥H).
  Standalone (`window === window.top`): `window.zibby.standalone`, links open normally.
