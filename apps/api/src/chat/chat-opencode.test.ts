import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { FAKE_BLUECODE_KEY, withBlueCodeDir } from "../ai-providers/bluecode-fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPENCODE_CHAT_BUILTIN_TOOLS,
  OPENCODE_CHAT_GATE_PLUGIN,
  buildOpencodeChatConfig,
  opencodeChatArgs,
  opencodeChatEnv,
  parseOpencodeChatLine,
  preferGlobalBin,
  toOpencodeMcpServer,
} from "./chat-opencode";
import plugin, {
  CHAT_BUILTIN_TOOLS,
  chatGateCall,
  chatGateHash,
  chatGateReason,
  isMountedMcpTool,
  // @ts-expect-error — plain .mjs plugin, no types
} from "./opencode-chat-gate/index.mjs";

describe("buildOpencodeChatConfig (A25)", () => {
  it("denies everything, allows the shell/read built-ins and the mounted servers' tools, then the extra denials", () => {
    const { config, serverIds } = buildOpencodeChatConfig(
      "PROMPT",
      {
        zibby: {
          type: "http",
          url: "http://x/api/chat/mcp",
          headers: { Authorization: "Bearer t" },
        },
        plugin_playwright_playwright: { command: "npx", args: ["@playwright/mcp@0.0.1"] },
        opencode: { type: "http", url: "http://shadow" },
        "bad.id": { type: "http", url: "http://y" },
      },
      ["zibby_create_task"],
    );
    expect(serverIds).toEqual(["zibby", "plugin_playwright_playwright"]);
    expect(config).toEqual({
      agents: { zibby: { mode: "primary", system: "PROMPT" } },
      permissions: [
        { action: "*", resource: "*", effect: "deny" },
        ...["shell", "bash", "read", "grep", "glob", "list"].map((action) => ({
          action,
          resource: "*",
          effect: "allow",
        })),
        { action: "zibby_*", resource: "*", effect: "allow" },
        { action: "plugin_playwright_playwright_*", resource: "*", effect: "allow" },
        { action: "zibby_create_task", resource: "*", effect: "deny" },
      ],
      plugins: [OPENCODE_CHAT_GATE_PLUGIN],
      mcp: {
        servers: {
          zibby: {
            type: "remote",
            url: "http://x/api/chat/mcp",
            headers: { Authorization: "Bearer t" },
            oauth: false,
            codemode: false,
          },
          plugin_playwright_playwright: {
            type: "local",
            command: ["npx", "@playwright/mcp@0.0.1"],
            codemode: false,
          },
        },
      },
    });
  });

  it("keeps OAuth on for a header-less remote (A33)", () => {
    expect(toOpencodeMcpServer({ type: "http", url: "https://mcp.figma.com/mcp" })).toEqual({
      type: "remote",
      url: "https://mcp.figma.com/mcp",
      codemode: false,
    });
  });

  it("allows exactly the built-ins the gate plugin judges", () => {
    expect(OPENCODE_CHAT_BUILTIN_TOOLS).toEqual(CHAT_BUILTIN_TOOLS);
  });

  it("maps stdio env to environment", () => {
    expect(toOpencodeMcpServer({ type: "stdio", command: "serena", env: { A: "1" } })).toEqual({
      type: "local",
      command: ["serena"],
      environment: { A: "1" },
      codemode: false,
    });
  });
});

