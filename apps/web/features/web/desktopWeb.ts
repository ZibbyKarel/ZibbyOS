/** Navigation state of the desktop side-panel browser (mirrors `WebNavState` in apps/desktop). */
export interface DesktopWebState {
  url: string;
  title: string;
  canGoBack: boolean;
  loading: boolean;
}

/** `window.zibbyDesktop.web` — the preload bridge to the Electron WebContentsView. */
export interface DesktopWebBridge {
  open: (url: string) => void;
  setBounds: (b: { x: number; y: number; width: number; height: number }) => void;
  hide: () => void;
  back: () => void;
  reload: () => void;
  go: (url: string) => void;
  openExternal: () => void;
  onState: (cb: (state: DesktopWebState) => void) => () => void;
}

/** The bridge inside ZibbyOS.app; null in a plain browser or on the phone. */
export function getDesktopWeb(): DesktopWebBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { zibbyDesktop?: { web?: DesktopWebBridge } }).zibbyDesktop;
  return bridge?.web ?? null;
}
