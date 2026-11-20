import { type ChildProcess, spawn as realSpawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDeltaJoiner,
  parseOpencodeEventFrame,
  startOpencodeEventServer,
  sweepOrphanEventServers,
} from "./opencode-event-stream";

const frame = (type: string, props: Record<string, unknown>): string =>
  JSON.stringify({ type, properties: props });

describe("parseOpencodeEventFrame", () => {
  it("parses a text delta frame", () => {
    const data = frame("session.text.delta", {
      sessionID: "ses_1",
      assistantMessageID: "msg_1",
      ordinal: 0,
      delta: "Po",
    });
    expect(parseOpencodeEventFrame(data)).toEqual({ messageId: "msg_1", ordinal: 0, delta: "Po" });
  });

  it("parses the frame opencode 2.2.7 actually sends on /api/event (payload under `data`)", () => {
    const data = JSON.stringify({
      id: "evt_1",
      created: 1,
      type: "session.text.delta",
      location: { directory: "/w" },
      data: { sessionID: "ses_1", assistantMessageID: "msg_1", ordinal: 0, delta: "Ob" },
    });
    expect(parseOpencodeEventFrame(data)).toEqual({ messageId: "msg_1", ordinal: 0, delta: "Ob" });
  });

  it("ignores other types, malformed JSON and empty deltas", () => {
    expect(parseOpencodeEventFrame(frame("session.text.started", {}))).toBeNull();
    expect(parseOpencodeEventFrame("{nope")).toBeNull();
    expect(
      parseOpencodeEventFrame(
        frame("session.text.delta", { assistantMessageID: "m", ordinal: 0, delta: "" }),
      ),
    ).toBeNull();
  });
});

describe("createDeltaJoiner", () => {
  it("separates a new (messageId, ordinal) pair with a paragraph break", () => {
    const join = createDeltaJoiner();
    expect(join({ messageId: "msg_1", ordinal: 0, delta: "Ahoj" })).toBe("Ahoj");
    expect(join({ messageId: "msg_1", ordinal: 0, delta: " pane" })).toBe(" pane");
    expect(join({ messageId: "msg_1", ordinal: 1, delta: "Druhý" })).toBe("\n\nDruhý");
  });
});

type FakeChild = EventEmitter & {
  pid: number;
  stdout: PassThrough;
  kill: ReturnType<typeof vi.fn>;
};

const fakeSpawn = () => {
  const child = Object.assign(new EventEmitter(), {
    pid: 0,
    stdout: new PassThrough(),
    kill: vi.fn(),
  }) as FakeChild;
  const spawn = vi.fn(() => child);
  return {
    child,
    spawn: spawn as unknown as typeof import("node:child_process").spawn,
    mock: spawn,
  };
};

describe("startOpencodeEventServer", () => {
  it("resolves with the url once the server prints its address", async () => {
    const { child, spawn, mock } = fakeSpawn();
    const p = startOpencodeEventServer({
      env: { ...process.env, OPENCODE_CONFIG: "/c.json" },
      cwd: "/tmp",
      spawn,
    });
    child.stdout.write("server listening on http://127.0.0.1:5555\n");
    const server = await p;
    expect(server?.url).toBe("http://127.0.0.1:5555");
    const opts = (mock.mock.calls[0] as unknown[])[2] as {
      env: NodeJS.ProcessEnv;
      detached: boolean;
    };
    expect(opts.env.OPENCODE_CONFIG).toBe("/c.json");
    expect(opts.env.OPENCODE_SERVER_PASSWORD).toBe(server?.password);
    expect(server?.password.length).toBeGreaterThan(20);
    expect(opts.detached).toBe(true);
  });

  it("resolves null when the child exits first", async () => {
    const { child, spawn } = fakeSpawn();
    const p = startOpencodeEventServer({ env: process.env, cwd: "/tmp", spawn });
    child.emit("exit", 1);
    expect(await p).toBeNull();
  });

  it("resolves null and kills the child on timeout", async () => {
    const { child, spawn } = fakeSpawn();
    const p = startOpencodeEventServer({
      env: process.env,
      cwd: "/tmp",
      spawn,
      startTimeoutMs: 50,
    });
    expect(await p).toBeNull();
    expect(child.kill).toHaveBeenCalled();
  });
});

