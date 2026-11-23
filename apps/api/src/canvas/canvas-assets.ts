/**
 * The two host files injected into every canvas page (`/__zibby/canvas.css|js`).
 * Inlined as string constants so they ship with plain `tsc` (dev and built API alike).
 * `String.raw` keeps backslashes in the JS verbatim.
 */

export const CANVAS_CSS = String.raw`:root,
:root[data-theme="dark"] {
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
}
:root[data-theme="light"] {
  color-scheme: light;
  --ink: #15171b;
  --ink2: #4a4f58;
  --ink3: #686d77;
  --line: rgba(20, 22, 26, 0.09);
  --line2: rgba(20, 22, 26, 0.16);
  --p1: #ffffff;
  --p2: #f0f0ec;
  --amber: #f5a524;
  --sky: #0369a1;
  --violet: #7c3aed;
  --emerald: #047857;
  --rose: #e11d48;
  --c1: #7c3aed;
  --c2: #0369a1;
  --c3: #047857;
}
:root {
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
  var theme = new URLSearchParams(location.search).get("theme");
  if (theme !== "light" && theme !== "dark")
    theme = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  var handlers = {};
  var port = null;
  var queue = [];
  var seq = 0;
  var errorCount = 0;
  var MAX_ERRORS = 20;
  var STATE_MAX = 64 * 1024;
  var DOWNLOAD_MAX = 20 * 1024 * 1024;
  var FETCH_TIMEOUT = 15000;
  var pending = {};

  function on(type, fn) {
    (handlers[type] = handlers[type] || []).push(fn);
  }

  function emit(type, arg) {
    (handlers[type] || []).forEach(function (fn) {
      try {
        fn(arg);
      } catch (e) {
        reportError(e && e.message, e && e.stack);
      }
    });
  }

  function resolveUrl(url) {
    try {
      return new URL(String(url), location.href);
    } catch (e) {
      return null;
    }
  }

  // Returns the envelope id. Standalone has no host: nothing is sent or queued.
  function send(type, payload, id) {
    id = id || "c" + ++seq;
    if (standalone) return id;
    var msg = { v: 1, id: id, type: type, payload: payload || {} };
    if (port) port.postMessage(msg);
    else queue.push(msg);
    return id;
  }

  function openUrl(url) {
    var u = resolveUrl(url);
    if (!u) return;
    if (standalone) window.open(u.href, "_blank", "noopener");
    else send("z:open-url", { url: u.href });
  }

  function copy(o) {
    var out = {};
    if (o && typeof o === "object")
      Object.keys(o).forEach(function (k) {
        out[k] = o[k];
      });
    return out;
  }

  var zibby = {
    standalone: standalone,
    theme: theme,
    openUrl: openUrl,
    on: on,
    params: copy(window.__ZIBBY_PARAMS__),
    state: null,
    set: function (partial) {
      var next = copy(zibby.params);
      var add = copy(partial);
      Object.keys(add).forEach(function (k) {
        next[k] = add[k];
      });
      zibby.params = next;
      emit("params", copy(next));
      send("z:params-changed", { params: copy(next) });
    },
    saveState: function (obj) {
      var json = JSON.stringify(obj);
      if (json !== undefined && json.length > STATE_MAX) throw new Error("State too large (max 64 KB)");
      send("z:state", { state: obj });
    },
    ask: function (text) {
      send("z:ask", { text: String(text).slice(0, 2000) });
    },
    propose: function (p) {
      p = p || {};
      send("z:propose", { title: String(p.title || "").slice(0, 120), prompt: String(p.prompt || "").slice(0, 4000) });
    },
    fetch: function (url) {
      if (standalone) return Promise.reject(new Error("Open in ZibbyOS to use the network"));
      var u = resolveUrl(url);
      if (!u) return Promise.reject(new Error("Invalid URL"));
      return new Promise(function (resolve, reject) {
        var id = send("z:fetch", { url: u.href });
        var timer = setTimeout(function () {
          delete pending[id];
          reject(new Error("timeout"));
        }, FETCH_TIMEOUT);
        pending[id] = { resolve: resolve, reject: reject, timer: timer };
      });
    },
    download: function (filename, data, mime) {
      var bytes;
      var encoding = "utf8";
      var payload = data;
      var type = mime || "application/octet-stream";
      if (typeof data === "string") bytes = new TextEncoder().encode(data);
      else if (Object.prototype.toString.call(data) === "[object ArrayBuffer]") bytes = new Uint8Array(data);
      else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      else throw new Error("download: data must be a string, ArrayBuffer or typed array");
      if (bytes.length > DOWNLOAD_MAX) throw new Error("File too large (max 20 MB)");
      if (typeof data !== "string") {
        var bin = "";
        for (var i = 0; i < bytes.length; i += 0x8000)
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        payload = btoa(bin);
        encoding = "base64";
      }
      if (standalone) {
        var url = URL.createObjectURL(new Blob([bytes], { type: type }));
        var a = document.createElement("a");
        a.href = url;
        a.download = String(filename);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 0);
        return;
      }
      send("z:download", { filename: String(filename), mime: type, data: payload, encoding: encoding });
    },
  };
  window.zibby = zibby;

  function dispatch(msg) {
    if (!msg || msg.v !== 1 || typeof msg.type !== "string") return;
    var payload = msg.payload || {};
    if (msg.type === "z:ping") send("z:pong", {}, msg.id);
    else if (msg.type === "z:visibility")
      window.dispatchEvent(new CustomEvent("zibby:visibility", { detail: payload }));
    else if (msg.type === "z:params") zibby.params = copy(payload.params);
    else if (msg.type === "z:reply") {
      var p = pending[msg.id];
      if (!p) return;
      delete pending[msg.id];
      clearTimeout(p.timer);
      if (payload.ok) p.resolve(payload.result);
      else p.reject(new Error(String(payload.error || "fetch failed")));
      return;
    } else if (msg.type === "z:hello") {
      zibby.state = payload.state === undefined ? null : payload.state;
    } else return;
    emit(msg.type, payload);
    if (msg.type === "z:params") emit("params", copy(zibby.params));
    else if (msg.type === "z:hello") emit("state", zibby.state);
  }

  function reportError(message, stack) {
    if (errorCount >= MAX_ERRORS) return;
    errorCount++;
    send("z:error", { message: String(message || "Error"), stack: stack ? String(stack) : undefined });
  }

  function onLink(e) {
    if (e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var u = resolveUrl(a.getAttribute("href"));
    if (!u) return;
    if (u.protocol === "zibby:") {
      e.preventDefault();
      send("z:open-zibby", { href: u.href });
      return;
    }
    if (standalone) return;
    var here = location.href.split("#")[0];
    if (u.href.split("#")[0] === here || u.origin === location.origin) return;
    e.preventDefault();
    if (u.protocol === "http:" || u.protocol === "https:") openUrl(u.href);
  }
  document.addEventListener("click", onLink, true);
  document.addEventListener("auxclick", onLink, true);

  if (standalone) return;

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
