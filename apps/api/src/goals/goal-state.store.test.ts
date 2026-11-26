import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { GoalState } from "@zibby/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GoalStateStore, TIMELINE_CAP } from "./goal-state.store";
import { GoalInstanceNotFoundError, GoalInstanceNotParkedError } from "./goals.errors";

const T0 = "2026-11-26T00:00:00.000Z";

describe("GoalStateStore", () => {
  let dir: string;
  let store: GoalStateStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "goal-state-"));
    store = new GoalStateStore(dir);
  });
  afterEach(() => fs.rm(dir, { recursive: true, force: true }));

  const seed = async (): Promise<GoalState> => {
    const state = await store.read("g", T0);
    state.instances = {
      a: { status: "acting", taskIds: [], fingerprint: "x" },
      b: { status: "parked", parkedReason: "failed", taskIds: [], fingerprint: "y" },
    };
    await store.write(state);
    return state;
  };

  it("reads empty for a goal without state, and fails open on a corrupt file", async () => {
    const empty = await store.read("g", T0);
    expect(empty.cycle.index).toBe(0);
    expect(empty.instances).toEqual({});
    await fs.mkdir(path.join(dir, "state", "g"), { recursive: true });
    await fs.writeFile(path.join(dir, "state", "g", "state.json"), "{nope");
    expect((await store.read("g", T0)).instances).toEqual({});
  });

  it("wake clears fingerprints and logs", async () => {
    await seed();
    const s = await store.wake("g", T0);
    expect(Object.values(s.instances).every((i) => i.fingerprint === undefined)).toBe(true);
    expect((await store.read("g", T0)).instances.a?.fingerprint).toBeUndefined();
    expect((await store.timeline("g")).map((e) => e.kind)).toEqual(["wake"]);
  });

  it("resume: parked -> planning; unknown -> not found; not parked -> 409 error", async () => {
    await seed();
    const s = await store.resume("g", "b", T0);
    expect(s.instances.b).toMatchObject({ status: "planning" });
    expect(s.instances.b).not.toHaveProperty("parkedReason");
    await expect(store.resume("g", "a", T0)).rejects.toBeInstanceOf(GoalInstanceNotParkedError);
    await expect(store.resume("g", "zzz", T0)).rejects.toBeInstanceOf(GoalInstanceNotFoundError);
    await expect(store.resume("g", "constructor", T0)).rejects.toBeInstanceOf(
      GoalInstanceNotFoundError,
    );
  });

  it("timeline filters, skips corrupt lines, caps at 500 newest-last", async () => {
    const ev = (n: number, instance = "a", cycle = 0) => ({
      at: T0,
      cycle,
      instance,
      kind: "k",
      text: String(n),
    });
    for (let i = 0; i < TIMELINE_CAP + 3; i++) await store.appendTimeline("g", ev(i));
    await store.appendTimeline("g", ev(-1, "b", 1));
    await fs.appendFile(path.join(dir, "state", "g", "timeline.jsonl"), "garbage\n");
    const all = await store.timeline("g");
    expect(all).toHaveLength(TIMELINE_CAP);
    expect(all.at(-1)?.text).toBe("-1");
    expect(await store.timeline("g", { instance: "b" })).toHaveLength(1);
    expect(await store.timeline("g", { cycle: 1 })).toHaveLength(1);
  });

  it("remove deletes the state dir", async () => {
    await seed();
    await store.remove("g");
    await expect(fs.stat(path.join(dir, "state", "g"))).rejects.toThrow();
  });
});
