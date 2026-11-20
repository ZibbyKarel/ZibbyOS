import { type ChildProcess, execFile, spawn as nodeSpawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promises as fs, mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
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
  // opencode 2.2.7's `/api/event` puts the payload under `data`; older builds used `properties`.
  const {
    type,
    data: payload,
    properties: legacy,
  } = json as {
    type?: unknown;
    data?: Record<string, unknown>;
    properties?: Record<string, unknown>;
  };
  const properties = payload ?? legacy;
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
  /** Where the server's pid file goes, so {@link sweepOrphanEventServers} can reap it
   *  after an API crash (the server never exits on its own and holds bearer tokens). */
  pidDir?: string;
}

/** `opencode-serve_<api pid>_<server pid>.pid` — the owner pid spares a live sibling API's servers. */
const PID_FILE = /^opencode-serve_(\d+)_(\d+)\.pid$/;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Kill the `opencode serve` process groups a crashed API left behind (their pid files
 * under `dir`, owner API no longer alive). Only a pid whose command line still reads
 * `opencode … serve` is signalled, so a reused pid is never hit.
 */
export async function sweepOrphanEventServers(dir: string): Promise<void> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  for (const name of names) {
    const match = PID_FILE.exec(name);
    if (!match || isAlive(Number(match[1]))) continue;
    const pid = Number(match[2]);
    const command = await promisify(execFile)("ps", ["-o", "command=", "-p", String(pid)])
      .then((r) => r.stdout)
      .catch(() => "");
    if (command.includes("opencode") && command.includes("serve")) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        // ESRCH: already gone
      }
    }
    await fs.rm(path.join(dir, name), { force: true }).catch(() => undefined);
  }
}

// Not importing killTurnProcess from chat-session.service: the service will import this module.
function killGroup(proc: ChildProcess): void {
  const signal = (sig: NodeJS.Signals): void => {
    try {
      if (!proc.pid) throw new Error("no pid");
      process.kill(-proc.pid, sig);
    } catch {
      try {
        proc.kill(sig);
      } catch {
        // already gone
      }
    }
  };
  signal("SIGTERM");
  setTimeout(() => signal("SIGKILL"), 2_000).unref?.();
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
  const pidFile =
    opts.pidDir && proc.pid
      ? path.join(opts.pidDir, `opencode-serve_${process.pid}_${proc.pid}.pid`)
      : null;
  const removePidFile = (): void => {
    try {
      if (pidFile) rmSync(pidFile, { force: true });
    } catch {
      // left for the next sweep
    }
  };
  if (pidFile) {
    try {
      mkdirSync(path.dirname(pidFile), { recursive: true });
      writeFileSync(pidFile, "", { mode: 0o600 });
    } catch {
      // best-effort: the sweep is a crash safety net, not the normal cleanup
    }
  }
  proc.once("exit", removePidFile);

  return new Promise((resolve) => {
    let buf = "";
    let settled = false;
    const settle = (server: OpencodeEventServer | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      proc.stdout?.off("data", onData);
      if (!server) {
        killGroup(proc);
        removePidFile();
      }
      resolve(server);
    };
    const onData = (chunk: Buffer | string): void => {
      buf += chunk.toString();
      const url = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(buf)?.[1];
      if (url) settle(makeServer(url, password, proc, removePidFile));
    };
    const timer = setTimeout(() => settle(null), opts.startTimeoutMs ?? 10_000);
    timer.unref?.();
    proc.stdout?.on("data", onData);
    proc.once("exit", () => settle(null));
    proc.once("error", () => settle(null));
  });
}

function makeServer(
  url: string,
  password: string,
  proc: ChildProcess,
  onClose: () => void,
): OpencodeEventServer {
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
      onClose();
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
  if (!res.ok || !res.body) return;
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
