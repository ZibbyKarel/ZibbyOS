import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOAD_TIMEOUT_MS,
  MAX_ERRORS,
  type UseCanvasBridgeOptions,
  resetAllowedCanvasHosts,
  useCanvasBridge,
} from "./useCanvasBridge";

const SRC = "http://abc1234567.canvas.localhost:3334/v1/";
const realSetTimeout = globalThis.setTimeout;
/** Real-time pause so MessagePort deliveries (not faked) land. */
const deliver = () => new Promise((r) => realSetTimeout(r, 10));

function setup(extra: Partial<UseCanvasBridgeOptions> = {}) {
  const onKey = vi.fn();
  const frame = document.createElement("iframe");
  const postMessage = vi.fn();
  Object.defineProperty(frame, "contentWindow", { value: { postMessage } });
  document.body.append(frame);
  const frameRef = { current: frame };
  const hook = renderHook(() =>
    useCanvasBridge({ frameRef, src: SRC, onKey, confirmOpenUrl: (u) => u, ...extra }),
  );
  /** Fire `load` and return the page's end of the channel. */
  const load = (): MessagePort => {
    act(() => {
      frame.dispatchEvent(new Event("load"));
    });
    return postMessage.mock.calls.at(-1)![2][0] as MessagePort;
  };
  const send = async (page: MessagePort, type: string, payload: unknown = {}, id = "c1") => {
    page.postMessage({ v: 1, id, type, payload });
    await act(deliver);
  };
  return { frame, postMessage, hook, load, send, onKey };
}

