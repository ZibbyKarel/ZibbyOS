import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { GateEvaluatorService } from "../src/gates/gate-evaluator.service";
import { withOperator } from "./operator-token";

const cells = (over: Record<string, string> = {}) => ({
  autoReview: "manual",
  autoAddressComments: "manual",
  autoImplement: "manual",
  autoCommunicate: "manual",
  autoFixCi: "manual",
  autoDecideGoals: "manual",
  ...over,
});
const AUTO_TREE = { global: cells({ autoAddressComments: "auto" }), companies: {}, teams: {} };

describe("Autopilot API (e2e)", () => {
  let app: INestApplication;
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "autopilot-e2e-"));
    process.env.AUTOPILOT_DIR = dir;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
    delete process.env.AUTOPILOT_DIR;
  });

  const server = () => app.getHttpServer();
  const evalComment = async () => {
    const gates = app.get(GateEvaluatorService);
    return gates.evaluate(await gates.rulesForAgent({}), { action: "gh.pr_comment" });
  };

  it("defaults to running with nothing on, and the pending count", async () => {
    const res = await request(server()).get("/api/autopilot").expect(200);
    expect(res.body).toMatchObject({ paused: false });
    expect(typeof res.body.pendingApprovals).toBe("number");
  });

  it("raising a cell without the operator token is 401 and changes nothing", async () => {
    await request(server()).put("/api/autopilot").send({ automation: AUTO_TREE }).expect(401);
    expect((await request(server()).get("/api/autopilot")).body.automation).toBeUndefined();
    await expect(fs.readFile(path.join(dir, "autopilot.json"), "utf8")).rejects.toThrow();
  });

  it("rejects unknown keys with 400/422", async () => {
    const res = await withOperator(request(server()).put("/api/autopilot")).send({
      paused: false,
      extra: 1,
    });
    expect([400, 422]).toContain(res.status);
  });

  it("an auto cell with the token lifts a covered gate; pause needs no token and restores it", async () => {
    expect((await evalComment()).decision).toBe("ask");

    const on = await withOperator(request(server()).put("/api/autopilot"))
      .send({ automation: AUTO_TREE })
      .expect(200);
    expect(on.body).toMatchObject({ paused: false, by: "operator" });
    expect(await evalComment()).toMatchObject({ decision: "notify", via: "autopilot" });
    expect(JSON.parse(await fs.readFile(path.join(dir, "autopilot.json"), "utf8"))).toMatchObject({
      paused: false,
    });

    const off = await request(server()).put("/api/autopilot").send({ paused: true }).expect(200);
    expect(off.body.paused).toBe(true);
    expect((await evalComment()).decision).toBe("ask");
  });

  it("resuming needs the operator token", async () => {
    await request(server()).put("/api/autopilot").send({ paused: false }).expect(401);
    expect((await request(server()).get("/api/autopilot")).body.paused).toBe(true);
    await withOperator(request(server()).put("/api/autopilot")).send({ paused: false }).expect(200);
    expect((await evalComment()).via).toBe("autopilot");
  });

  it("lowering a cell is open; raising one is not", async () => {
    const lower = { global: cells({ autoAddressComments: "semi" }), companies: {}, teams: {} };
    await request(server()).put("/api/autopilot").send({ automation: lower }).expect(200);
    expect((await evalComment()).decision).toBe("ask");
    await request(server()).put("/api/autopilot").send({ automation: AUTO_TREE }).expect(401);
    // A team override that raises is caught too.
    const team = { ...lower, teams: { devrel: { autoReview: "semi" } } };
    await request(server()).put("/api/autopilot").send({ automation: team }).expect(401);
  });

  it("stores and echoes the automation tree", async () => {
    const automation = {
      global: cells({ autoImplement: "semi" }),
      companies: { acme: { autoReview: "auto" } },
      teams: {},
    };
    const put = await withOperator(request(server()).put("/api/autopilot"))
      .send({ automation })
      .expect(200);
    expect(put.body.automation).toEqual(automation);
    expect((await request(server()).get("/api/autopilot").expect(200)).body.automation).toEqual(
      automation,
    );
    await request(server()).put("/api/autopilot").send({ paused: true }).expect(200);
  });

  it("a tokenless request cannot plant a raised tree, and the stored one stays", async () => {
    const stored = (await request(server()).get("/api/autopilot")).body.automation;
    await request(server())
      .put("/api/autopilot")
      .send({
        paused: true,
        automation: {
          global: cells({ autoImplement: "auto", autoReview: "auto", autoAddressComments: "auto" }),
          companies: {},
          teams: {},
        },
      })
      .expect(401);
    expect((await request(server()).get("/api/autopilot")).body.automation).toEqual(stored);
  });
});
