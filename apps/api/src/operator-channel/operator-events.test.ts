import type { ActivityEntry } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import { toOperatorEvent } from "./operator-events";

const lookupsFor = (url?: string) => ({
  task: async () => (url ? ({ prCiTriage: { url } } as never) : null),
  approval: async () => null,
  workflowRun: () => null,
});
const parked = (itemId: string, taskId?: string) =>
  ({
    id: "a1",
    kind: "pr-ci-autofix-parked",
    summary: "gave up",
    refs: { itemId, ...(taskId ? { taskId } : {}) },
  }) as unknown as ActivityEntry;

describe("toOperatorEvent pr-ci-autofix-parked prUrl", () => {
  it("rebuilds a github url from repo#n when the task has none", async () => {
    expect(await toOperatorEvent(parked("acme/app#5"), lookupsFor())).toMatchObject({
      prUrl: "https://github.com/acme/app/pull/5",
    });
  });

  it("prefers the task's recorded triage url (GitLab MR) over a rebuilt github one", async () => {
    const url = "https://gl.example.com/acme/app/-/merge_requests/5";
    expect(await toOperatorEvent(parked("acme/app#5", "t1"), lookupsFor(url))).toMatchObject({
      prUrl: url,
      target: "acme/app#5",
    });
  });

  it("ignores a github-shaped url on a non-github host", async () => {
    const event = await toOperatorEvent(
      parked("grp/sub/app#5", "t1"),
      lookupsFor("https://evil.example.com/o/r/pull/5"),
    );
    expect(event).not.toHaveProperty("prUrl");
  });

  it("a task that cannot be read (host unknown) gets no guessed github url", async () => {
    const missing = await toOperatorEvent(parked("grp/app#5", "t1"), lookupsFor());
    expect(missing).not.toHaveProperty("prUrl");
    const failing = await toOperatorEvent(parked("grp/app#5", "t1"), {
      ...lookupsFor(),
      task: async () => {
        throw new Error("gone");
      },
    });
    expect(failing).not.toHaveProperty("prUrl");
  });

  it("drops a nested non-url ref it cannot rebuild", async () => {
    const event = await toOperatorEvent(parked("grp/sub/app#5"), lookupsFor());
    expect(event).not.toHaveProperty("prUrl");
  });
});

describe("toOperatorEvent goal-*", () => {
  const goal = (kind: string, refs: Record<string, string>, id = "a1") =>
    ({ id, kind, summary: "Goal: parked", refs }) as unknown as ActivityEntry;

  it("a parked goal is a Tier-3 notification linking to the goal", async () => {
    expect(
      await toOperatorEvent(goal("goal-parked", { goalId: "g", itemId: "_" }), lookupsFor()),
    ).toMatchObject({ kind: "goal-parked", tier: 3, path: "/work/goals/g", target: "g:_" });
  });

  it("done and report actions are goal-update; other actions are silent", async () => {
    expect(await toOperatorEvent(goal("goal-done", { goalId: "g" }), lookupsFor())).toMatchObject({
      kind: "goal-update",
      tier: 2,
    });
    const report = goal("goal-acted", { goalId: "g", action: "report" }, "a2");
    expect(await toOperatorEvent(report, lookupsFor())).toMatchObject({
      kind: "goal-update",
      state: "a2",
    });
    expect(
      await toOperatorEvent(goal("goal-acted", { goalId: "g", action: "note" }), lookupsFor()),
    ).toBeNull();
    expect(await toOperatorEvent(goal("goal-woke", { goalId: "g" }), lookupsFor())).toBeNull();
  });
});
