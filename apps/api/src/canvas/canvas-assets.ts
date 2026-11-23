/**
 * The two host files injected into every canvas page (`/__zibby/canvas.css|js`).
 * Inlined as string constants so they ship with plain `tsc` (dev and built API alike).
 * `String.raw` keeps backslashes in the JS verbatim.
 */

export const CANVAS_CSS = String.raw`:root {
  color-scheme: dark;
  --ink: #eceef2;
  --ink2: #a6acb7;
  --ink3: #80868f;
  --line: rgba(255, 255, 255, 0.06);
  --line2: rgba(255, 255, 255, 0.11);
  --p1: #0f1114;
  --p2: #151820;
  --amber: #f5a524;
  --sky: #7dd3fc;
  --violet: #a78bfa;
  --emerald: #34d399;
  --rose: #fb7185;
  --c1: #a78bfa;
  --c2: #7dd3fc;
  --c3: #34d399;
  --font-sans: Geist, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace;
}
html,
body {
  background: transparent;
  color: var(--ink);
  font-family: var(--font-sans);
  overscroll-behavior: contain;
}
`;

export const CANVAS_JS = String.raw`(function () {
  "use strict";
  var standalone = window === window.top;
  var handlers = {};
  var port = null;
  var queue = [];
  var seq = 0;
  var errorCount = 0;
  var MAX_ERRORS = 20;

  function on(type, fn) {
    (handlers[type] = handlers[type] || []).push(fn);
  }

  function resolveUrl(url) {
    try {
      return new URL(String(url), location.href);
    } catch (e) {
      return null;
    }
  }

  function send(type, payload, id) {
    var msg = { v: 1, id: id || "c" + ++seq, type: type, payload: payload || {} };
    if (port) port.postMessage(msg);
    else queue.push(msg);
  }

  function openUrl(url) {
    var u = resolveUrl(url);
    if (!u) return;
    if (standalone) window.open(u.href, "_blank", "noopener");
    else send("z:open-url", { url: u.href });
  }

  window.zibby = { standalone: standalone, openUrl: openUrl, on: on };
  if (standalone) return;

  function dispatch(msg) {
    if (!msg || msg.v !== 1 || typeof msg.type !== "string") return;
    if (msg.type === "z:ping") send("z:pong", {}, msg.id);
    else if (msg.type === "z:visibility")
      window.dispatchEvent(new CustomEvent("zibby:visibility", { detail: msg.payload || {} }));
    else if (msg.type !== "z:hello") return;
    (handlers[msg.type] || []).forEach(function (fn) {
      try {
        fn(msg.payload || {});
      } catch (e) {
        reportError(e && e.message, e && e.stack);
      }
    });
  }

  window.addEventListener("message", function (e) {
    var msg = e.data;
    if (port || e.source !== window.parent || !msg || msg.type !== "z:hello") return;
    if (msg.v !== 1 || !e.ports || !e.ports[0]) return;
    port = e.ports[0];
    port.onmessage = function (ev) {
      dispatch(ev.data);
    };
    port.postMessage({ v: 1, id: msg.id || "c" + ++seq, type: "z:hello-ack", payload: {} });
    queue.splice(0).forEach(function (m) {
      port.postMessage(m);
    });
    dispatch(msg);
  });

  function reportError(message, stack) {
    if (errorCount >= MAX_ERRORS) return;
    errorCount++;
    send("z:error", { message: String(message || "Error"), stack: stack ? String(stack) : undefined });
  }
  // Capture phase also sees resource load failures (a CDN script that 404s doesn't bubble).
  window.addEventListener(
    "error",
    function (e) {
      var t = e.target;
      if (t && t !== window && (t.src || t.href)) reportError("Failed to load " + (t.src || t.href));
      else reportError(e.message, e.error && e.error.stack);
    },
    true,
  );
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    reportError(r && r.message ? r.message : r, r && r.stack);
  });

  if (document.readyState === "complete") send("z:ready");
  else window.addEventListener("load", function () { send("z:ready"); });

  function onLink(e) {
    if (e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var u = resolveUrl(a.getAttribute("href"));
    if (!u) return;
    var here = location.href.split("#")[0];
    if (u.href.split("#")[0] === here || u.origin === location.origin) return;
    e.preventDefault();
    if (u.protocol === "http:" || u.protocol === "https:") openUrl(u.href);
  }
  document.addEventListener("click", onLink, true);
  document.addEventListener("auxclick", onLink, true);

  function isHostKey(e) {
    if (e.key === "Escape") return !e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey;
    if (e.ctrlKey) return false;
    if (e.metaKey && e.shiftKey && !e.altKey) return e.key === "Enter";
    if (e.metaKey && !e.shiftKey && !e.altKey) return e.key === "\\" || e.code === "Backslash";
    if (e.altKey && !e.metaKey && !e.shiftKey) return e.code === "Space" || e.code === "KeyH";
    return false;
  }
  document.addEventListener(
    "keydown",
    function (e) {
      if (e.isComposing || !isHostKey(e)) return;
      e.preventDefault();
      send("z:key", {
        key: e.key,
        code: e.code,
        altKey: e.altKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
      });
    },
    true,
  );
})();
`;
