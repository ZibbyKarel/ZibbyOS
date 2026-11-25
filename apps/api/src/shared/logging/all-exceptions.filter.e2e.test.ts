import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { ActivityPage } from "@zibby/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ActivityLogModule } from "../../activity/activity-log.module";
import { LoggingModule } from "./logging.module";

@Controller()
class BoomController {
  @Get("boom")
  boom(): never {
    throw new Error("kaboom");
  }
}

describe("AllExceptionsFilter → activity log (e2e)", () => {
  let app: INestApplication;
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-error-e2e-"));
    process.env.ACTIVITY_DIR = dir;
    const moduleRef = await Test.createTestingModule({
      imports: [LoggingModule, ActivityLogModule],
      controllers: [BoomController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.ACTIVITY_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("records a 5xx as an api-error entry whose traceId matches the response and carries the stack", async () => {
    const res = await request(app.getHttpServer()).get("/boom?secret=1").expect(500);
    expect(res.body.message).toBe("Internal server error");
    expect(JSON.stringify(res.body)).not.toContain("kaboom");
    expect(res.body.traceId).toBeTruthy();

    // `record` is fire-and-forget (the append lands just after the response) — poll.
    let entry: ActivityPage["entries"][number] | undefined;
    for (let i = 0; i < 40 && !entry; i++) {
      const page = await request(app.getHttpServer()).get("/api/activity/page").expect(200);
      entry = (page.body as ActivityPage).entries.find((e) => e.kind === "api-error");
      if (!entry) await new Promise((r) => setTimeout(r, 25));
    }

    expect(entry?.traceId).toBe(res.body.traceId);
    expect(entry?.refs.stack).toContain("kaboom");
    expect(entry?.refs.request).toBe("GET /boom");
    expect(entry?.summary).not.toContain("secret=1");
    expect(entry?.summary).not.toContain("    at ");
  });
});