describe("opencodeChatArgs / opencodeChatEnv", () => {
  it("resumes with --session and never passes --auto", () => {
    expect(opencodeChatArgs("opencode/big-pickle", "ses_1", "ahoj")).toEqual([
      "run",
      "--standalone",
      "--format",
      "json",
      "-m",
      "opencode/big-pickle",
      "--agent",
      "zibby",
      "--session",
      "ses_1",
      "--",
      "ahoj",
    ]);
    expect(opencodeChatArgs("m", null, "x")).not.toContain("--session");
  });

  it("attaches to a per-turn server with --server instead of --standalone", () => {
    const args = opencodeChatArgs("m", null, "hi", "http://127.0.0.1:5");
    expect(args.slice(0, 5)).toEqual(["run", "--server", "http://127.0.0.1:5", "--format", "json"]);
    expect(args).not.toContain("--standalone");
    expect(opencodeChatArgs("m", null, "hi").slice(0, 4)).toEqual([
      "run",
      "--standalone",
      "--format",
      "json",
    ]);
  });

  it("passes the inline-approval gate env only when given, and no legacy allow list", () => {
    const gate = { url: "http://h/api/chat/gate?conversationId=c", token: "t", deadlineS: 330 };
    const env = opencodeChatEnv("/tmp/c.json", "/repo", ["zibby"], [], gate);
    expect(env).toMatchObject({
      ZIBBY_CHAT_GATE_URL: gate.url,
      ZIBBY_CHAT_GATE_TOKEN: "t",
      ZIBBY_CHAT_GATE_DEADLINE_S: "330",
    });
    expect(opencodeChatEnv("/tmp/c.json", "/repo", []).ZIBBY_CHAT_GATE_URL).toBeUndefined();
  });

  it("drops inherited OPENCODE_* and pins PWD", () => {
    process.env.OPENCODE_PERMISSION = "allow";
    try {
      const env = opencodeChatEnv("/tmp/c.json", "/repo", ["zibby", "zibby-kb"]);
      expect(env.OPENCODE_PERMISSION).toBeUndefined();
      expect(env).toMatchObject({
        OPENCODE_CONFIG: "/tmp/c.json",
        OPENCODE_DISABLE_PROJECT_CONFIG: "1",
        PWD: "/repo",
        ZIBBY_CHAT_MCP_SERVERS: "zibby,zibby-kb",
        ZIBBY_CHAT_DENY_TOOLS: "",
      });
    } finally {
      delete process.env.OPENCODE_PERMISSION;
    }
  });
});

describe("parseOpencodeChatLine", () => {
  const ids = ["zibby", "zibby-kb"];
  it("maps text, session, tools (longest server id first) and errors", () => {
    expect(
      parseOpencodeChatLine(
        JSON.stringify({ type: "text", sessionID: "s", part: { text: "Ahoj" } }),
        ids,
      ),
    ).toEqual([
      { type: "session", sessionId: "s" },
      { type: "delta", text: "Ahoj", block: true },
    ]);
    const tool = (name: string, status = "completed") =>
      parseOpencodeChatLine(
        JSON.stringify({
          type: "tool_use",
          part: { id: "c1", tool: name, state: { status, input: { q: 1 } } },
        }),
        ids,
      );
    expect(tool("zibby-kb_kb_search")).toEqual([
      { type: "tool", name: "mcp__zibby-kb__kb_search", input: { q: 1 }, id: "c1" },
    ]);
    expect(tool("zibby_create_task")[0]).toMatchObject({ name: "mcp__zibby__create_task" });
    expect(tool("shell", "error")[0]).toMatchObject({ name: "shell", failed: true });
    expect(
      parseOpencodeChatLine(JSON.stringify({ type: "error", error: { message: "boom" } })),
    ).toEqual([{ type: "error", message: "opencode: boom" }]);
    expect(parseOpencodeChatLine("not json")).toEqual([]);
    expect(parseOpencodeChatLine(JSON.stringify({ type: "step_finish", part: {} }))).toEqual([]);
  });
});

