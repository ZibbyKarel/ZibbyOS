import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOAD_TIMEOUT_MS,
  MAX_ERRORS,
  resetAllowedCanvasHosts,
  useCanvasBridge,
} from "./useCanvasBridge";

const SRC = "http://abc1234567.canvas.localhost:3334/v1/";
const realSetTimeout = globalThis.setTimeout;
/** Real-time pause so MessagePort deliveries (not faked) land. */
const deliver = () => new Promise((r) => realSetTimeout(r, 10));

function setup(onKey = vi.fn()) {
  const frame = document.createElement("iframe");
  const postMessage = vi.fn();
  Object.defineProperty(frame, "contentWindow", { value: { postMessage } });
  document.body.append(frame);
  const frameRef = { current: frame };
  const hook = renderHook(() =>
    useCanvasBridge({ frameRef, src: SRC, onKey, confirmOpenUrl: (u) => u }),
  );
  /** Fire `load` and return the page's end of the channel. */
  const load = (): MessagePort => {
    act(() => {
      frame.dispatchEvent(new Event("load"));
    });
    return postMessage.mock.calls.at(-1)![2][0] as MessagePort;
  };
  const send = async (page: MessagePort, type: string, payload: unknown = {}) => {
    page.postMessage({ v: 1, id: "c1", type, payload });
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
});
