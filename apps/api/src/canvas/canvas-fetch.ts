import * as dns from "node:dns";
import * as https from "node:https";
import { BlockList, isIP } from "node:net";

export type CanvasFetchErrorCode = "not-allowed" | "needs-grant" | "blocked" | "bad-gateway";

/** A refused or failed proxy fetch; the first three map to 403, `bad-gateway` to 502. */
export class CanvasFetchError extends Error {
  constructor(
    readonly code: CanvasFetchErrorCode,
    readonly origin: string,
    message: string,
  ) {
    super(message);
  }
}

export interface LookupAddress {
  address: string;
  family: number;
}
export type CanvasLookup = (
  hostname: string,
  options: { all: true },
  cb: (err: Error | null, addresses: LookupAddress[]) => void,
) => void;

export interface HopResult {
  status: number;
  location?: string;
  contentType: string;
  body: string;
}
/** One HTTP GET without redirects; injectable so tests need no TLS server. */
export type CanvasHop = (
  url: URL,
  ctx: { lookup: CanvasLookup; signal: AbortSignal; maxBytes: number },
) => Promise<HopResult>;

export interface CanvasFetchOptions {
  /** Origins of the CURRENT code version's manifest `net`. */
  allowedOrigins: string[];
  /** Origins the operator granted to this canvas. */
  granted: string[];
  lookup?: CanvasLookup;
  hop?: CanvasHop;
  timeoutMs?: number;
  maxBytes?: number;
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 3], // multicast + reserved
] as const)
  blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["64:ff9b::", 96], // NAT64 → embedded v4 may be private
  ["2002::", 16], // 6to4 → embedded v4 may be private
] as const)
  blocked.addSubnet(net, prefix, "ipv6");

/** `::ffff:a.b.c.d` / `::ffff:xxxx:xxxx` → the embedded v4, else `null`. */
function mappedV4(ip: string): string | null {
  const dotted = /^(?:0{0,4}:){0,5}:?ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (dotted?.[1]) return dotted[1];
  const hex = /^(?:0{0,4}:){0,5}:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (!hex?.[1] || !hex[2]) return null;
  const hi = Number.parseInt(hex[1], 16);
  const lo = Number.parseInt(hex[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/** Whether an IP literal is loopback / private / link-local / reserved. Unparseable → blocked. */
export function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 0) return true;
  if (v === 4) return blocked.check(ip, "ipv4");
  const v4 = mappedV4(ip);
  return v4 ? blocked.check(v4, "ipv4") : blocked.check(ip, "ipv6");
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(h)) return isBlockedIp(h);
  return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local");
}

const TEXT_TYPE =
  /^(text\/|application\/(json|xml|javascript|x-javascript|ecmascript)\b|[^;]*\+(json|xml)\b)/i;

const defaultLookup: CanvasLookup = (hostname, options, cb) =>
  dns.lookup(hostname, options, (err, addresses) => cb(err, addresses));

const defaultHop: CanvasHop = (url, { lookup, signal, maxBytes }) =>
  new Promise((resolve, reject) => {
    const guarded = (
      hostname: string,
      options: { all?: boolean },
      cb: (err: Error | null, a: unknown, f?: number) => void,
    ) =>
      lookup(hostname, { all: true }, (err, addrs) => {
        if (err) return cb(err, "", 0);
        if (addrs.length === 0 || addrs.some((a) => isBlockedIp(a.address)))
          return cb(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "", 0);
        const first = addrs[0] as LookupAddress;
        return options.all ? cb(null, addrs) : cb(null, first.address, first.family);
      });
    const req = https.request(
      url,
      {
        method: "GET",
        headers: { accept: "*/*", "user-agent": "ZibbyOS-canvas" },
        lookup: guarded as unknown as https.RequestOptions["lookup"],
        signal,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const header = (n: string) => {
          const v = res.headers[n];
          return (Array.isArray(v) ? v[0] : v) ?? "";
        };
        if (status >= 300 && status < 400 && header("location")) {
          res.destroy();
          return resolve({ status, location: header("location"), contentType: "", body: "" });
        }
        const contentType = header("content-type");
        if (!TEXT_TYPE.test(contentType)) {
          res.destroy();
          return reject(
            new CanvasFetchError("bad-gateway", url.origin, "unsupported content type"),
          );
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            res.destroy();
            reject(new CanvasFetchError("bad-gateway", url.origin, "response too large"));
          } else chunks.push(c);
        });
        res.on("end", () =>
          resolve({ status, contentType, body: Buffer.concat(chunks).toString("utf8") }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });

/** Fetch `rawUrl` as text for a canvas: allow-list, grant, SSRF guards, redirect re-checks. */
export async function canvasFetch(
  rawUrl: string,
  opts: CanvasFetchOptions,
): Promise<{ status: number; contentType: string; body: string }> {
  const lookup = opts.lookup ?? defaultLookup;
  const hop = opts.hop ?? defaultHop;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 10_000);
  try {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new CanvasFetchError("not-allowed", "", "invalid url");
    }
    for (let hops = 0; ; hops++) {
      if (url.protocol !== "https:")
        throw new CanvasFetchError("not-allowed", url.origin, "https only");
      if (!opts.allowedOrigins.includes(url.origin))
        throw new CanvasFetchError("not-allowed", url.origin, "origin not in manifest net");
      if (!opts.granted.includes(url.origin))
        throw new CanvasFetchError("needs-grant", url.origin, "origin not granted");
      if (isBlockedHost(url.hostname))
        throw new CanvasFetchError("blocked", url.origin, "host is blocked");

      let res: HopResult;
      try {
        res = await hop(url, { lookup, signal: ac.signal, maxBytes });
      } catch (e) {
        if (e instanceof CanvasFetchError) throw e;
        if ((e as { code?: string }).code === "EBLOCKED")
          throw new CanvasFetchError("blocked", url.origin, "address is blocked");
        throw new CanvasFetchError(
          "bad-gateway",
          url.origin,
          ac.signal.aborted ? "timeout" : `fetch failed: ${(e as Error).message}`,
        );
      }
      if (res.status >= 300 && res.status < 400 && res.location) {
        if (hops >= 3) throw new CanvasFetchError("bad-gateway", url.origin, "too many redirects");
        try {
          url = new URL(res.location, url);
        } catch {
          throw new CanvasFetchError("bad-gateway", url.origin, "bad redirect location");
        }
        continue;
      }
      if (!TEXT_TYPE.test(res.contentType))
        throw new CanvasFetchError("bad-gateway", url.origin, "unsupported content type");
      return { status: res.status, contentType: res.contentType, body: res.body };
    }
  } finally {
    clearTimeout(timer);
  }
}