describe("event server pid files (crash-orphan sweep)", () => {
  // No real process has this pid on macOS/Linux defaults (pid_max < 999999).
  const FAKE_PID = 999_999;
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "zibby-oc-pid-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });
  const pidFiles = async () => (await fs.readdir(dir)).filter((n) => n.endsWith(".pid"));

  it("writes the server's pid file at spawn and removes it on close", async () => {
    const { child, spawn } = fakeSpawn();
    child.pid = FAKE_PID;
    const p = startOpencodeEventServer({ env: process.env, cwd: "/tmp", spawn, pidDir: dir });
    expect(await pidFiles()).toEqual([`opencode-serve_${process.pid}_${FAKE_PID}.pid`]);
    child.stdout.write("server listening on http://127.0.0.1:5555\n");
    const server = await p;
    server?.close();
    expect(await pidFiles()).toEqual([]);
  });

  it("removes the pid file when the server never starts", async () => {
    const { child, spawn } = fakeSpawn();
    child.pid = FAKE_PID;
    const p = startOpencodeEventServer({ env: process.env, cwd: "/tmp", spawn, pidDir: dir });
    child.emit("exit", 1);
    expect(await p).toBeNull();
    expect(await pidFiles()).toEqual([]);
  });

  describe("sweepOrphanEventServers", () => {
    const children: ChildProcess[] = [];
    afterEach(() => {
      for (const c of children.splice(0)) {
        try {
          process.kill(-(c.pid ?? 0), "SIGKILL");
        } catch {
          // gone
        }
      }
    });
    /** A detached long-lived child whose command line is `node -e … <tail>`. */
    const longLived = (...tail: string[]): ChildProcess => {
      const c = realSpawn(process.execPath, ["-e", "setInterval(()=>{},1e3)", ...tail], {
        detached: true,
        stdio: "ignore",
      });
      children.push(c);
      return c;
    };
    const alive = (pid: number): boolean => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    const deadPid = async (): Promise<number> => {
      const c = realSpawn(process.execPath, ["-e", ""], { stdio: "ignore" });
      await once(c, "exit");
      return c.pid ?? 0;
    };
    const exited = (c: ChildProcess) =>
      c.exitCode !== null || c.signalCode !== null ? Promise.resolve() : once(c, "exit");

    it("kills an orphan whose API is gone, spares a non-opencode pid and a live API's server", async () => {
      const dead = await deadPid();
      const orphan = longLived("opencode", "serve");
      const decoy = longLived();
      const sibling = longLived("opencode", "serve");
      const orphanFile = `opencode-serve_${dead}_${orphan.pid}.pid`;
      const decoyFile = `opencode-serve_${dead}_${decoy.pid}.pid`;
      const siblingFile = `opencode-serve_${process.pid}_${sibling.pid}.pid`;
      for (const f of [orphanFile, decoyFile, siblingFile])
        await fs.writeFile(path.join(dir, f), "");
      await sweepOrphanEventServers(dir);
      await exited(orphan);
      expect(alive(orphan.pid ?? 0)).toBe(false);
      expect(alive(decoy.pid ?? 0)).toBe(true);
      expect(alive(sibling.pid ?? 0)).toBe(true);
      expect(await pidFiles()).toEqual([siblingFile]);
    });

    it("drops a pid file whose process is already gone", async () => {
      const dead = await deadPid();
      await fs.writeFile(path.join(dir, `opencode-serve_${dead}_${await deadPid()}.pid`), "");
      await sweepOrphanEventServers(dir);
      expect(await pidFiles()).toEqual([]);
    });
  });
});