describe("opencode chat gate plugin", () => {
  const env = { ZIBBY_CHAT_MCP_SERVERS: "zibby,zibby-kb,opencode" };
  it("only lets mounted MCP tools through", async () => {
    expect(isMountedMcpTool("zibby_create_task", env)).toBe(true);
    expect(isMountedMcpTool("zibby-kb_kb_read", env)).toBe(true);
    expect(isMountedMcpTool("zibby_", env)).toBe(false);
    for (const t of [
      "shell",
      "write",
      "edit",
      "read",
      "execute",
      "skill",
      "opencode_session_move",
      "task",
    ]) {
      expect(isMountedMcpTool(t, env)).toBe(false);
    }
  });

  it("execute.before throws and evaluate denies for anything else (default deny)", async () => {
    const hooks: Record<string, (e: Record<string, unknown>) => unknown> = {};
    const reg =
      (name: string) => async (_: string, fn: (e: Record<string, unknown>) => unknown) => {
        hooks[name] = fn;
      };
    process.env.ZIBBY_CHAT_MCP_SERVERS = "zibby";
    try {
      await plugin.setup({ permission: { hook: reg("evaluate") }, tool: { hook: reg("before") } });
      // a gated call with no gate env is held back and refused (fail closed)
      await expect(
        hooks.before?.({ tool: "shell", input: { command: "rm -rf /" } }),
      ).rejects.toThrow(/Blocked by the ZibbyOS gate: .*not configured/);
      await expect(hooks.before?.({ tool: "write", input: { filePath: "a" } })).rejects.toThrow(
        /Blocked by the ZibbyOS gate/,
      );
      await hooks.before?.({ tool: "shell", input: { command: "git status" } });
      await hooks.before?.({ tool: "zibby_recall_memory", input: {} });
      const ask = { action: "write", effect: "ask" };
      hooks.evaluate?.(ask);
      expect(ask.effect).toBe("deny");
      const shell = { action: "shell", effect: "ask" };
      hooks.evaluate?.(shell);
      expect(shell.effect).toBe("allow");
      const mcp = { action: "zibby_recall_memory", effect: "ask" };
      hooks.evaluate?.(mcp);
      expect(mcp.effect).toBe("allow");
      const denied = { action: "zibby_create_task", effect: "deny" };
      hooks.evaluate?.(denied);
      expect(denied.effect).toBe("deny");
    } finally {
      delete process.env.ZIBBY_CHAT_MCP_SERVERS;
    }
  });

  it("denies a mounted tool named in ZIBBY_CHAT_DENY_TOOLS (an @agent turn's create_task)", async () => {
    const hooks: Record<string, (e: Record<string, unknown>) => unknown> = {};
    const reg =
      (name: string) => async (_: string, fn: (e: Record<string, unknown>) => unknown) => {
        hooks[name] = fn;
      };
    process.env.ZIBBY_CHAT_MCP_SERVERS = "zibby";
    process.env.ZIBBY_CHAT_DENY_TOOLS = "zibby_create_task";
    try {
      await plugin.setup({ permission: { hook: reg("evaluate") }, tool: { hook: reg("before") } });
      await expect(hooks.before?.({ tool: "zibby_create_task", input: {} })).rejects.toThrow(
        /Blocked by the ZibbyOS gate/,
      );
      await hooks.before?.({ tool: "zibby_recall_memory", input: {} });
      const ask = { action: "zibby_create_task", effect: "ask" };
      hooks.evaluate?.(ask);
      expect(ask.effect).toBe("deny");
    } finally {
      delete process.env.ZIBBY_CHAT_MCP_SERVERS;
      delete process.env.ZIBBY_CHAT_DENY_TOOLS;
    }
  });

  describe("chatGateReason", () => {
    const env = {
      ZIBBY_CHAT_MCP_SERVERS: "zibby,zibby-kb,plugin_context7_context7,atlassian",
      PWD: "/repo",
    };
    const verdict = (tool: string, input: unknown) => chatGateReason(tool, input, env);

    it("runs unclassified shell commands and file reads", () => {
      expect(verdict("shell", { command: "git status" })).toBeNull();
      expect(verdict("shell", { command: "ls -la && git log --oneline -5" })).toBeNull();
      expect(verdict("read", { filePath: "/repo/README.md" })).toBeNull();
      expect(verdict("grep", { pattern: "foo", path: "/repo" })).toBeNull();
    });

    it("returns EVERY classified intent of a chained command, deduplicated", () => {
      const r = verdict("shell", {
        command: "echo ok && git push --force origin main && rm -rf build",
      });
      expect(r.intents.map((i: { action: string }) => i.action)).toEqual(
        expect.arrayContaining(["git.force_push", "delete"]),
      );
      const dup = verdict("shell", { command: "git push origin a; git push origin a" });
      expect(dup.intents.filter((i: { action: string }) => i.action === "git.push")).toHaveLength(
        1,
      );
    });

    it("returns the classified intent of a gated shell command (no refusal)", () => {
      for (const [command, action] of [
        ["git push origin main", "git.push"],
        ["rm -rf build", "delete"],
        ["npm publish", "deploy"],
      ] as const) {
        expect(verdict("shell", { command })).toMatchObject({ intents: [{ action }] });
      }
      expect(verdict("shell", { command: "claude -p hi" })).toMatchObject({
        reason: expect.stringMatching(/nested/),
      });
    });

    it("refuses the operator-only surface", () => {
      expect(verdict("read", { filePath: "~/.config/zibby/operator-token" })).toMatchObject({
        reason: expect.stringMatching(/operator/),
      });
      expect(verdict("shell", { command: "cat ~/.config/zibby/operator-token" })).toMatchObject({
        reason: expect.stringMatching(/operator/),
      });
    });

    it("refuses the operator dir reached through the shell workdir (#3, #7)", () => {
      for (const input of [
        { command: "cat operator-token", workdir: "~/.config/zibby" },
        { command: "cat zibby/operator-token", workdir: "~/.config" },
        { command: "ls", workdir: "$HOME/.config/zibby" },
        { command: "cat ~/.con'fig'/zib\\by/operator-token" },
      ]) {
        expect(verdict("shell", input), JSON.stringify(input)).toMatchObject({
          reason: expect.stringMatching(/operator/),
        });
      }
    });

    it("sends the resolved workdir (with ~ expanded) as cwd (#3)", () => {
      const r = verdict("shell", { command: "rm -rf build", workdir: "sub dir" });
      expect(r).toMatchObject({ cwd: "/repo/sub dir", intents: [{ action: "delete" }] });
      const home = verdict("shell", { command: "rm -rf build", workdir: "~/a b" });
      expect(home.cwd).toBe(join(homedir(), "a b"));
      expect(verdict("shell", { command: "rm -rf build" })).not.toHaveProperty("cwd");
    });

    it("marks opaque shell forms shell.opaque, never a silent run (#6)", () => {
      for (const command of [
        "bash -c 'rm -rf ~/x'",
        'sh -c "git push -f origin main"',
        "zsh -c ls",
        "eval 'git push origin main'",
        "exec git push",
        "echo `git push origin main`",
        "echo $(git push origin main)",
        "env git push origin main",
        "sudo git push origin main",
        "command git push origin main",
        "printf x | xargs git push",
        "nohup git push &",
        "{ git push origin main; }",
        "if true; then git push origin main; fi",
        "for b in main; do git push origin $b; done",
        "while true; do ls; done",
        "python3 -c 'import os'",
        "node -e 'process.exit(0)'",
        "perl -e 1",
        "ruby -e 1",
        "curl -X POST http://x",
        "curl -XDELETE http://x",
        "curl --request=PUT http://x",
        "curl -d a=1 http://x",
        "curl --data-binary @f http://x",
        "curl -F f=@x http://x",
        "curl -T f http://x",
        "wget --post-data=a http://x",
        "echo 'git push' | bash",
        "python3 - <<'PY'\nimport subprocess\nPY",
        "node <<'EOF'\nrequire('child_process')\nEOF",
        "echo 'import os' | python3",
        "python3 < x.py",
        "git \\\npush origin main",
        "g''it push origin main",
        "$GIT push origin main",
      ]) {
        const r = verdict("shell", { command });
        expect(
          r?.intents?.some((i: { action: string }) => i.action === "shell.opaque"),
          command,
        ).toBe(true);
      }
      for (const command of [
        "git status",
        "curl -sSL https://example.com",
        "curl -X GET http://x",
        "wget http://x",
        "python3 script.py",
        "node --version",
        "cat > /tmp/n.md <<'EOF'\n`code` $(x)\nEOF",
      ]) {
        const r = verdict("shell", { command });
        expect(
          r?.intents?.some((i: { action: string }) => i.action === "shell.opaque") ?? false,
          command,
        ).toBe(false);
      }
    });

    it("keeps every distinct push of a chain (#2)", () => {
      const r = verdict("shell", { command: "git push --tags && git push origin dev main" });
      expect(r.intents.map((i: { branches?: string[] }) => i.branches)).toEqual([
        undefined,
        ["dev", "main"],
      ]);
    });

    it("operator MCP: reads run, writes return intents; own servers always run", () => {
      expect(verdict("plugin_context7_context7_query-docs", { q: "x" })).toBeNull();
      expect(verdict("atlassian_getJiraIssue", { issueIdOrKey: "A-1" })).toBeNull();
      expect(verdict("atlassian_createJiraIssue", {})).toHaveProperty("intents");
      expect(verdict("zibby_create_task", {})).toBeNull();
      expect(verdict("zibby-kb_kb_write", {})).toBeNull();
    });

    it("always refuses a PR comment reply (propose_pr_replies) and a nested agent", () => {
      const reply = "gh api repos/o/r/pulls/1/comments/2/replies -f body=hi";
      expect(verdict("shell", { command: reply })).toMatchObject({
        reason: expect.stringMatching(/propose_pr_replies/),
      });
    });

    it("refuses write/edit/execute/web and unmounted tools", () => {
      for (const tool of ["write", "edit", "patch", "execute", "webfetch", "skill", "task"]) {
        expect(verdict(tool, {})).toMatchObject({
          reason: expect.stringMatching(/only the shell/),
        });
      }
      expect(verdict("serena_find_symbol", {})).toMatchObject({
        reason: expect.stringMatching(/only the shell/),
      });
    });
  });

  describe("chatGateCall (inline approvals, fail closed)", () => {
    const gateEnv = {
      ZIBBY_CHAT_GATE_URL: "http://127.0.0.1:3333/api/chat/gate?conversationId=c1",
      ZIBBY_CHAT_GATE_TOKEN: "tok",
      ZIBBY_CHAT_GATE_DEADLINE_S: "330",
    };
    const input = { command: "git push origin main" };
    const intents = [{ action: "git.push" }] as never;
    const json = (body: unknown, ok = true) =>
      ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;
    const run = (fetchImpl: typeof fetch, env: Record<string, string> = gateEnv) =>
      chatGateCall("shell", input, intents, env, fetchImpl);

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("posts the hash with the chat bearer and runs on allow", async () => {
      const f = vi.fn(async () => json({ decision: "allow" }));
      await run(f as never);
      const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe(gateEnv.ZIBBY_CHAT_GATE_URL);
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
      expect(JSON.parse(init.body as string)).toMatchObject({
        tool: "shell",
        hash: chatGateHash("shell", input),
        intents,
      });
    });

    it("refuses on deny", async () => {
      const f = vi.fn(async () => json({ decision: "deny", reason: "merge is never allowed" }));
      await expect(run(f as never)).rejects.toThrow(/merge is never allowed.*Do not retry/);
    });

    it("a deny reason ending in a period gets no double period", async () => {
      const f = vi.fn(async () => json({ decision: "deny", reason: 'denies "pr.merge".' }));
      const err = (await run(f as never).catch((e: Error) => e)) as Error;
      expect(err.message).toContain('denies "pr.merge". Do not retry');
      expect(err.message).not.toContain("..");
    });

    it("sends the resolved cwd when given, outside the hash", async () => {
      const f = vi.fn(async () => json({ decision: "allow" }));
      await chatGateCall("shell", input, intents, gateEnv, f as never, "/repo/a b");
      const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toMatchObject({
        cwd: "/repo/a b",
        hash: chatGateHash("shell", input),
      });
    });

    it("pending then approved releases the call", async () => {
      const f = vi
        .fn()
        .mockResolvedValueOnce(json({ decision: "pending", approvalId: "a/b" }))
        .mockResolvedValueOnce(json({ status: "pending" }))
        .mockResolvedValueOnce(json({ status: "approved" }));
      const p = run(f as never);
      await vi.advanceTimersByTimeAsync(3000);
      await expect(p).resolves.toBeUndefined();
      expect(f.mock.calls[1]?.[0]).toBe(
        "http://127.0.0.1:3333/api/chat/gate/a%2Fb?conversationId=c1",
      );
    });

    it("pending then rejected refuses with a do-not-retry text", async () => {
      const f = vi
        .fn()
        .mockResolvedValueOnce(json({ decision: "pending", approvalId: "x" }))
        .mockResolvedValueOnce(json({ status: "rejected" }));
      const p = run(f as never);
      const caught = p.catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(1500);
      const err = (await caught) as Error;
      expect(err.message).toMatch(/rejected "git.push".*Do not retry it or work around it/);
    });

    it("stops at the plugin deadline while still pending", async () => {
      const f = vi
        .fn()
        .mockResolvedValueOnce(json({ decision: "pending", approvalId: "x" }))
        .mockResolvedValue(json({ status: "pending" }));
      const p = run(f as never, { ...gateEnv, ZIBBY_CHAT_GATE_DEADLINE_S: "3" });
      const caught = p.catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(5000);
      expect(((await caught) as Error).message).toMatch(/no decision in time/);
    });

    it("refuses when the input changed after the approval", async () => {
      const mutable = { command: "git push origin main" };
      const f = vi
        .fn()
        .mockResolvedValueOnce(json({ decision: "pending", approvalId: "x" }))
        .mockImplementationOnce(async () => {
          mutable.command = "git push --force";
          return json({ status: "approved" });
        });
      const p = chatGateCall("shell", mutable, intents, gateEnv, f as never);
      const caught = p.catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(1500);
      expect(((await caught) as Error).message).toMatch(/changed after it was approved/);
    });

    it("fails closed on a network error, a non-2xx, a bad body and a missing env", async () => {
      await expect(
        run(vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as never),
      ).rejects.toThrow(/could not be reached/);
      await expect(run(vi.fn(async () => json({}, false)) as never)).rejects.toThrow(/HTTP 500/);
      await expect(run(vi.fn(async () => json({ nope: 1 })) as never)).rejects.toThrow(
        /unreadable/,
      );
      await expect(run(vi.fn() as never, {})).rejects.toThrow(/not configured/);
    });

    it("serialises two concurrent execute.before calls", async () => {
      const hooks: Record<string, (e: Record<string, unknown>) => unknown> = {};
      await plugin.setup({
        permission: { hook: async () => undefined },
        tool: {
          hook: async (n: string, fn: (e: Record<string, unknown>) => unknown) => {
            hooks[n] = fn;
          },
        },
      });
      const order: string[] = [];
      const real = globalThis.fetch;
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => (release = r));
      globalThis.fetch = (async (_u: string, init: RequestInit) => {
        order.push(JSON.parse(init.body as string).tool);
        await gate;
        return json({ decision: "allow" });
      }) as never;
      Object.assign(process.env, gateEnv);
      try {
        const a = hooks["execute.before"]?.({
          tool: "shell",
          input: { command: "git push origin a" },
        });
        const b = hooks["execute.before"]?.({
          tool: "shell",
          input: { command: "git push origin b" },
        });
        await vi.advanceTimersByTimeAsync(10);
        expect(order).toHaveLength(1); // the second waits for the first
        release();
        await Promise.all([a, b]);
        expect(order).toHaveLength(2);
      } finally {
        globalThis.fetch = real;
        for (const k of Object.keys(gateEnv)) delete process.env[k];
      }
    });
  });
});

