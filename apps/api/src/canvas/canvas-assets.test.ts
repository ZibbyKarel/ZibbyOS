// @vitest-environment node
// @ts-expect-error -- jsdom ships no types and @types/jsdom is not installed
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CANVAS_JS } from "./canvas-assets";

interface Msg {
  v: number;
  id: string;
  type: string;
  payload: Record<string, unknown>;
}
interface Zibby {
  standalone: boolean;
  params: Record<string, unknown>;
  state: unknown;
  on(type: string, fn: (p: unknown) => void): void;
  set(p: Record<string, unknown>): void;
  fetch(url: string): Promise<unknown>;
  download(name: string, data: unknown, mime?: string): void;
  saveState(o: unknown): void;
  ask(t: string): void;
  propose(p: { title: string; prompt: string }): void;
}
type Win = Window & {
  Event: typeof Event;
  MouseEvent: typeof MouseEvent;
  zibby: Zibby;
  eval(s: string): unknown;
  __ZIBBY_PARAMS__?: unknown;
};

function standalonePage(params?: unknown): Win {
  const win = new JSDOM("<!doctype html><body></body>", {
    runScripts: "outside-only",
    url: "http://localhost/c/x",
  }).window as unknown as Win;
  if (params) win.__ZIBBY_PARAMS__ = params;
  win.eval(CANVAS_JS);
  return win;
}

/** A canvas page inside an iframe, wired to a fake host port (messages it posts land in `sent`). */
function framedPage(params?: unknown) {
  const parent = new JSDOM("<!doctype html><iframe></iframe>", { runScripts: "outside-only" })
    .window;
  const frame = parent.document.querySelector("iframe") as HTMLIFrameElement;
  const win = frame.contentWindow as unknown as Win;
  win.setTimeout = globalThis.setTimeout; // so fake timers apply
  win.clearTimeout = globalThis.clearTimeout;
  (win as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
  if (params) win.__ZIBBY_PARAMS__ = params;
  win.eval(CANVAS_JS);
  const sent: Msg[] = [];
  const port: { postMessage(m: Msg): void; onmessage: ((e: { data: unknown }) => void) | null } = {
    postMessage: (m) => void sent.push(m),
    onmessage: null,
  };
  const hello = (state: unknown = null) => {
    const ev = new win.Event("message") as Event & Record<string, unknown>;
    Object.assign(ev, {
      source: win.parent,
      ports: [port],
      data: { v: 1, id: "h1", type: "z:hello", payload: { theme: "dark", lang: "cs", state } },
    });
    win.dispatchEvent(ev);
  };
  const host = (type: string, payload: object, id = "s1") =>
    port.onmessage?.({ data: { v: 1, id, type, payload } });
  return { win, sent, hello, host };
}

describe("CANVAS_JS", () => {
  it("is String.raw safe", () => {
    expect(CANVAS_JS).not.toContain("`");
    expect(CANVAS_JS).not.toContain("${");
  });

  it("standalone exposes the full API with params", async () => {
    const win = standalonePage({ a: 1 });
    expect(win.zibby.standalone).toBe(true);
    expect(win.zibby.params).toEqual({ a: 1 });
    const fn = vi.fn();
    win.zibby.on("params", fn);
    win.zibby.set({ b: 2 });
    expect(win.zibby.params).toEqual({ a: 1, b: 2 });
    expect(fn).toHaveBeenCalledWith({ a: 1, b: 2 });
    await expect(win.zibby.fetch("https://x.test/")).rejects.toThrow("Open in ZibbyOS");
    expect(() => win.zibby.ask("hi")).not.toThrow();
  });

  describe("framed", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("hello sets state and set() posts params-changed", () => {
      const { win, sent, hello } = framedPage({ a: 1 });
      const onState = vi.fn();
      win.zibby.on("state", onState);
      hello({ n: 5 });
      expect(win.zibby.state).toEqual({ n: 5 });
      expect(onState).toHaveBeenCalledWith({ n: 5 });
      expect(sent[0]?.type).toBe("z:hello-ack");
      win.zibby.set({ a: 3 });
      const m = sent.find((x) => x.type === "z:params-changed");
      expect(m?.payload).toEqual({ params: { a: 3 } });
    });

    it("z:params replaces params and fires handler", () => {
      const { win, hello, host } = framedPage({ a: 1 });
      hello();
      const fn = vi.fn();
      win.zibby.on("params", fn);
      host("z:params", { params: { a: 9 } });
      expect(win.zibby.params).toEqual({ a: 9 });
      expect(fn).toHaveBeenCalledWith({ a: 9 });
    });

    it("fetch resolves on z:reply with the same id, rejects on error and timeout", async () => {
      const { win, sent, hello, host } = framedPage();
      hello();
      const ok = win.zibby.fetch("https://api.test/x");
      const req = sent.find((x) => x.type === "z:fetch") as Msg;
      expect(req.payload).toEqual({ url: "https://api.test/x" });
      host(
        "z:reply",
        { ok: true, result: { status: 200, contentType: "text/plain", body: "hi" } },
        req.id,
      );
      await expect(ok).resolves.toEqual({ status: 200, contentType: "text/plain", body: "hi" });

      const bad = win.zibby.fetch("https://api.test/y");
      const req2 = sent.filter((x) => x.type === "z:fetch")[1] as Msg;
      expect(req2.id).not.toBe(req.id);
      host("z:reply", { ok: false, error: "nope" }, req2.id);
      await expect(bad).rejects.toThrow("nope");

      const slow = win.zibby.fetch("https://api.test/z");
      const assertion = expect(slow).rejects.toThrow("timeout");
      vi.advanceTimersByTime(15_001);
      await assertion;
    });

    it("zibby:// link click posts z:open-zibby", () => {
      const { win, sent, hello } = framedPage();
      hello();
      win.document.body.innerHTML = '<a id="l" href="zibby://runs/abc">run</a>';
      const ev = new win.MouseEvent("click", { bubbles: true, cancelable: true });
      win.document.getElementById("l")?.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
      expect(sent.find((x) => x.type === "z:open-zibby")?.payload).toEqual({
        href: "zibby://runs/abc",
      });
    });

    it("download: string is utf8, bytes are base64, oversize throws", () => {
      const { win, sent, hello } = framedPage();
      hello();
      win.zibby.download("a.txt", "héllo", "text/plain");
      win.zibby.download("b.bin", new Uint8Array([104, 105]).buffer);
      const d = sent.filter((x) => x.type === "z:download");
      expect(d[0]?.payload).toEqual({
        filename: "a.txt",
        mime: "text/plain",
        data: "héllo",
        encoding: "utf8",
      });
      expect(d[1]?.payload).toEqual({
        filename: "b.bin",
        mime: "application/octet-stream",
        data: "aGk=",
        encoding: "base64",
      });
      expect(() => win.zibby.download("big", new Uint8Array(20 * 1024 * 1024 + 1))).toThrow();
    });

    it("saveState, ask and propose send capped payloads", () => {
      const { win, sent, hello } = framedPage();
      hello();
      win.zibby.saveState({ a: 1 });
      expect(() => win.zibby.saveState("x".repeat(64 * 1024))).toThrow();
      win.zibby.ask("q".repeat(3000));
      win.zibby.propose({ title: "t".repeat(200), prompt: "p" });
      expect(sent.find((x) => x.type === "z:state")?.payload).toEqual({ state: { a: 1 } });
      expect((sent.find((x) => x.type === "z:ask")?.payload.text as string).length).toBe(2000);
      expect((sent.find((x) => x.type === "z:propose")?.payload.title as string).length).toBe(120);
    });
  });
});
