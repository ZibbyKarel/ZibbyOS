import * as http from "node:http";
import { CANVAS_ID_PATTERN, type CanvasParamValues } from "@zibby/contracts";
import { CANVAS_CSS, CANVAS_JS } from "./canvas-assets";
import type { CanvasStore } from "./canvas.store";

const CSP =
  "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; worker-src blob: 'self'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
/** Path-based pages may be opened top-level → force an opaque origin (no shared storage). */
const PATH_MODE_SANDBOX = "sandbox allow-scripts allow-modals allow-pointer-lock allow-downloads";

const HOST_RE = /^([a-z0-9]{10})\.canvas\.localhost(?::\d+)?$/;
const VERSION_RE = /^v([1-9]\d{0,5})$/;

const INJECT_HEAD =
  '<meta name="color-scheme" content="light dark"><link rel="stylesheet" href="/__zibby/canvas.css">';
const INJECT_JS = '<script src="/__zibby/canvas.js"></script>';

/** JSON safe inside an inline `<script>`: `<` and the JS line separators escaped. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Inject the host files at the start of `<head>` (creating it when missing). */
export function injectCanvasHost(html: string, params: CanvasParamValues = {}): string {
  const INJECT = `${INJECT_HEAD}<script>window.__ZIBBY_PARAMS__=${scriptJson(params)}</script>${INJECT_JS}`;
  const head = /<head(?=[\s>])[^>]*>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + INJECT + html.slice(at);
  }
  const root = /<html(?=[\s>])[^>]*>/i.exec(html);
  const block = `<head>${INJECT}</head>`;
  if (root) {
    const at = root.index + root[0].length;
    return html.slice(0, at) + block + html.slice(at);
  }
  return block + html;
}

interface Target {
  id: string;
  /** `null` → the current version. */
  version: number | null;
}

/** Map host + path to a canvas page; `null` → 404. Strict regexes, nothing is decoded. */
function route(host: string, pathname: string): { target: Target; pathMode: boolean } | null {
  const hostId = HOST_RE.exec(host.toLowerCase())?.[1];
  if (hostId) {
    if (pathname === "/") return { target: { id: hostId, version: null }, pathMode: false };
    const v = /^\/(v[0-9]+)\/?$/.exec(pathname)?.[1];
    const m = v ? VERSION_RE.exec(v) : null;
    return m ? { target: { id: hostId, version: Number(m[1]) }, pathMode: false } : null;
  }
  const m = /^\/a\/([a-z0-9]+)(?:\/(v[0-9]+))?\/?$/.exec(pathname);
  if (!m || !m[1] || !CANVAS_ID_PATTERN.test(m[1])) return null;
  if (m[2] === undefined) return { target: { id: m[1], version: null }, pathMode: true };
  const v = VERSION_RE.exec(m[2]);
  return v ? { target: { id: m[1], version: Number(v[1]) }, pathMode: true } : null;
}

/** The canvas listener: plain `node:http`, a different origin than the API in both modes. */
export function createCanvasServer(store: CanvasStore): http.Server {
  return http.createServer((req, res) => {
    void handle(store, req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
}

async function handle(
  store: CanvasStore,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const send = (
    status: number,
    type: string,
    body: string,
    pathMode = false,
    extra: Record<string, string> = {},
  ) => {
    res.writeHead(status, {
      ...extra,
      "Content-Type": type,
      "Content-Security-Policy": pathMode ? `${CSP}; ${PATH_MODE_SANDBOX}` : CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return send(405, "text/plain; charset=utf-8", "Method Not Allowed");
  }
  const pathname = (req.url ?? "/").split(/[?#]/)[0] ?? "/";
  const download = new URL(req.url ?? "/", "http://x").searchParams.get("download") === "1";
  const notFound = () => send(404, "text/plain; charset=utf-8", "Not Found");

  if (pathname === "/__zibby/canvas.js")
    return send(200, "text/javascript; charset=utf-8", CANVAS_JS);
  if (pathname === "/__zibby/canvas.css") return send(200, "text/css; charset=utf-8", CANVAS_CSS);

  const hit = route(req.headers.host ?? "", pathname);
  if (!hit) return notFound();
  const meta = await store.get(hit.target.id);
  if (!meta) return notFound();
  const version = hit.target.version ?? meta.current;
  const eff = await store.effective(hit.target.id, version);
  if (eff === null) return notFound();
  const extra: Record<string, string> = {};
  if (download) {
    const slug =
      meta.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "canvas";
    extra["Content-Disposition"] = `attachment; filename="${slug}-v${version}.html"`;
  }
  send(
    200,
    "text/html; charset=utf-8",
    injectCanvasHost(eff.html, eff.params),
    hit.pathMode,
    extra,
  );
}
