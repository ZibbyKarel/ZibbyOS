"use client";

import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type CanvasBridgeStatus = "loading" | "ready" | "error" | "unresponsive";

export interface CanvasKeyPayload {
  key: string;
  code: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface CanvasPageError {
  message: string;
  stack?: string;
}

export interface UseCanvasBridgeOptions {
  frameRef: RefObject<HTMLIFrameElement | null>;
  /** The iframe's URL; its origin is the only `postMessage` target. */
  src: string;
  /** A ZibbyOS shortcut pressed inside the page (`z:key`). */
  onKey?: (key: CanvasKeyPayload) => void;
  /** Confirm text for `z:open-url` (shows the full URL). */
  confirmOpenUrl: (url: string) => string;
  /** Resolved app theme, sent in `z:hello`. */
  theme?: "light" | "dark";
  /** Saved page state for `z:hello` (`zibby.state`). */
  getState?: () => unknown;
  onParamsChanged?: (params: CanvasParamValues) => void;
  onState?: (state: unknown) => void;
  onAsk?: (text: string) => void;
  onPropose?: (proposal: { title: string; prompt: string }) => void;
  /** `z:fetch`: resolve with the response, or reject (the page gets `{ok:false,error}`). */
  onFetch?: (url: string) => Promise<CanvasFetchResult>;
  onDownload?: (file: CanvasDownload) => void;
  onOpenZibby?: (href: string) => void;
}

export type CanvasParamValues = Record<string, number | string | boolean>;

export interface CanvasFetchResult {
  status: number;
  contentType: string;
  body: string;
}

export interface CanvasDownload {
  filename: string;
  mime: string;
  data: string;
  encoding: "utf8" | "base64";
}

export const LOAD_TIMEOUT_MS = 10_000;
export const PING_EVERY_MS = 2_000;
export const PONG_WITHIN_MS = 5_000;
export const MAX_ERRORS = 50;
const MAX_STATE_CHARS = 64 * 1024;
/** 20 MB of bytes is ~27 M base64 chars. */
const MAX_DOWNLOAD_CHARS = 28_000_000;

/** Hostnames the operator already allowed to open from a canvas, for this session. */
const allowedHosts = new Set<string>();

/** Test hook: forget the session's allowed hostnames. */
export function resetAllowedCanvasHosts(): void {
  allowedHosts.clear();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asKey(payload: unknown): CanvasKeyPayload | null {
  if (!isRecord(payload) || typeof payload.key !== "string" || typeof payload.code !== "string") {
    return null;
  }
  return {
    key: payload.key,
    code: payload.code,
    altKey: payload.altKey === true,
    metaKey: payload.metaKey === true,
    ctrlKey: payload.ctrlKey === true,
    shiftKey: payload.shiftKey === true,
  };
}

function asParams(raw: unknown): CanvasParamValues | null {
  if (!isRecord(raw)) return null;
  const out: CanvasParamValues = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[k] = v;
    else if (typeof v === "string" && v.length <= 500) out[k] = v;
    else return null;
  }
  return out;
}

function asDownload(p: Record<string, unknown>): CanvasDownload | null {
  const { filename, mime, data, encoding } = p;
  if (typeof filename !== "string" || typeof data !== "string") return null;
  if (data.length > MAX_DOWNLOAD_CHARS) return null;
  if (encoding !== "utf8" && encoding !== "base64") return null;
  return {
    filename: filename.slice(0, 300),
    mime: typeof mime === "string" && mime.length <= 100 ? mime : "application/octet-stream",
    data,
    encoding,
  };
}

/** `z:open-url`: http/https only, confirmed once per hostname per session, then a new window. */
function openUrl(raw: unknown, confirmText: (url: string) => string): void {
  if (typeof raw !== "string") return;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (!allowedHosts.has(url.hostname)) {
    if (!window.confirm(confirmText(url.href))) return;
    allowedHosts.add(url.hostname);
  }
  window.open(url.href, "_blank", "noopener,noreferrer");
}

/**
 * Host side of the canvas bridge (see `apps/api/src/canvas/canvas-assets.ts`). On each iframe
 * `load` it hands the page a `MessageChannel` port via `z:hello` (target = the exact origin of
 * `src`, never `*`); from then on only the port is used. Tracks `loading → ready` (10 s timeout →
 * `error`), page errors, liveness (ping every 2 s, no pong for 5 s → `unresponsive`), and relays
 * `z:open-url` / `z:key` / document visibility.
 */
export function useCanvasBridge(options: UseCanvasBridgeOptions) {
  const { frameRef, src, confirmOpenUrl } = options;
  const [status, setStatus] = useState<CanvasBridgeStatus>("loading");
  const [errors, setErrors] = useState<CanvasPageError[]>([]);
  const portRef = useRef<MessagePort | null>(null);
  const seqRef = useRef(0);
  // Latest options/callbacks without re-running the effect.
  const optsRef = useRef(options);
  const confirmRef = useRef(confirmOpenUrl);
  useEffect(() => {
    optsRef.current = options;
    confirmRef.current = confirmOpenUrl;
  });

  /** Host → page message over the port (no-op until the handshake). */
  const post = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    portRef.current?.postMessage({ v: 1, id: `h${++seqRef.current}`, type, payload });
  }, []);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let origin: string;
    try {
      const url = new URL(src, window.location.href);
      // Path-based canvases run without allow-same-origin (CSP sandbox too), so their origin is
      // opaque and a concrete targetOrigin would never match. "*" still only reaches this
      // frame's window; the port it carries can do nothing without the operator's confirm.
      origin = url.hostname.endsWith(".canvas.localhost") ? url.origin : "*";
    } catch {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new page starts from scratch
    setStatus("loading");
    setErrors([]);

    let port: MessagePort | null = null;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let ready = false;
    let lastPong = 0;

    const stopTimers = () => {
      clearTimeout(loadTimer);
      clearInterval(pingTimer);
    };
    const send = (type: string, payload: Record<string, unknown> = {}) =>
      port?.postMessage({ v: 1, id: `h${++seqRef.current}`, type, payload });

    /** `z:fetch`: answer with the request's own envelope id. */
    const handleFetch = (id: unknown, rawUrl: unknown) => {
      const target = port;
      const reply = (payload: Record<string, unknown>) =>
        target?.postMessage({ v: 1, id, type: "z:reply", payload });
      const onFetch = optsRef.current.onFetch;
      if (typeof id !== "string" || !target) return;
      if (typeof rawUrl !== "string" || rawUrl.length > 2048 || !onFetch) {
        reply({ ok: false, error: "Network is not available" });
        return;
      }
      onFetch(rawUrl).then(
        (result) => reply({ ok: true, result }),
        (err: unknown) =>
          reply({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    };

    const onMessage = (event: MessageEvent) => {
      const msg: unknown = event.data;
      if (!isRecord(msg) || msg.v !== 1 || typeof msg.type !== "string") return;
      const payload = isRecord(msg.payload) ? msg.payload : {};
      const o = optsRef.current;
      switch (msg.type) {
        case "z:ready":
          if (ready) return;
          ready = true;
          clearTimeout(loadTimer);
          lastPong = Date.now();
          setStatus("ready");
          // ponytail: checked on the ping tick, so detection lags up to one interval.
          pingTimer = setInterval(() => {
            if (Date.now() - lastPong > PONG_WITHIN_MS) setStatus("unresponsive");
            send("z:ping");
          }, PING_EVERY_MS);
          break;
        case "z:pong":
          lastPong = Date.now();
          setStatus((s) => (s === "unresponsive" ? "ready" : s));
          break;
        case "z:error":
          if (typeof payload.message !== "string") return;
          setErrors((prev) =>
            [
              ...prev,
              {
                message: payload.message as string,
                stack: typeof payload.stack === "string" ? payload.stack : undefined,
              },
            ].slice(-MAX_ERRORS),
          );
          break;
        case "z:open-url":
          openUrl(payload.url, confirmRef.current);
          break;
        case "z:key": {
          const key = asKey(payload);
          if (key) o.onKey?.(key);
          break;
        }
        case "z:params-changed": {
          const params = asParams(payload.params);
          if (params) o.onParamsChanged?.(params);
          break;
        }
        case "z:state":
          if (
            payload.state !== undefined &&
            (JSON.stringify(payload.state) ?? "").length <= MAX_STATE_CHARS
          ) {
            o.onState?.(payload.state);
          }
          break;
        case "z:ask":
          if (typeof payload.text === "string" && payload.text.trim()) {
            o.onAsk?.(payload.text.slice(0, 2000));
          }
          break;
        case "z:propose":
          if (typeof payload.title === "string" && typeof payload.prompt === "string") {
            if (payload.prompt.trim()) {
              o.onPropose?.({
                title: payload.title.slice(0, 120),
                prompt: payload.prompt.slice(0, 4000),
              });
            }
          }
          break;
        case "z:fetch":
          handleFetch(msg.id, payload.url);
          break;
        case "z:download": {
          const file = asDownload(payload);
          if (file) o.onDownload?.(file);
          break;
        }
        case "z:open-zibby":
          if (typeof payload.href === "string" && payload.href.length <= 500) {
            o.onOpenZibby?.(payload.href);
          }
          break;
        default:
          break; // z:hello-ack and anything unknown
      }
    };

    const onLoad = () => {
      const target = frame.contentWindow;
      if (!target) return;
      port?.close();
      stopTimers();
      ready = false;
      setStatus("loading");
      const channel = new MessageChannel();
      port = channel.port1;
      portRef.current = port;
      port.onmessage = onMessage;
      loadTimer = setTimeout(() => setStatus("error"), LOAD_TIMEOUT_MS);
      target.postMessage(
        {
          v: 1,
          id: "h0",
          type: "z:hello",
          payload: {
            theme: optsRef.current.theme ?? "dark",
            lang: document.documentElement.lang || "cs",
            state: optsRef.current.getState?.() ?? null,
          },
        },
        origin,
        [channel.port2],
      );
    };

    const onVisibility = () => {
      lastPong = Date.now();
      send("z:visibility", { state: document.hidden ? "hidden" : "visible" });
    };

    frame.addEventListener("load", onLoad);
    document.addEventListener("visibilitychange", onVisibility);
    // The first `load` may already be pending; the timeout also covers a page that never loads.
    loadTimer = setTimeout(() => setStatus("error"), LOAD_TIMEOUT_MS);
    return () => {
      frame.removeEventListener("load", onLoad);
      document.removeEventListener("visibilitychange", onVisibility);
      stopTimers();
      port?.close();
      portRef.current = null;
    };
  }, [frameRef, src]);

  const reload = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    setStatus("loading");
    setErrors([]);
    // Re-assigning `src` reloads even when the value is unchanged; `load` re-runs the handshake.
    frame.src = src;
  }, [frameRef, src]);

  return { status, errors, reload, post };
}
