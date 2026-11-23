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
}

export const LOAD_TIMEOUT_MS = 10_000;
export const PING_EVERY_MS = 2_000;
export const PONG_WITHIN_MS = 5_000;
export const MAX_ERRORS = 50;

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
export function useCanvasBridge({ frameRef, src, onKey, confirmOpenUrl }: UseCanvasBridgeOptions) {
  const [status, setStatus] = useState<CanvasBridgeStatus>("loading");
  const [errors, setErrors] = useState<CanvasPageError[]>([]);
  // Latest callbacks without re-running the effect.
  const onKeyRef = useRef(onKey);
  const confirmRef = useRef(confirmOpenUrl);
  useEffect(() => {
    onKeyRef.current = onKey;
    confirmRef.current = confirmOpenUrl;
  });

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
    let seq = 0;

    const stopTimers = () => {
      clearTimeout(loadTimer);
      clearInterval(pingTimer);
    };
    const post = (type: string, payload: Record<string, unknown> = {}) =>
      port?.postMessage({ v: 1, id: `h${++seq}`, type, payload });

    const onMessage = (event: MessageEvent) => {
      const msg: unknown = event.data;
      if (!isRecord(msg) || msg.v !== 1 || typeof msg.type !== "string") return;
      const payload = isRecord(msg.payload) ? msg.payload : {};
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
            post("z:ping");
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
          if (key) onKeyRef.current?.(key);
          break;
        }
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
      port.onmessage = onMessage;
      loadTimer = setTimeout(() => setStatus("error"), LOAD_TIMEOUT_MS);
      target.postMessage(
        {
          v: 1,
          id: "h0",
          type: "z:hello",
          payload: { theme: "dark", lang: document.documentElement.lang || "cs" },
        },
        origin,
        [channel.port2],
      );
    };

    const onVisibility = () => {
      lastPong = Date.now();
      post("z:visibility", { state: document.hidden ? "hidden" : "visible" });
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

  return { status, errors, reload };
}
