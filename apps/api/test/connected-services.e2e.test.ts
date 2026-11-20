import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

describe("Connected services API (e2e)", () => {
  let app: INestApplication;
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "connsvc-e2e-"));
    process.env.AGENTS_DIR = path.join(dir, "agents");
    process.env.AGENT_RUNS_DIR = path.join(dir, "runs");
    process.env.CONNECTED_SERVICES_DIR = path.join(dir, "defs");
    process.env.BROWSER_PROFILES_DIR = path.join(dir, "profiles");
    await fs.mkdir(process.env.CONNECTED_SERVICES_DIR, { recursive: true });
    await fs.writeFile(
      path.join(process.env.CONNECTED_SERVICES_DIR, "s.json"),
      JSON.stringify({
        id: "s",
        name: "S",
        landingUrl: "https://s.example",
        loginUrl: "https://s.example/login",
        profile: "s",
        authCookies: [{ host: ".s.example", names: ["sid"] }],
      }),
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
    for (const k of [
      "AGENTS_DIR",
      "AGENT_RUNS_DIR",
      "CONNECTED_SERVICES_DIR",
      "BROWSER_PROFILES_DIR",
    ])
      delete process.env[k];
  });

  it("lists services without leaking authCookies", async () => {
    const res = await request(app.getHttpServer()).get("/api/connected-services").expect(200);
    expect(res.body).toEqual([
      {
        id: "s",
        name: "S",
        landingUrl: "https://s.example",
        loginUrl: "https://s.example/login",
        profile: "s",
        status: "disconnected",
      },
    ]);
  });

  it("404s connect for an unknown id (never launches Chrome)", async () => {
    await request(app.getHttpServer()).post("/api/connected-services/nope/connect").expect(404);
  });
});