describe("preferGlobalBin", () => {
  const root = mkdtempSync(join(tmpdir(), "npmroot-"));
  mkdirSync(join(root, "@scope/pkg"), { recursive: true });
  writeFileSync(
    join(root, "@scope/pkg/package.json"),
    JSON.stringify({ bin: { "pkg-mcp": "cli.js" } }),
  );
  writeFileSync(join(root, "@scope/pkg/cli.js"), "");
  const bin = join(root, "@scope/pkg/cli.js");

  it("rewrites unversioned and @latest, handling -y and keeping other args", () => {
    expect(preferGlobalBin("npx", ["@scope/pkg"], root)).toEqual([bin]);
    expect(preferGlobalBin("npx", ["-y", "@scope/pkg@latest", "--x"], root)).toEqual([bin, "--x"]);
  });

  it("leaves pinned, uninstalled and non-npx commands alone", () => {
    expect(preferGlobalBin("npx", ["@scope/pkg@0.0.83"], root)).toEqual([
      "npx",
      "@scope/pkg@0.0.83",
    ]);
    expect(preferGlobalBin("npx", ["other"], root)).toEqual(["npx", "other"]);
    expect(preferGlobalBin("serena", ["a"], root)).toEqual(["serena", "a"]);
  });
});

describe("BlueCode provider block (A34)", () => {
  it("is in the config only when BlueCode is configured", async () => {
    for (const configured of [true, false]) {
      const bc = await withBlueCodeDir(configured);
      try {
        const config = buildOpencodeChatConfig("P", {}).config;
        if (configured)
          expect(config.provider).toMatchObject({
            bluecode: { npm: "@ai-sdk/openai-compatible", options: { apiKey: FAKE_BLUECODE_KEY } },
          });
        else expect(config).not.toHaveProperty("provider");
      } finally {
        await bc.restore();
      }
    }
  });
});
