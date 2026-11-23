import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { TaskTarget } from "@zibby/contracts";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CanvasStore, CanvasStoreError } from "../canvas/canvas.store";
import { AutopilotService } from "../autopilot/autopilot.service";
import { ChatMcpAuthGuard } from "./chat-mcp-auth.guard";
import { ChatMcpAuthService } from "./chat-mcp-auth.service";
import { ChatMcpController } from "./chat-mcp.controller";
import { ChatToolResultRegistry } from "./chat-tool-result.registry";
import { ChatToolsService } from "./chat-tools.service";
import { SelfApiExecutor } from "./self-api/self-api.executor";

const getStatus = vi.fn<() => Promise<string>>();
const recallMemory = vi.fn<(query: string) => Promise<string>>();
const createTask = vi.fn();
const selfApiList = vi.fn<() => string>();
const selfApiDescribe = vi.fn();
const selfApiCall = vi.fn();
const proposeRename = vi.fn();
const proposeOpenMaps = vi.fn();
const proposeOpenFolder = vi.fn();
const capturePersonalNote = vi.fn<() => Promise<string>>();
const autopilotSet = vi.fn();
const canvasPublish = vi.fn();
const canvasSetParams = vi.fn();
const canvasGet = vi.fn();
const canvasEffective = vi.fn();

/**
 * HTTP e2e for the chat MCP endpoint's NEW auth guard (T9). Same real-listening-port
 * shape as `../memory/entity-mcp.controller.test.ts` — a real TCP connection so the
 * guard's `req.socket.remoteAddress` loopback check exercises real conditions (a
 * `supertest` request against `app.getHttpServer()` connects over 127.0.0.1).
 */