describe("useCanvasBridge", () => {
  beforeEach(() => {
    resetAllowedCanvasHosts();
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("posts z:hello to the exact origin with a port, then goes ready on z:ready", async () => {
    const { postMessage, hook, load, send } = setup();
    expect(hook.result.current.status).toBe("loading");
    const page = load();
    const [msg, origin] = postMessage.mock.calls[0]!;
    expect(origin).toBe("http://abc1234567.canvas.localhost:3334");
    expect(msg).toMatchObject({ v: 1, type: "z:hello", payload: { theme: "dark" } });
    await send(page, "z:ready");
    expect(hook.result.current.status).toBe("ready");
    page.close();
  });

  it("errors when no z:ready arrives within 10 s", () => {
    const { hook, load } = setup();
    load();
    act(() => {
      vi.advanceTimersByTime(LOAD_TIMEOUT_MS + 1);
    });
    expect(hook.result.current.status).toBe("error");
  });

  it("collects z:error (capped) and drops malformed envelopes", async () => {
    const { hook, load, send } = setup();
    const page = load();
    page.postMessage({ v: 2, type: "z:error", payload: { message: "nope" } });
    page.postMessage("garbage");
    page.postMessage({ v: 1, type: 5 });
    for (let i = 0; i < MAX_ERRORS + 5; i++) await send(page, "z:error", { message: `e${i}` });
    expect(hook.result.current.errors).toHaveLength(MAX_ERRORS);
    expect(hook.result.current.errors.at(-1)?.message).toBe(`e${MAX_ERRORS + 4}`);
    page.close();
  });

  it("marks unresponsive without pong and recovers on pong", async () => {
    const { hook, load, send } = setup();
    const page = load();
    await send(page, "z:ready");
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(hook.result.current.status).toBe("unresponsive");
    await send(page, "z:pong");
    expect(hook.result.current.status).toBe("ready");
    page.close();
  });

  it("opens only http(s) urls, confirming once per hostname", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { load, send } = setup();
    const page = load();
    await send(page, "z:open-url", { url: "javascript:alert(1)" });
    await send(page, "z:open-url", { url: "https://example.com/a" });
    await send(page, "z:open-url", { url: "https://example.com/b" });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith("https://example.com/a");
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith("https://example.com/a", "_blank", "noopener,noreferrer");
    confirm.mockReturnValue(false);
    await send(page, "z:open-url", { url: "https://other.test/" });
    expect(open).toHaveBeenCalledTimes(2);
    page.close();
  });

  it("forwards z:key to onKey", async () => {
    const { load, send, onKey } = setup();
    const page = load();
    await send(page, "z:key", { key: "Escape", code: "Escape" });
    expect(onKey).toHaveBeenCalledWith(expect.objectContaining({ key: "Escape", altKey: false }));
    page.close();
  });

  it("hello carries the real theme and the saved state", () => {
    const { postMessage, load } = setup({ theme: "light", getState: () => ({ n: 1 }) });
    load();
    expect(postMessage.mock.calls[0]![0].payload).toMatchObject({
      theme: "light",
      state: { n: 1 },
    });
  });

  it("replies to z:fetch with the request id (ok and error)", async () => {
    const onFetch = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, contentType: "text/plain", body: "hi" })
      .mockRejectedValueOnce(new Error("denied"));
    const { load, send } = setup({ onFetch });
    const page = load();
    const replies: { id: string; payload: unknown }[] = [];
    page.onmessage = (e) => {
      if (e.data.type === "z:reply") replies.push(e.data);
    };
    await send(page, "z:fetch", { url: "https://a.test/x" }, "f1");
    await send(page, "z:fetch", { url: "https://a.test/y" }, "f2");
    await act(deliver);
    expect(onFetch).toHaveBeenCalledWith("https://a.test/x");
    expect(replies).toEqual([
      { v: 1, id: "f1", type: "z:reply", payload: { ok: true, result: expect.anything() } },
      { v: 1, id: "f2", type: "z:reply", payload: { ok: false, error: "denied" } },
    ]);
    page.close();
  });

  it("answers z:fetch with an error when there is no handler", async () => {
    const { load, send } = setup();
    const page = load();
    const got = new Promise<{ payload: unknown }>((r) => {
      page.onmessage = (e) => e.data.type === "z:reply" && r(e.data);
    });
    await send(page, "z:fetch", { url: "https://a.test/" }, "f9");
    expect((await got).payload).toMatchObject({ ok: false });
    page.close();
  });

  it("forwards params-changed / state / ask / propose / download / open-zibby, validated", async () => {
    const h = {
      onParamsChanged: vi.fn(),
      onState: vi.fn(),
      onAsk: vi.fn(),
      onPropose: vi.fn(),
      onDownload: vi.fn(),
      onOpenZibby: vi.fn(),
    };
    const { load, send } = setup(h);
    const page = load();
    await send(page, "z:params-changed", { params: { a: 1, b: "x", c: true } });
    await send(page, "z:params-changed", { params: { a: { nested: 1 } } });
    await send(page, "z:state", { state: { k: "v" } });
    await send(page, "z:state", { state: "x".repeat(70_000) });
    await send(page, "z:ask", { text: "hello" });
    await send(page, "z:ask", { text: 5 });
    await send(page, "z:propose", { title: "T", prompt: "do it" });
    await send(page, "z:propose", { title: "T" });
    await send(page, "z:download", {
      filename: "a.txt",
      mime: "text/plain",
      data: "x",
      encoding: "utf8",
    });
    await send(page, "z:download", { filename: "a.txt", data: "x", encoding: "hex" });
    await send(page, "z:open-zibby", { href: "zibby://agents" });
    expect(h.onParamsChanged).toHaveBeenCalledTimes(1);
    expect(h.onParamsChanged).toHaveBeenCalledWith({ a: 1, b: "x", c: true });
    expect(h.onState).toHaveBeenCalledTimes(1);
    expect(h.onAsk).toHaveBeenCalledWith("hello");
    expect(h.onAsk).toHaveBeenCalledTimes(1);
    expect(h.onPropose).toHaveBeenCalledWith({ title: "T", prompt: "do it" });
    expect(h.onPropose).toHaveBeenCalledTimes(1);
    expect(h.onDownload).toHaveBeenCalledTimes(1);
    expect(h.onOpenZibby).toHaveBeenCalledWith("zibby://agents");
    page.close();
  });

  it("post() sends a host message over the port", async () => {
    const { hook, load } = setup();
    const page = load();
    const got = new Promise<{ type: string; payload: unknown }>((r) => {
      page.onmessage = (e) => e.data.type === "z:params" && r(e.data);
    });
    act(() => hook.result.current.post("z:params", { params: { a: 2 } }));
    expect((await got).payload).toEqual({ params: { a: 2 } });
    page.close();
  });
});
