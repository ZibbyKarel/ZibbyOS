import type { BrowserWindow } from "electron";

const CANVAS_HOST = /^[a-z0-9]{10}\.canvas\.localhost$/;

function parse(url: string | undefined): URL | null {
  try {
    return url ? new URL(url) : null;
  } catch {
    return null;
  }
}

/**
 * True when a frame sitting on a canvas page tries to navigate anywhere but its own
 * canvas — the model-authored page must not be able to send its frame off to the web.
 * Frames that are not (yet) on a canvas URL, e.g. the initial about:blank, are never blocked.
 */
export function shouldBlockCanvasFrameNavigation(
  currentUrl: string | undefined,
  targetUrl: string,
  canvasPort: number,
): boolean {
  const cur = parse(currentUrl);
  if (!cur || cur.port !== String(canvasPort)) return false;
  const target = parse(targetUrl);

  if (CANVAS_HOST.test(cur.hostname)) return target?.origin !== cur.origin;

  if (cur.hostname === "localhost" || cur.hostname === "127.0.0.1") {
    const id = /^\/a\/([^/]+)/.exec(cur.pathname)?.[1];
    if (!id) return false;
    return (
      target?.origin !== cur.origin ||
      !(target.pathname === `/a/${id}` || target.pathname.startsWith(`/a/${id}/`))
    );
  }
  return false;
}

/** Stops chat-canvas iframes from navigating away from their own canvas. */
export function guardCanvasFrames(win: BrowserWindow, canvasPort: number): void {
  win.webContents.on("will-frame-navigate", (details) => {
    if (
      !details.isMainFrame &&
      shouldBlockCanvasFrameNavigation(details.frame?.url, details.url, canvasPort)
    ) {
      details.preventDefault();
    }
  });
}