describe("POST /api/chat/mcp — ChatMcpAuthGuard", () => {
  let app: INestApplication;
  let baseUrl: string;
  let auth: ChatMcpAuthService;

  let toolResults: ChatToolResultRegistry;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatMcpController],
      providers: [
        {
          provide: ChatToolsService,
          useValue: {
            getStatus,
            recallMemory,
            createTask,
            proposeRename,
            proposeOpenMaps,
            proposeOpenFolder,
            capturePersonalNote,
          },
        },
        {
          provide: SelfApiExecutor,
          useValue: { list: selfApiList, describe: selfApiDescribe, call: selfApiCall },
        },
        { provide: AutopilotService, useValue: { set: autopilotSet } },
        {
          provide: CanvasStore,
          useValue: {
            publish: canvasPublish,
            setParams: canvasSetParams,
            get: canvasGet,
            effective: canvasEffective,
          },
        },
        ChatToolResultRegistry,
        ChatMcpAuthService,
        ChatMcpAuthGuard,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    auth = moduleRef.get(ChatMcpAuthService);
    toolResults = moduleRef.get(ChatToolResultRegistry);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    getStatus.mockReset();
    recallMemory.mockReset();
    createTask.mockReset();
    proposeRename.mockReset();
    proposeOpenMaps.mockReset();
    proposeOpenFolder.mockReset();
    capturePersonalNote.mockReset();
    canvasPublish.mockReset();
    canvasSetParams.mockReset();
    canvasGet.mockReset();
    canvasEffective.mockReset();
  });

  const listToolsBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  };

  it("401s a request with no Authorization header, and never invokes a tool", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/chat/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send(listToolsBody);

    expect(res.status).toBe(401);
    expect(getStatus).not.toHaveBeenCalled();
    expect(recallMemory).not.toHaveBeenCalled();
    expect(createTask).not.toHaveBeenCalled();
  });

  it("401s a request with a malformed Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/chat/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Basic not-a-bearer-token")
      .send(listToolsBody);

    expect(res.status).toBe(401);
  });

  it("401s a request with the wrong token", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/chat/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Bearer not-the-real-token")
      .send(listToolsBody);

    expect(res.status).toBe(401);
  });

  it("reaches the MCP transport (200 JSON-RPC) with the correct bearer token", async () => {
    getStatus.mockResolvedValue("Nic teď nepotřebuje tvou pozornost.");

    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/chat/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${auth.bearerToken}` } },
    });
    const client = new Client({ name: "chat-mcp-test-client", version: "1.0.0" });
    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "api_call",
      "api_describe_operation",
      "api_list_operations",
      "autopilot_off",
      "capture_note",
      "create_task",
      "get_canvas",
      "get_status",
      "list_knowledge_bases",
      "machine_rename",
      "open_folder",
      "open_maps",
      "propose_pr_replies",
      "publish_canvas",
      "read_knowledge_base_note",
      "recall_memory",
      "search_knowledge_base",
      "set_canvas_params",
      "show_widget",
    ]);

    const result = await client.callTool({ name: "get_status", arguments: {} });
    const content = (result as { content: Array<{ type: "text"; text: string }> }).content;
    expect(content[0]?.text).toBe("Nic teď nepotřebuje tvou pozornost.");
    expect(getStatus).toHaveBeenCalledTimes(1);

    await client.close();
  });

  it("F8: capture_note round-trips to ChatToolsService.capturePersonalNote and back", async () => {
    capturePersonalNote.mockResolvedValue(
      "Zapsal jsem osobní poznámku (personal-jot) — v noci ji zařadím.",
    );

    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/chat/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${auth.bearerToken}` } },
    });
    const client = new Client({ name: "chat-mcp-test-client", version: "1.0.0" });
    await client.connect(transport);

    const result = await client.callTool({
      name: "capture_note",
      arguments: { text: "Zubař v úterý v 9", title: "Zubař" },
    });
    const content = (result as { content: Array<{ type: "text"; text: string }> }).content;
    expect(content[0]?.text).toContain("personal-jot");
    expect(capturePersonalNote).toHaveBeenCalledWith({
      text: "Zubař v úterý v 9",
      title: "Zubař",
    });

    await client.close();
  });

  it("Phase 4: autopilot_off pauses ZIBBY as `chat`; there is no on tool", async () => {
    autopilotSet.mockResolvedValue({ paused: true, pendingApprovals: 2 });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/chat/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${auth.bearerToken}` } },
    });
    const client = new Client({ name: "chat-mcp-test-client", version: "1.0.0" });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.filter((t) => t.name.startsWith("autopilot")).map((t) => t.name)).toEqual([
      "autopilot_off",
    ]);
    const result = await client.callTool({ name: "autopilot_off", arguments: {} });
    const content = (result as { content: Array<{ type: "text"; text: string }> }).content;
    expect(content[0]?.text).toContain("2");
    expect(autopilotSet).toHaveBeenCalledWith({ paused: true }, "chat");
    await client.close();
  });

  describe("D-020 — create_task's `mention` rule", () => {
    const agent: TaskTarget = { kind: "agent", id: "builder", name: "Builder" };
    const dept: TaskTarget = { kind: "department", id: "dev", name: "Dev" };

    async function connectFor(conversationId: string) {
      const transport = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/api/chat/mcp?conversationId=${conversationId}`),
        { requestInit: { headers: { Authorization: `Bearer ${auth.bearerToken}` } } },
      );
      const client = new Client({ name: "chat-mcp-test-client", version: "1.0.0" });
      await client.connect(transport);
      return client;
    }

    it("0 mentions: create_task dispatches with no explicit target — the classifier routes", async () => {
      createTask.mockResolvedValue({ text: "ok" });
      const client = await connectFor("conv-0");
      await client.callTool({ name: "create_task", arguments: { text: "postav appku" } });
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ explicitTarget: undefined }),
      );
      await client.close();
    });

    it("1 mention: create_task uses it as the explicit target, `mention` omitted", async () => {
      createTask.mockResolvedValue({ text: "ok" });
      toolResults.setMentions("conv-1", [agent]);
      const client = await connectFor("conv-1");
      await client.callTool({ name: "create_task", arguments: { text: "postav appku" } });
      expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ explicitTarget: agent }));
      await client.close();
    });

    it("1 mention: a `mention` naming a DIFFERENT id errors instead of silently defaulting", async () => {
      const client = await connectFor("conv-1b");
      toolResults.setMentions("conv-1b", [agent]);
      const result = await client.callTool({
        name: "create_task",
        arguments: { text: "x", mention: "someone-else" },
      });
      expect(result.isError).toBe(true);
      expect(createTask).not.toHaveBeenCalled();
      await client.close();
    });

    it("≥2 mentions: omitting `mention` is a tool error, never a classifier fallback", async () => {
      toolResults.setMentions("conv-2", [agent, dept]);
      const client = await connectFor("conv-2");
      const result = await client.callTool({ name: "create_task", arguments: { text: "x" } });
      expect(result.isError).toBe(true);
      expect(createTask).not.toHaveBeenCalled();
      await client.close();
    });

    it("≥2 mentions: a `mention` naming one not in the turn's list is a tool error", async () => {
      toolResults.setMentions("conv-2b", [agent, dept]);
      const client = await connectFor("conv-2b");
      const result = await client.callTool({
        name: "create_task",
        arguments: { text: "x", mention: "nope" },
      });
      expect(result.isError).toBe(true);
      expect(createTask).not.toHaveBeenCalled();
      await client.close();
    });

    it("≥2 mentions: a `mention` naming one of them resolves that unit as the explicit target", async () => {
      createTask.mockResolvedValue({ text: "ok" });
      toolResults.setMentions("conv-2c", [agent, dept]);
      const client = await connectFor("conv-2c");
      await client.callTool({
        name: "create_task",
        arguments: { text: "x", mention: "dev" },
      });
      expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ explicitTarget: dept }));
      await client.close();
    });

    it("forwards the turn's attachmentSetId to createTask", async () => {
      createTask.mockResolvedValue({ text: "ok" });
      toolResults.setAttachmentSetId("conv-attach", "set_9");
      const client = await connectFor("conv-attach");
      await client.callTool({ name: "create_task", arguments: { text: "x" } });
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ attachmentSetId: "set_9" }),
      );
      await client.close();
    });
  });

  it("propose_pr_replies drops a pr-replies card into the in-flight turn", async () => {
    const shown: unknown[] = [];
    const off = toolResults.onWidget("conv-replies", (w) => shown.push(w));
    const client = new Client({ name: "chat-mcp-test-client", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/api/chat/mcp?conversationId=conv-replies`),
        { requestInit: { headers: { Authorization: `Bearer ${auth.bearerToken}` } } },
      ),
    );
    const result = await client.callTool({
      name: "propose_pr_replies",
      arguments: {
        prUrl: "https://github.com/o/r/pull/7",
        replies: [{ threadId: "PRRT_a", body: "Thanks!", resolve: true }],
      },
    });
    expect(result.isError).toBeFalsy();
    expect(shown).toEqual([
      {
        kind: "pr-replies",
        repo: "o/r",
        number: 7,
        url: "https://github.com/o/r/pull/7",
        replies: [{ threadId: "PRRT_a", body: "Thanks!", resolve: true }],
      },
    ]);
    const bad = await client.callTool({
      name: "propose_pr_replies",
      arguments: { prUrl: "https://example.com/x", replies: [{ threadId: "PRRT_a", body: "x" }] },
    });
    expect(bad.isError).toBe(true);
    off();
    await client.close();
  });

  it("publish_canvas publishes, pushes a canvas widget, and surfaces store errors", async () => {
    const shown: unknown[] = [];
    const off = toolResults.onWidget("conv-canvas", (w) => shown.push(w));
    const client = new Client({ name: "chat-mcp-test-client", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/api/chat/mcp?conversationId=conv-canvas`),
        { requestInit: { headers: { Authorization: `Bearer ${auth.bearerToken}` } } },
      ),
    );
    canvasPublish.mockResolvedValueOnce({ id: "abcde12345", title: "Chart", current: 1 });
    const ok = await client.callTool({
      name: "publish_canvas",
      arguments: { title: "Chart", html: "<p>x</p>" },
    });
    expect(ok.isError).toBeFalsy();
    expect(canvasPublish).toHaveBeenLastCalledWith({
      title: "Chart",
      html: "<p>x</p>",
      conversationId: "conv-canvas",
    });
    expect((ok.content as Array<{ text: string }>)[0]?.text).toContain('id "abcde12345"');

    canvasPublish.mockResolvedValueOnce({ id: "abcde12345", title: "Chart", current: 2 });
    await client.callTool({
      name: "publish_canvas",
      arguments: { title: "Chart", html: "<p>y</p>", id: "abcde12345", note: "fix" },
    });
    expect(canvasPublish).toHaveBeenLastCalledWith({
      title: "Chart",
      html: "<p>y</p>",
      conversationId: "conv-canvas",
      id: "abcde12345",
      note: "fix",
    });
    expect(shown).toEqual([
      { kind: "canvas", id: "abcde12345", version: 1, title: "Chart" },
      { kind: "canvas", id: "abcde12345", version: 2, title: "Chart" },
    ]);

    const badId = await client.callTool({
      name: "publish_canvas",
      arguments: { title: "Chart", html: "<p>y</p>", id: "NOPE" },
    });
    expect(badId.isError).toBe(true);

    canvasPublish.mockRejectedValueOnce(new CanvasStoreError("not-found", "unknown canvas id"));
    const rejected = await client.callTool({
      name: "publish_canvas",
      arguments: { title: "Chart", html: "<p>y</p>", id: "zzzzzzzzzz" },
    });
    expect(rejected.isError).toBe(true);
    expect((rejected.content as Array<{ text: string }>)[0]?.text).toContain("unknown canvas id");
    expect(shown).toHaveLength(2);
    off();
    await client.close();
  });

  it("set_canvas_params pushes the widget, rejects bad params; get_canvas returns JSON", async () => {
    const shown: unknown[] = [];
    const off = toolResults.onWidget("conv-canvas2", (w) => shown.push(w));
    const client = new Client({ name: "chat-mcp-test-client", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/api/chat/mcp?conversationId=conv-canvas2`),
        { requestInit: { headers: { Authorization: `Bearer ${auth.bearerToken}` } } },
      ),
    );
    canvasSetParams.mockResolvedValueOnce({ id: "abcde12345", title: "Chart", current: 3 });
    const ok = await client.callTool({
      name: "set_canvas_params",
      arguments: { id: "abcde12345", params: { w: 5 }, note: "wider" },
    });
    expect(ok.isError).toBeFalsy();
    expect(canvasSetParams).toHaveBeenLastCalledWith(
      "abcde12345",
      { w: 5 },
      { by: "agent", note: "wider" },
    );
    expect((ok.content as Array<{ text: string }>)[0]?.text).toBe(
      "Set params on canvas abcde12345 (v3).",
    );
    expect(shown).toEqual([{ kind: "canvas", id: "abcde12345", version: 3, title: "Chart" }]);

    canvasSetParams.mockRejectedValueOnce(new CanvasStoreError("bad-params", '"w" must be <= 9'));
    const bad = await client.callTool({
      name: "set_canvas_params",
      arguments: { id: "abcde12345", params: { w: 50 } },
    });
    expect(bad.isError).toBe(true);
    expect((bad.content as Array<{ text: string }>)[0]?.text).toBe(
      'Canvas rejected: "w" must be <= 9',
    );
    expect(shown).toHaveLength(1);

    canvasGet.mockResolvedValueOnce({
      id: "abcde12345",
      title: "Chart",
      current: 2,
      versions: [
        {
          version: 1,
          kind: "code",
          at: "2026-01-01T00:00:00.000Z",
          manifest: {
            params: [{ id: "w", label: "Width", type: "number", min: 1, max: 9, value: 4 }],
            net: ["https://api.example.com"],
          },
        },
        { version: 2, kind: "params", base: 1, by: "agent", at: "2026-01-01T00:01:00.000Z" },
      ],
    });
    canvasEffective.mockResolvedValueOnce({ html: "", params: { w: 6 }, codeVersion: 1 });
    const got = await client.callTool({ name: "get_canvas", arguments: { id: "abcde12345" } });
    expect(got.isError).toBeFalsy();
    const body = JSON.parse((got.content as Array<{ text: string }>)[0]?.text ?? "");
    expect(body).toMatchObject({
      title: "Chart",
      current: 2,
      params: [{ id: "w", label: "Width", type: "number", min: 1, max: 9 }],
      values: { w: 6 },
      net: ["https://api.example.com"],
    });
    expect(body.versions).toHaveLength(2);

    canvasGet.mockResolvedValueOnce(null);
    const missing = await client.callTool({ name: "get_canvas", arguments: { id: "zzzzzzzzzz" } });
    expect(missing.isError).toBe(true);
    off();
    await client.close();
  });

  describe("self-api tools", () => {
    async function connect() {
      const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/chat/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${auth.bearerToken}` } },
      });
      const client = new Client({ name: "chat-mcp-test-client", version: "1.0.0" });
      await client.connect(transport);
      return client;
    }

    it("api_call forwards to the executor and maps a failure to isError", async () => {
      selfApiCall.mockResolvedValueOnce({ ok: false, text: "HTTP 400\n{}" });
      const mcpClient = await connect();
      const res = await mcpClient.callTool({
        name: "api_call",
        arguments: { operation: "projects.updateProject", params: { id: "x" }, body: {} },
      });
      expect(selfApiCall).toHaveBeenCalledWith("projects.updateProject", {
        params: { id: "x" },
        body: {},
      });
      expect(res.isError).toBe(true);
    });

    it("api_call returns a success as plain text", async () => {
      selfApiCall.mockResolvedValueOnce({ ok: true, text: "HTTP 200\n{}" });
      const mcpClient = await connect();
      const res = await mcpClient.callTool({
        name: "api_call",
        arguments: { operation: "projects.listProjects" },
      });
      expect(res.isError).toBeFalsy();
    });
  });
});
