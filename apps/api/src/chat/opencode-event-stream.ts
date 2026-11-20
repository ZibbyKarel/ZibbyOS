import { type ChildProcess, spawn as nodeSpawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { opencodeBin } from "../runner/ai-engine";

export interface OpencodeDeltaFrame {
  messageId: string;
  ordinal: number;
  delta: string;
}

/** One SSE `data:` payload -> a text delta, or null for anything else. */
export function parseOpencodeEventFrame(data: string): OpencodeDeltaFrame | null {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const { type, properties } = json as { type?: unknown; properties?: Record<string, unknown> };
  if (type !== "session.text.delta" || !properties) return null;
  const { delta, assistantMessageID, ordinal } = properties;
  if (typeof delta !== "string" || delta === "") return null;
  if (typeof assistantMessageID !== "string" || typeof ordinal !== "number") return null;
  return { messageId: assistantMessageID, ordinal, delta };
}

/** Text to emit per frame: a new (messageId, ordinal) after the first gets a paragraph break. */
export function createDeltaJoiner(): (frame: OpencodeDeltaFrame) => string {
  let current: string | null = null;
  return ({ messageId, ordinal, delta }) => {
    const key = `${messageId}:${ordinal}`;
    const prefix = current !== null && current !== key ? "\n\n" : "";
    current = key;
    return prefix + delta;
  };
}

export interface OpencodeEventServer {
  url: string;
  password: string;
  proc: ChildProcess;
  subscribe(onDelta: (text: string) => void): () => void;
  close(): void;
}

export interface StartOpencodeEventServerOptions {
  env: NodeJS.ProcessEnv;
  cwd: string;
  spawn?: typeof nodeSpawn;
  startTimeoutMs?: number;
}

// Not importing killTurnProcess from chat-session.service: the service will import this module.
function killGroup(proc: ChildProcess): void {
  try {
    if (!proc.pid) throw new Error("no pid");
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    try {
      proc.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
}

/** Spawn `opencode serve` on a random loopback port; null if it never reports its address. */
export function startOpencodeEventServer(
  opts: StartOpencodeEventServerOptions,
): Promise<OpencodeEventServer | null> {
  const password = randomBytes(24).toString("base64url");
  const proc = (opts.spawn ?? nodeSpawn)(
    opencodeBin(),
    ["serve", "--port", "0", "--hostname", "127.0.0.1"],
    {
      cwd: opts.cwd,
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...opts.env, OPENCODE_SERVER_PASSWORD: password },
    },
  ) as ChildProcess;

  return new Promise((resolve) => {
    let buf = "";
    let settled = false;
    const settle = (server: OpencodeEventServer | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      proc.stdout?.off("data", onData);
      if (!server) killGroup(proc);
      resolve(server);
    };
    const onData = (chunk: Buffer | string): void => {
      buf += chunk.toString();
      const url = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(buf)?.[1];
      if (url) settle(makeServer(url, password, proc));
    };
    const timer = setTimeout(() => settle(null), opts.startTimeoutMs ?? 10_000);
    timer.unref?.();
    proc.stdout?.on("data", onData);
    proc.once("exit", () => settle(null));
    proc.once("error", () => settle(null));
  });
}

function makeServer(url: string, password: string, proc: ChildProcess): OpencodeEventServer {
  const subs = new Set<AbortController>();
  return {
    url,
    password,
    proc,
    subscribe(onDelta) {
      const ctl = new AbortController();
      subs.add(ctl);
      void pump(url, password, ctl.signal, onDelta).catch(() => {
        // deltas are best-effort; `done` is authoritative
      });
      return () => ctl.abort();
    },
    close() {
      for (const ctl of subs) ctl.abort();
      subs.clear();
      killGroup(proc);
    },
  };
}

async function pump(
  url: string,
  password: string,
  signal: AbortSignal,
  onDelta: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${url}/api/event`, {
    headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` },
    signal,
  });
  if (!res.body) return;
  const join = createDeltaJoiner();
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    const events = buf.split(/\r?\n\r?\n/);
    buf = events.pop() ?? "";
    for (const ev of events) {
      const data = ev
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).replace(/^ /, ""))
        .join("\n");
      const frame = data ? parseOpencodeEventFrame(data) : null;
      if (frame) onDelta(join(frame));
    }
  }
}
