import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  uiHandlers: {} as Record<string, (...a: unknown[]) => void>,
  sesHandlers: {} as Record<string, (...a: unknown[]) => void>,
  ipc: {} as Record<string, (...a: unknown[]) => void>,
  removeChildView: vi.fn(),
  ui: undefined as unknown,
}));

vi.mock("electron", () => ({
  WebContentsView: class {
    webContents = {
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      loadURL: vi.fn().mockResolvedValue(undefined),
      getURL: () => "",
      getTitle: () => "",
      isLoading: () => false,
      isDestroyed: () => false,
      navigationHistory: { canGoBack: () => false },
    };
    setBounds = vi.fn();
  },
  ipcMain: { on: (c: string, fn: (...a: unknown[]) => void) => (h.ipc[c] = fn), off: vi.fn() },
  session: {
    fromPartition: () => ({
      on: (e: string, fn: (...a: unknown[]) => void) => (h.sesHandlers[e] = fn),
    }),
  },
  shell: { openExternal: vi.fn() },
}));
vi.mock("./permissions", () => ({ installPermissionHandlers: vi.fn() }));

const { parseWebUrl, toViewBounds, attachWebView } = await import("./webView");

describe("attachWebView (todo-19)", () => {
  const setup = () => {
    const ui = {
      isDestroyed: () => false,
      send: vi.fn(),
      on: (e: string, fn: (...a: unknown[]) => void) => (h.uiHandlers[e] = fn),
    };
    h.removeChildView.mockClear();
    attachWebView({
      webContents: ui,
      contentView: { addChildView: vi.fn(), removeChildView: h.removeChildView },
      on: vi.fn(),
    } as never);
    h.ipc["zibby:web-open"]?.({ sender: ui }, "https://example.com/");
  };

  it("hides the view on a full UI navigation but not on same-document ones", () => {
    setup();
    h.uiHandlers["did-start-navigation"]?.({ isMainFrame: true, isSameDocument: true });
    h.uiHandlers["did-start-navigation"]?.({ isMainFrame: false, isSameDocument: false });
    expect(h.removeChildView).not.toHaveBeenCalled();
    h.uiHandlers["did-start-navigation"]?.({ isMainFrame: true, isSameDocument: false });
    expect(h.removeChildView).toHaveBeenCalledTimes(1);
  });

  it("hides the view when the UI render process is gone", () => {
    setup();
    h.uiHandlers["render-process-gone"]?.();
    expect(h.removeChildView).toHaveBeenCalledTimes(1);
  });

  it("cancels downloads from the guest session", () => {
    setup();
    const preventDefault = vi.fn();
    h.sesHandlers["will-download"]?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
  });
});

describe("parseWebUrl (todo-19)", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(parseWebUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(parseWebUrl("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  it.each([
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,x",
    "about:blank",
    "example.com",
    "",
    5,
    null,
  ])("rejects %s", (raw) => expect(parseWebUrl(raw)).toBeNull());
});

describe("toViewBounds (todo-19)", () => {
  it("rounds to whole pixels and clamps negative sizes", () => {
    expect(toViewBounds({ x: 10.4, y: 20.6, width: 300.2, height: -5 })).toEqual({
      x: 10,
      y: 21,
      width: 300,
      height: 0,
    });
  });

  it("rejects non-numeric or missing fields", () => {
    expect(toViewBounds({ x: 1, y: 2, width: "a", height: 4 })).toBeNull();
    expect(toViewBounds({ x: 1 })).toBeNull();
    expect(toViewBounds(null)).toBeNull();
  });
});
