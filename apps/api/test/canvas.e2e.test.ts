import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { CanvasStore } from "../src/canvas/canvas.store";

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
});
