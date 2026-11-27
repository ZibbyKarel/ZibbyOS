import {
  type BrowserWindow,
  type Rectangle,
  WebContentsView,
  ipcMain,
  session,
  shell,
} from "electron";
import { installPermissionHandlers } from "./permissions";

/** What the web UI shows in the browser toolbar; pushed on every change. */
export interface WebNavState {
  url: string;
  title: string;
  canGoBack: boolean;
  loading: boolean;
}

export type WebNavCommand = { type: "back" } | { type: "reload" } | { type: "go"; url: string };

/** The URL when it is an absolute http(s) one — the only schemes the panel may load. */
export function parseWebUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** The slot rectangle the web UI reported, as whole pixels; null for anything unusable. */
export function toViewBounds(raw: unknown): Rectangle | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const [x, y, width, height] = ["x", "y", "width", "height"].map((k) => Number(r[k]));
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return {
    x: Math.round(x as number),
    y: Math.round(y as number),
    width: Math.max(0, Math.round(width as number)),
    height: Math.max(0, Math.round(height as number)),
  };
}

/** Guests can never be granted anything: this origin cannot be requested from. */
const NO_ORIGIN = "https://guest.invalid";

/**
 * The side-panel browser: one WebContentsView laid over the slot the web UI reports. Own
 * non-persistent partition (cookies and logins of agent-chosen sites die with the app), no
 * preload and no node in the guest, sandboxed.
 */
export function attachWebView(win: BrowserWindow): void {
  const ui = win.webContents;
  let view: WebContentsView | undefined;
  let shown = false;
  let requested = "";

  const fromUi = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) =>
    event.sender === ui;

  const pushState = () => {
    const wc = view?.webContents;
    if (!wc || wc.isDestroyed() || ui.isDestroyed()) return;
    const state: WebNavState = {
      url: wc.getURL(),
      title: wc.getTitle(),
      canGoBack: wc.navigationHistory.canGoBack(),
      loading: wc.isLoading(),
    };
    ui.send("zibby:web-state", state);
  };

  const create = (): WebContentsView => {
    const ses = session.fromPartition("zibby-web");
    installPermissionHandlers(ses, NO_ORIGIN);
    const v = new WebContentsView({
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const wc = v.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      const safe = parseWebUrl(url);
      if (safe) void shell.openExternal(safe);
      return { action: "deny" };
    });
    const guard = (event: Electron.Event, url: string) => {
      if (!parseWebUrl(url)) event.preventDefault();
    };
    // The guest never downloads anything into the default location.
    ses.on("will-download", (e) => e.preventDefault());
    wc.on("will-navigate", guard);
    wc.on("will-redirect", guard);
    for (const e of [
      "did-start-loading",
      "did-stop-loading",
      "did-navigate",
      "did-navigate-in-page",
      "page-title-updated",
    ] as const) {
      wc.on(e as "did-stop-loading", pushState);
    }
    return v;
  };

  const hide = () => {
    if (!shown || !view) return;
    shown = false;
    win.contentView.removeChildView(view);
  };

  const onOpen = (event: Electron.IpcMainEvent, raw: unknown) => {
    const url = parseWebUrl(raw);
    if (!fromUi(event) || !url) return;
    view ??= create();
    if (!shown) {
      shown = true;
      win.contentView.addChildView(view);
    }
    if (url !== requested) {
      requested = url;
      void view.webContents.loadURL(url).catch(() => undefined);
    }
    pushState();
  };
  const onBounds = (event: Electron.IpcMainEvent, raw: unknown) => {
    const bounds = toViewBounds(raw);
    if (fromUi(event) && bounds) view?.setBounds(bounds);
  };
  const onHide = (event: Electron.IpcMainEvent) => {
    if (fromUi(event)) hide();
  };
  const onNav = (event: Electron.IpcMainEvent, raw: unknown) => {
    const wc = view?.webContents;
    if (!fromUi(event) || !wc || typeof raw !== "object" || raw === null) return;
    const cmd = raw as { type?: unknown; url?: unknown };
    if (cmd.type === "back" && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    else if (cmd.type === "reload") wc.reload();
    else if (cmd.type === "go") {
      const url = parseWebUrl(cmd.url);
      if (url) void wc.loadURL(url).catch(() => undefined);
    }
  };
  const onExternal = (event: Electron.IpcMainEvent) => {
    const url = parseWebUrl(view?.webContents.getURL());
    if (fromUi(event) && url) void shell.openExternal(url);
  };

  // A full UI navigation or crash never runs React cleanup, so the native view would be stranded.
  ui.on("did-start-navigation", (d) => {
    if (d.isMainFrame && !d.isSameDocument) {
      hide();
      requested = "";
    }
  });
  ui.on("render-process-gone", () => {
    hide();
    requested = "";
  });

  ipcMain.on("zibby:web-open", onOpen);
  ipcMain.on("zibby:web-bounds", onBounds);
  ipcMain.on("zibby:web-hide", onHide);
  ipcMain.on("zibby:web-nav", onNav);
  ipcMain.on("zibby:web-external", onExternal);
  win.on("closed", () => {
    ipcMain.off("zibby:web-open", onOpen);
    ipcMain.off("zibby:web-bounds", onBounds);
    ipcMain.off("zibby:web-hide", onHide);
    ipcMain.off("zibby:web-nav", onNav);
    ipcMain.off("zibby:web-external", onExternal);
    view?.webContents.close();
  });
}
