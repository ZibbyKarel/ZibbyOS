import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  createDeltaJoiner,
  parseOpencodeEventFrame,
  startOpencodeEventServer,
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
