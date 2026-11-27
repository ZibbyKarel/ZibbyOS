import { contextBridge, ipcRenderer } from "electron";

/** Mirrors `WebNavState` / `WebNavCommand` in webView.ts (a preload can't import app code). */
export interface DesktopWebNavState {
  url: string;
  title: string;
  canGoBack: boolean;
  loading: boolean;
}

/**
 * The one bridge the web UI gets into the app: the top-bar Upgrade button runs the
 * same updater as the app menu's "Check for Updates…", and `web` drives the chat side-panel
 * browser. Read in apps/web as `window.zibbyDesktop` (absent in a plain browser).
 */
contextBridge.exposeInMainWorld("zibbyDesktop", {
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke("zibby:check-for-updates"),
  /** Settings → Updates: download and install straight away, no Update/Later question. */
  installUpdate: (): Promise<void> => ipcRenderer.invoke("zibby:install-update"),
  web: {
    open: (url: string): void => ipcRenderer.send("zibby:web-open", url),
    setBounds: (b: { x: number; y: number; width: number; height: number }): void =>
      ipcRenderer.send("zibby:web-bounds", b),
    hide: (): void => ipcRenderer.send("zibby:web-hide"),
    back: (): void => ipcRenderer.send("zibby:web-nav", { type: "back" }),
    reload: (): void => ipcRenderer.send("zibby:web-nav", { type: "reload" }),
    go: (url: string): void => ipcRenderer.send("zibby:web-nav", { type: "go", url }),
    openExternal: (): void => ipcRenderer.send("zibby:web-external"),
    onState: (cb: (state: DesktopWebNavState) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, state: DesktopWebNavState) => cb(state);
      ipcRenderer.on("zibby:web-state", listener);
      return () => ipcRenderer.off("zibby:web-state", listener);
    },
  },
});
