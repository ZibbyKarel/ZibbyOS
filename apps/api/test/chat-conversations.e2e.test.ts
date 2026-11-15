import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

describe("Chat conversation management API (e2e)", () => {
  let app: INestApplication;
  let dir: string;
  const id = "conv_1731660000000_abc123";

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "chat-conv-e2e-"));
    process.env.AGENTS_DIR = path.join(dir, "agents");
    process.env.AGENT_RUNS_DIR = path.join(dir, "runs");
    process.env.CHAT_DIR = path.join(dir, "chat");
    await fs.mkdir(process.env.CHAT_DIR, { recursive: true });
    const message = { id: "m1", role: "user", text: "Deploy the API", at: "2026-11-15T10:00:00Z" };
    await fs.writeFile(
      path.join(process.env.CHAT_DIR, `${id}.jsonl`),
      `${JSON.stringify(message)}\n`,
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
    delete process.env.AGENTS_DIR;
    delete process.env.AGENT_RUNS_DIR;
    delete process.env.CHAT_DIR;
  });

  it("renames, searches with snippet, deletes, restores and clears", async () => {
    const http = request(app.getHttpServer());

    const renamed = await http
      .patch(`/api/chat/conversations/${id}`)
      .send({ title: "  Nasazení " });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ conversationId: id, title: "Nasazení" });
    expect((await http.patch(`/api/chat/conversations/${id}`).send({ title: "a\nb" })).status).toBe(
      400,
    );
    expect((await http.patch("/api/chat/conversations/nope").send({ title: "x" })).status).toBe(
      404,
    );

    const found = await http.get("/api/chat/conversations").query({ q: "deploy" });
    expect(found.body[0]).toMatchObject({ conversationId: id, snippet: "Deploy the API" });

    expect((await http.delete(`/api/chat/conversations/${id}`)).body).toEqual({
      conversationId: id,
    });
    expect((await http.get("/api/chat/conversations")).body).toEqual([]);
    expect((await http.delete(`/api/chat/conversations/${id}`)).status).toBe(404);

    const restored = await http.post(`/api/chat/conversations/${id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ conversationId: id, title: "Nasazení", messageCount: 1 });
    expect((await http.post(`/api/chat/conversations/${id}/restore`)).status).toBe(404);

    expect((await http.post(`/api/chat/conversations/${id}/clear`)).body).toEqual({
      conversationId: id,
    });
    expect((await http.get("/api/chat/conversations")).body).toEqual([]);
    const transcript = await http.get("/api/chat/transcript").query({ conversationId: id });
    expect(transcript.body).toMatchObject({ messages: [], sessionId: null });
    expect((await http.post(`/api/chat/conversations/${id}/restore`)).body.messageCount).toBe(1);
    expect((await http.post("/api/chat/conversations/..%2Fx/clear")).status).toBe(404);
  });
});
