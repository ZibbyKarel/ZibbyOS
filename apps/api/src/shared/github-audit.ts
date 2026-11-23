import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import * as path from "node:path";
import { dataDir } from "./data-dir";
import { traceStorage } from "./logging/trace-context.service";

export const GH_AUDIT_DIR_ENV = "ZIBBY_GH_AUDIT_DIR";

const GITHUB_HOSTS = new Set(["api.github.com", "uploads.github.com"]);
const RATE_HEADERS = {
  rlResource: "x-ratelimit-resource",
  rlLimit: "x-ratelimit-limit",
  rlRemaining: "x-ratelimit-remaining",
  rlUsed: "x-ratelimit-used",
  rlReset: "x-ratelimit-reset",
  requestId: "x-github-request-id",
  retryAfter: "retry-after",
} as const;
const NUMERIC = new Set(["rlLimit", "rlRemaining", "rlUsed", "rlReset", "retryAfter"]);

function auditDir(): string {
  return process.env[GH_AUDIT_DIR_ENV] ?? dataDir("logs");
}

/** `<dir>/github-api-YYYY-MM-DD.ndjson` (UTC date); dir = process.env[GH_AUDIT_DIR_ENV] ?? dataDir("logs"). */
export function githubAuditFile(now: Date = new Date()): string {
  return path.join(auditDir(), `github-api-${now.toISOString().slice(0, 10)}.ndjson`);
}

/** Append one JSON line {ts: ISO, pid, ...entry}. mkdir -p the dir. No-op when ZIBBY_GH_AUDIT === "0". Never throws. */
export function appendGithubAudit(entry: Record<string, unknown>): void {
  if (process.env.ZIBBY_GH_AUDIT === "0") return;
  try {
    const now = new Date();
    const file = githubAuditFile(now);
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(
      file,
      `${JSON.stringify({ ts: now.toISOString(), pid: process.pid, ...entry })}\n`,
    );
  } catch {
    // auditing must never break a request
  }
}

function callerFrames(): string[] {
  const out: string[] = [];
  for (const line of (new Error().stack ?? "").split("\n").slice(1)) {
    if (/node_modules|node:|github-audit\.(?:ts|js)/.test(line)) continue;
    const m = /\(?([^()\s]+:\d+):\d+\)?\s*$/.exec(line);
    if (!m?.[1]) continue;
    const file = m[1].replace(/^file:\/\//, "");
    const i = file.lastIndexOf("src/");
    out.push(i >= 0 ? file.slice(i) : file);
    if (out.length === 3) break;
  }
  return out;
}

function authHeader(input: RequestInfo | URL, init?: RequestInit): string | undefined {
  const h =
    init?.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined);
  if (!h) return undefined;
  if (h instanceof Headers) return h.get("authorization") ?? undefined;
  if (Array.isArray(h)) return h.find(([k]) => k?.toLowerCase() === "authorization")?.[1];
  const hit = Object.entries(h).find(([k]) => k.toLowerCase() === "authorization");
  return hit ? String(hit[1]) : undefined;
}

function gqlSummary(body: unknown): string | undefined {
  if (typeof body !== "string") return undefined;
  try {
    const p = JSON.parse(body) as { operationName?: unknown; query?: unknown };
    if (typeof p.operationName === "string" && p.operationName) return p.operationName;
    if (typeof p.query === "string") return p.query.replace(/\s+/g, " ").trim().slice(0, 120);
  } catch {
    // not JSON — nothing to summarise
  }
  return undefined;
}

function describe(input: RequestInfo | URL, init?: RequestInit): Record<string, unknown> | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw);
  if (!GITHUB_HOSTS.has(url.hostname)) return null;
  const method = (
    init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")
  ).toUpperCase();
  const bearer = authHeader(input, init)?.replace(/^bearer\s+/i, "");
  const store = traceStorage.getStore();
  return {
    src: "fetch",
    method,
    host: url.hostname,
    path: url.pathname,
    query: url.search,
    ...(url.pathname === "/graphql" ? { gql: gqlSummary(init?.body) } : {}),
    caller: callerFrames(),
    traceId: store?.traceId,
    runId: store?.runId,
    token: bearer ? createHash("sha256").update(bearer).digest("hex").slice(0, 8) : undefined,
  };
}

function rateHeaders(res: Response): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, header] of Object.entries(RATE_HEADERS)) {
    const v = res.headers.get(header);
    if (v !== null)
      out[key] = NUMERIC.has(key) && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : v;
  }
  return out;
}

const WRAPPED = Symbol.for("zibby.githubAudit");

/** Wrap globalThis.fetch once (idempotent); also sets process.env[GH_AUDIT_DIR_ENV] if unset so children inherit it. */
export function installGithubFetchAudit(): void {
  if ((globalThis.fetch as unknown as Record<symbol, unknown>)[WRAPPED]) return;
  try {
    process.env[GH_AUDIT_DIR_ENV] ??= auditDir();
  } catch {
    // data root unresolved — children just fall back to their own default
  }
  const original = globalThis.fetch;
  const wrapped = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let base: Record<string, unknown> | null = null;
    try {
      base = describe(input, init);
    } catch {
      // unparseable URL etc. — let the real fetch report it
    }
    if (!base) return original(input, init);
    const started = Date.now();
    try {
      const res = await original(input, init);
      appendGithubAudit({
        ...base,
        status: res.status,
        durationMs: Date.now() - started,
        ...rateHeaders(res),
      });
      return res;
    } catch (err) {
      appendGithubAudit({
        ...base,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }) as typeof fetch;
  Object.assign(wrapped, { [WRAPPED]: true });
  globalThis.fetch = wrapped;
}
