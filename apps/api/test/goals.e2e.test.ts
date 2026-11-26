import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { GoalStateStore } from "../src/goals/goal-state.store";

const BASE = "/api/goals";
const body = {
  id: "my-goal",
  name: "My goal",
  outcome: "Everything is fine.",
  scope: { kind: "none" },
  enabled: true,
};

describe("Goals API (e2e)", () => {
  let app: INestApplication;
  let dir: string;
  let states: GoalStateStore;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "goals-e2e-"));
    process.env.GOALS_DIR = dir;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    states = app.get(GoalStateStore);
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
    delete process.env.GOALS_DIR;
  });

  const http = () => request(app.getHttpServer());

  it("CRUD with roll-up, 409 duplicate, 404 unknown", async () => {
    const created = await http().post(BASE).send(body).expect(201);
    expect(created.body.ceiling).toBe("tier2");
    await http().post(BASE).send(body).expect(409);

    const list = await http().get(BASE).expect(200);
    const row = list.body.find((g: { id: string }) => g.id === "my-goal");
    expect(row.rollup.status).toBe("planning");

    const patched = await http().patch(`${BASE}/my-goal`).send({ enabled: false }).expect(200);
    expect(patched.body.enabled).toBe(false);
    const st = await http().get(`${BASE}/my-goal/state`).expect(200);
    expect(st.body.rollup.status).toBe("paused");
    expect(st.body.state.cycle.index).toBe(0);

    await http().get(`${BASE}/nope`).expect(404);
    await http().get(`${BASE}/nope/state`).expect(404);
    await http().get(`${BASE}/nope/timeline`).expect(404);
    await http().post(`${BASE}/nope/wake`).expect(404);
  });

  it("rejects mergeGrant on create and update, and deadline with cadence (422)", async () => {
    const mergeGrant = {
      projectIds: ["p"],
      until: "2026-12-01T00:00:00.000Z",
      grantedAt: "2026-11-30T00:00:00.000Z",
    };
    await http()
      .post(BASE)
      .send({ ...body, id: "mg", mergeGrant })
      .expect(422);
    await http().patch(`${BASE}/my-goal`).send({ mergeGrant }).expect(422);
    await http()
      .post(BASE)
      .send({
        ...body,
        id: "both",
        deadline: "2026-12-01T00:00:00.000Z",
        cadence: { every: "day", hour: 9 },
      })
      .expect(422);
    // A patch that would make the stored goal invalid is rejected too.
    await http()
      .patch(`${BASE}/my-goal`)
      .send({ deadline: "2026-12-01T00:00:00.000Z", cadence: { every: "day", hour: 9 } })
      .expect(422);
    await http().get(`${BASE}/mg`).expect(404);
  });

  it("wake, resume and timeline", async () => {
    await http()
      .post(BASE)
      .send({ ...body, id: "wr" })
      .expect(201);
    const goal = (await http().get(`${BASE}/wr`).expect(200)).body;
    const state = await states.read("wr", goal.createdAt);
    state.instances = {
      p1: { status: "parked", parkedReason: "failed", taskIds: [], fingerprint: "f" },
      p2: { status: "acting", taskIds: [], fingerprint: "g" },
    };
    await states.write(state);

    const rolled = await http().get(`${BASE}/wr/state`).expect(200);
    expect(rolled.body.rollup).toMatchObject({ status: "needs-you", needsYou: 1 });

    const woke = await http().post(`${BASE}/wr/wake`).expect(200);
    expect(woke.body.state.instances.p2.fingerprint).toBeUndefined();

    await http().post(`${BASE}/wr/instances/p2/resume`).expect(409);
    await http().post(`${BASE}/wr/instances/zzz/resume`).expect(404);
    const resumed = await http().post(`${BASE}/wr/instances/p1/resume`).expect(200);
    expect(resumed.body.state.instances.p1.status).toBe("planning");

    const tl = await http().get(`${BASE}/wr/timeline`).expect(200);
    expect(tl.body.map((e: { kind: string }) => e.kind)).toEqual(["wake", "resume"]);
    const only = await http().get(`${BASE}/wr/timeline?instance=p1&cycle=0`).expect(200);
    expect(only.body).toHaveLength(1);
  });

  it("delete removes the definition and its state dir", async () => {
    await http()
      .post(BASE)
      .send({ ...body, id: "del" })
      .expect(201);
    await states.appendTimeline("del", {
      at: "2026-11-26T00:00:00.000Z",
      cycle: 0,
      instance: "_",
      kind: "k",
      text: "t",
    });
    await http().delete(`${BASE}/del`).expect(200);
    await expect(fs.stat(path.join(dir, "state", "del"))).rejects.toThrow();
    await http().delete(`${BASE}/del`).expect(404);
  });
});
