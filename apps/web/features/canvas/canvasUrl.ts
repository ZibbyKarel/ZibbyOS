export interface CanvasUrls {
  /** URL the iframe loads: host-based (own origin) on localhost, else path-based. `null` = no canvas origin. */
  frame: string | null;
  /** Path-based URL, safe to open top-level (the server sandboxes it). */
  external: string | null;
  /** The frame has its own origin, so the iframe may carry `allow-same-origin`. */
  isolated: boolean;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export interface CanvasBaseInput {
  pageHostname: string;
  remoteUrl?: string;
  canvasUrl?: string;
  apiUrl?: string;
}

/** `API_URL` with its port + 1 (the canvas listener sits next to the API). */
function portPlusOne(apiUrl: string | undefined): string | null {
  if (!apiUrl) return null;
  try {
    const u = new URL(apiUrl);
    const port = Number(u.port || (u.protocol === "https:" ? 443 : 80)) + 1;
    return `${u.protocol}//${u.hostname}:${port}`;
  } catch {
    return null;
  }
}

/** Mirrors `API_URL`: a page on another host uses the remote origin (or none), localhost the local one. */
export function resolveCanvasBase(input: CanvasBaseInput): string | null {
  const base =
    input.pageHostname !== "localhost"
      ? input.remoteUrl
      : input.canvasUrl || portPlusOne(input.apiUrl);
  return base ? base.replace(/\/+$/, "") : null;
}

/** Pure URL builder for a resolved `base`. */
export function buildCanvasUrls(base: string | null, id: string, version: number): CanvasUrls {
  if (!base) return { frame: null, external: null, isolated: false };
  const external = `${base}/a/${id}/v${version}/`;
  try {
    const u = new URL(base);
    if (LOCAL_HOSTS.has(u.hostname)) {
      return {
        frame: `${u.protocol}//${id}.canvas.localhost${u.port ? `:${u.port}` : ""}/v${version}/`,
        external,
        isolated: true,
      };
    }
  } catch {
    // unparsable base: fall through to path-based
  }
  return { frame: external, external, isolated: false };
}

/** The canvas URLs of `id` at `version` for the current page and environment. */
export function canvasUrls(
  id: string,
  version: number,
  theme: "light" | "dark" = "dark",
): CanvasUrls {
  const base = resolveCanvasBase({
    pageHostname: typeof window === "undefined" ? "localhost" : window.location.hostname,
    remoteUrl: process.env.NEXT_PUBLIC_REMOTE_CANVAS_URL,
    canvasUrl: process.env.NEXT_PUBLIC_CANVAS_URL,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  });
  const urls = buildCanvasUrls(base, id, version);
  const q = `?theme=${theme}`;
  return {
    ...urls,
    frame: urls.frame && urls.frame + q,
    external: urls.external && urls.external + q,
  };
}
