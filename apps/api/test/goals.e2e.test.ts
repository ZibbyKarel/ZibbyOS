import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { GoalStateStore } from "../src/goals/goal-state.store";
import { withOperator } from "./operator-token";

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
    expect(row.rollup.counts).toEqual({ total: 0, done: 0, parked: 0, active: 0 });

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

  it("PATCH validates the merged goal and null clears fields", async () => {
    await http()
      .post(BASE)
      .send({ ...body, id: "std", cadence: { every: "day", hour: 9 }, cycleHours: 6 })
      .expect(201);
    expect(
      (await http().patch(`${BASE}/std`).send({ cycleHours: 12 }).expect(200)).body.cycleHours,
    ).toBe(12);
    await http()
      .post(BASE)
      .send({ ...body, id: "oneoff", deadline: "2026-12-01T00:00:00.000Z", predicate: "p" })
      .expect(201);
    const res = await http()
      .patch(`${BASE}/oneoff`)
      .send({ deadline: null, predicate: null, cadence: { every: "week", hour: 8 } })
      .expect(200);
    expect(res.body.cadence).toEqual({ every: "week", hour: 8 });
    expect(res.body).not.toHaveProperty("deadline");
    expect(res.body).not.toHaveProperty("predicate");
  });

  it("wake, resume and timeline", async () => {
    await http()
      .post(BASE)
      .send({ ...body, id: "wr" })
      // An intermittent 401 was seen here: print the body so the cause shows next time.
      .expect((res) => {
        if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
      });
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

  describe("merge grant (PUT/DELETE /goals/:id/merge-grant)", () => {
    const grantUrl = `${BASE}/mg3/merge-grant`;
    const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

    beforeAll(async () => {
      for (const [id, ceiling] of [
        ["mg3", "tier3"],
        ["mg2", "tier2"],
      ]) {
        await http()
          .post(BASE)
          .send({ ...body, id, ceiling, scope: { kind: "projects", projectIds: ["p1", "p2"] } })
          .expect(201);
      }
    });

    it("needs the operator token (401), even with a valid body; DELETE too", async () => {
      await http()
        .put(grantUrl)
        .send({ projectIds: ["p1"], until: inHours(2) })
        .expect(401);
      await http().delete(grantUrl).expect(401);
      const goal = await http().get(`${BASE}/mg3`).expect(200);
      expect(goal.body.mergeGrant).toBeUndefined();
    });

    it("422: more than 24 h, past, tier2 goal, project outside the scope, empty, grantedAt", async () => {
      const put = (url: string, b: object) => withOperator(http().put(url)).send(b);
      await put(grantUrl, { projectIds: ["p1"], until: inHours(25) }).expect(422);
      await put(grantUrl, { projectIds: ["p1"], until: inHours(-1) }).expect(422);
      await put(`${BASE}/mg2/merge-grant`, { projectIds: ["p1"], until: inHours(2) }).expect(422);
      await put(grantUrl, { projectIds: ["p9"], until: inHours(2) }).expect(422);
      await put(grantUrl, { projectIds: [], until: inHours(2) }).expect(422);
      await put(grantUrl, { projectIds: ["p1"], until: inHours(2), grantedAt: inHours(0) }).expect(
        422,
      );
      await put(`${BASE}/nope/merge-grant`, { projectIds: ["p1"], until: inHours(2) }).expect(404);
    });

    it("sets with the token (server-stamped grantedAt), survives a PATCH, PATCH cannot write it, DELETE clears", async () => {
      const until = inHours(23);
      const set = await withOperator(http().put(grantUrl))
        .send({ projectIds: ["p1"], until })
        .expect(200);
      expect(set.body.mergeGrant).toMatchObject({ projectIds: ["p1"], until });
      expect(Date.parse(set.body.mergeGrant.grantedAt)).toBeLessThanOrEqual(Date.now());

      const forged = { projectIds: ["p1", "p2"], until: inHours(24), grantedAt: inHours(0) };
      await withOperator(http().patch(`${BASE}/mg3`))
        .send({ mergeGrant: forged })
        .expect(422);
      await http().patch(`${BASE}/mg3`).send({ name: "Renamed" }).expect(200);
      const kept = await http().get(`${BASE}/mg3`).expect(200);
      expect(kept.body.mergeGrant.projectIds).toEqual(["p1"]);

      const cleared = await withOperator(http().delete(grantUrl)).expect(200);
      expect(cleared.body.mergeGrant).toBeUndefined();
    });
  });
});
