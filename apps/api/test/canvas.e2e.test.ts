import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { CanvasStore } from "../src/canvas/canvas.store";
import { withOperator } from "./operator-token";

describe("Canvas API (e2e)", () => {
  let app: INestApplication;
  let canvasDir: string;

  beforeAll(async () => {
    canvasDir = await fs.mkdtemp(path.join(os.tmpdir(), "canvas-e2e-"));
    process.env.CANVAS_DIR = canvasDir;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(canvasDir, { recursive: true, force: true });
    delete process.env.CANVAS_DIR;
  });

  it("gets a published canvas's meta; unknown/malformed id → 404", async () => {
    const meta = await app.get(CanvasStore).publish({ title: "Chart", html: "<p>hi</p>" });
    const res = await request(app.getHttpServer()).get(`/api/canvas/${meta.id}`).expect(200);
    expect(res.body).toMatchObject({ id: meta.id, title: "Chart", current: 1 });
    await request(app.getHttpServer()).get("/api/canvas/abcdefghij").expect(404);
    await request(app.getHttpServer()).get("/api/canvas/nope").expect(404);
  });

  const page = `<p/><script type="application/zibby+json">${JSON.stringify({
    params: [{ id: "n", label: "N", type: "number", min: 0, max: 10, value: 5 }],
    net: ["https://api.example.com"],
  })}</script>`;

  it("sets params (coalescing), rejects invalid ones, restores", async () => {
    const meta = await app.get(CanvasStore).publish({ title: "P", html: page });
    const http = app.getHttpServer();
    const post = (p: string, body: object) =>
      request(http).post(`/api/canvas/${meta.id}${p}`).send(body);
    const a = await post("/params", { params: { n: 3 } }).expect(200);
    expect(a.body.current).toBe(2);
    const b = await post("/params", { params: { n: 4 } }).expect(200);
    expect(b.body.versions).toHaveLength(2);
    expect(b.body.versions[1].params).toEqual({ n: 4 });
    const bad = await post("/params", { params: { n: 99 } }).expect(400);
    expect(bad.body.message).toContain("<= 10");
    await post("/params", { params: { zzz: 1 } }).expect(400);
    await request(http).post("/api/canvas/abcdefghij/params").send({ params: {} }).expect(404);
    const r = await post("/restore", { version: 1 }).expect(200);
    expect(r.body.current).toBe(3);
    expect(r.body.versions[2].kind).toBe("code");
    await post("/restore", { version: 42 }).expect(404);
  });

  it("grants need the operator token and a manifest origin", async () => {
    const meta = await app.get(CanvasStore).publish({ title: "G", html: page });
    const http = app.getHttpServer();
    const url = `/api/canvas/${meta.id}/grants`;
    await request(http).post(url).send({ origin: "https://api.example.com" }).expect(401);
    const ok = await withOperator(request(http).post(url))
      .send({ origin: "https://api.example.com" })
      .expect(200);
    expect(ok.body).toEqual({ grants: ["https://api.example.com"] });
    await withOperator(request(http).post(url)).send({ origin: "https://evil.com" }).expect(400);
    await withOperator(request(http).post("/api/canvas/abcdefghij/grants"))
      .send({ origin: "https://api.example.com" })
      .expect(404);
  });

  it("fetch is denied unless declared and granted", async () => {
    const meta = await app.get(CanvasStore).publish({ title: "F", html: page });
    const http = app.getHttpServer();
    const f = (u: string) => request(http).post(`/api/canvas/${meta.id}/fetch`).send({ url: u });
    expect((await f("https://other.com/x").expect(403)).body).toEqual({
      error: "not-allowed",
      origin: "https://other.com",
    });
    expect((await f("http://api.example.com/x").expect(403)).body.error).toBe("not-allowed");
    expect((await f("https://api.example.com/x").expect(403)).body).toEqual({
      error: "needs-grant",
      origin: "https://api.example.com",
    });
    await request(http)
      .post("/api/canvas/abcdefghij/fetch")
      .send({ url: "https://a.com" })
      .expect(404);
  });
});
