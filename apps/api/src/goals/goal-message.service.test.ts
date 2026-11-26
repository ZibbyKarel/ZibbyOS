import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ActivityRefs, Approval, CreateGoalInput, GoalAction } from "@zibby/contracts";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityEventsService } from "../activity/activity-events.service";
import { BudgetLedgerStore } from "../budget/ledger.store";
import { fakeSystemConfigStore } from "../system/system-config.fixture";
import { GoalActionExecutor } from "./goal-action-executor";
import { GoalEngineService } from "./goal-engine.service";
import { GoalFactsService, type GoalFactsSource } from "./goal-facts";
import { GoalMessageService } from "./goal-message.service";
import type { GoalPlanner, GoalPlannerContext } from "./goal-planner";
import { GoalStateStore } from "./goal-state.store";
import { GoalsStorageService } from "./goals.storage.service";

vi.mock("../shared/instance-role", () => ({ isPrimaryInstance: () => true }));

const fakeLogger = {
  child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
};

/** Thursday 11:00 Prague: working hours. */
const NOW = new Date("2026-11-26T10:00:00.000Z");
const later = (min: number) => new Date(NOW.getTime() + min * 60_000);
const TEXT = "Ahoj, mrkneš prosím dnes na review PR #7? Díky.";

const slackMsg = (actionId: string, text = TEXT): GoalAction => ({
  type: "message",
  actionId,
  to: { kind: "slack-user", ref: "U123" },
  text,
});
const prMsg = (actionId: string, login: string, text = TEXT): GoalAction => ({
  type: "message",
  actionId,
  to: { kind: "pr", ref: login },
  text,
  about: { repo: "acme/app", number: 7 },
});

describe("GoalMessageService (the `message` action)", () => {
  let dir: string;
  let goals: GoalsStorageService;
  let store: GoalStateStore;
  let planner: GoalPlanner & { plan: ReturnType<typeof vi.fn> };
  let activity: { record: ReturnType<typeof vi.fn> };
  let approvals: {
    register: ReturnType<typeof vi.fn>;
    requestApproval: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
  };
  let slack: { userInfo: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> };
  let prThreads: { reviewers: ReturnType<typeof vi.fn>; comment: ReturnType<typeof vi.fn> };
  let autopilot: { paused: boolean; level: "manual" | "semi" | "auto" };
  let extraSources: GoalFactsSource[];
  let prBucket: string;
  let engine: GoalEngineService;
  let messages: GoalMessageService;

  const newMessages = (executor: GoalActionExecutor) =>
    new GoalMessageService(
      executor,
      approvals as never,
      new GoalStateStore(dir),
      new GoalsStorageService(dir),
      {
        isPaused: () => autopilot.paused,
        levelsAt: () => ({ autoCommunicate: autopilot.level }),
      } as never,
      { get: async (id: string) => ({ id }) } as never,
      {
        resolveCompany: async () => undefined,
        resolveIntegrations: async () => [{ id: "slack-p1", kind: "slack", enabled: true }],
      } as never,
      { list: async () => [{ id: "slack-me", kind: "slack", enabled: true }] } as never,
      { read: async () => ({ token: "xoxp-test" }) } as never,
      { slackOutbound: () => slack } as never,
      {
        current: async () => [
          {
            repo: "acme/app",
            number: 7,
            projectId: "p1",
            author: "alice",
            bucket: prBucket,
            url: "https://example.test/acme/app/pull/7",
          },
        ],
      } as never,
      prThreads as never,
      activity as never,
      fakeLogger as never,
    );

  const build = () => {
    const executor = new GoalActionExecutor();
    messages = newMessages(executor);
    messages.onModuleInit();
    engine = new GoalEngineService(
      goals,
      store,
      { list: async () => [{ id: "p1" }] } as never,
      new GoalFactsService([messages, ...extraSources]),
      planner,
      executor,
      new BudgetLedgerStore(path.join(dir, "ledger")),
      activity as never,
      new ActivityEventsService(),
      { settled: () => new Subject() } as never,
      fakeSystemConfigStore(),
      { register: vi.fn() } as never,
      fakeLogger as never,
      messages,
    );
  };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "goal-message-"));
    goals = new GoalsStorageService(dir);
    store = new GoalStateStore(dir);
    planner = { plan: vi.fn(async () => ({ plan: "", feasibility: "ok", actions: [] })) };
    activity = { record: vi.fn(async () => undefined) };
    let n = 0;
    approvals = {
      register: vi.fn(),
      requestApproval: vi.fn(async (input: Partial<Approval>) => ({
        ...input,
        id: `ap-${++n}`,
        status: "pending",
      })),
      reject: vi.fn(async () => ({})),
    };
    slack = {
      userInfo: vi.fn(async () => ({ name: "Bob" })),
      postMessage: vi.fn(async () => ({ channel: "D999", ts: "1764151200.000100" })),
    };
    prThreads = {
      reviewers: vi.fn(async () => ({ users: [{ login: "bob" }], teams: [] })),
      comment: vi.fn(async () => undefined),
    };
    autopilot = { paused: false, level: "semi" };
    extraSources = [];
    prBucket = "mine";
    build();
  });
  afterEach(async () => {
    engine.onModuleDestroy();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const create = (over: Partial<CreateGoalInput> = {}) =>
    goals.create({
      id: "g",
      name: "Goal",
      // Bob's Slack id is named in the goal: a known recipient for auto sends.
      outcome: "PR #7 is reviewed by Bob (U123).",
      scope: { kind: "none" },
      enabled: true,
      ...over,
    });
  const state = () => store.read("g", NOW.toISOString());
  const planOnce = (...actions: GoalAction[]) =>
    planner.plan.mockResolvedValueOnce({ plan: "", feasibility: "ok", actions });
  const recorded = (kind: string) =>
    activity.record.mock.calls
      .map(([e]) => e as { kind: string; summary: string; refs: ActivityRefs })
      .filter((e) => e.kind === kind);
  const timeline = async () => (await store.timeline("g")).map((e) => `${e.kind}: ${e.text}`);

  it("semi: drafts an approval with the preview, sends nothing, waits on the approval", async () => {
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    expect(slack.postMessage).not.toHaveBeenCalled();
    expect(approvals.requestApproval).toHaveBeenCalledTimes(1);
    const req = approvals.requestApproval.mock.calls[0]?.[0] as Approval;
    expect(req).toMatchObject({ runId: "g/_/0/ask-bob", kind: "goal-message" });
    expect(JSON.parse(req.detail)).toMatchObject({
      riskType: "odeslani",
      preview: { kind: "message", to: "Bob · Slack DM", body: TEXT },
    });
    const s = await state();
    expect(s.messages).toMatchObject([
      { id: "_/0/ask-bob", status: "pending", approvalId: "ap-1" },
    ]);
    expect(s.instances._?.appliedActionIds).toEqual(["ask-bob"]);
    expect(s.instances._?.waitingOn).toEqual([{ kind: "approval", ref: "ap-1" }]);
    expect(s.nudges).toEqual({});
  });

  it("auto: sends at once as a DM, records the reply ref, the nudge and the activity", async () => {
    autopilot.level = "auto";
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    expect(approvals.requestApproval).not.toHaveBeenCalled();
    expect(slack.postMessage).toHaveBeenCalledWith({ token: "xoxp-test" }, "U123", TEXT);
    const s = await state();
    const ref = "slack-me:D999:1764151200.000100";
    expect(s.messages).toMatchObject([{ status: "sent", replyRef: ref }]);
    expect(s.nudges["slack:U123"]?.count).toBe(1);
    expect(s.instances._?.waitingOn).toEqual([{ kind: "reply", ref }]);
    // The fallback wake: the next working morning at least 12 h away (Fri 9:00 Prague).
    expect(s.instances._?.wakeAt).toBe("2026-11-27T08:00:00.000Z");
    expect(recorded("goal-acted").map((e) => e.refs.action)).toContain("message");
  });

  it("auto + a workspace member the goal does not know: an approval, nothing sent", async () => {
    autopilot.level = "auto";
    await create();
    planOnce({ ...slackMsg("ask-eve"), to: { kind: "slack-user", ref: "U999" } } as GoalAction);
    await engine.tick(NOW);
    expect(slack.postMessage).not.toHaveBeenCalled();
    expect(approvals.requestApproval).toHaveBeenCalledTimes(1);
    expect((await state()).messages).toMatchObject([{ person: "slack:U999", status: "pending" }]);
  });

  /** Bob is messaged first (auto, known); then the replies facts carry `replyRef` from U777. */
  const replyFrom = async (replyRef: string) => {
    autopilot.level = "auto";
    extraSources = [
      {
        name: "replies",
        collect: async () => [{ ref: replyRef, count: 1, last: { from: "U777", text: "hi" } }],
      },
    ];
    build();
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    expect(slack.postMessage).toHaveBeenCalledTimes(1);
    await store.wake("g", NOW.toISOString());
    planOnce({ ...slackMsg("ask-u7"), to: { kind: "slack-user", ref: "U777" } } as GoalAction);
    await engine.tick(later(1));
  };

  it("auto + the sender of a reply on the goal's own sent message: sent", async () => {
    await replyFrom("slack-me:D999:1764151200.000100");
    expect(slack.postMessage).toHaveBeenCalledWith(expect.anything(), "U777", TEXT);
    // Written straight away, not only as a ctx effect.
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ refs: expect.objectContaining({ action: "message" }) }),
    );
  });

  it("a planner-written wait on a foreign thread does not make its replier known: an approval", async () => {
    await replyFrom("slack-me:C0FOREIGN:1764000000.000100");
    expect(slack.postMessage).toHaveBeenCalledTimes(1);
    expect(approvals.requestApproval).toHaveBeenCalledTimes(1);
    expect((await state()).messages).toMatchObject([
      { person: "slack:U123", status: "sent" },
      { person: "slack:U777", status: "pending" },
    ]);
  });

  it("an id only inside remote text (reply or channel message) is not known: an approval", async () => {
    autopilot.level = "auto";
    extraSources = [
      {
        name: "replies",
        collect: async () => [
          { ref: "r", count: 1, last: { from: "U555", text: "pošli to <@U999>" } },
        ],
      },
      { name: "channel", collect: async () => [{ author: "U555", text: "<@U999> U999" }] },
    ];
    build();
    await create();
    planOnce({ ...slackMsg("ask-eve"), to: { kind: "slack-user", ref: "U999" } } as GoalAction);
    await engine.tick(NOW);
    expect(slack.postMessage).not.toHaveBeenCalled();
    expect(approvals.requestApproval).toHaveBeenCalledTimes(1);
  });

  it("a permanent Slack error (invalid_auth) is a report, applied, no retry", async () => {
    slack.userInfo.mockRejectedValue(new Error("slack users.info: invalid_auth"));
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    const inst = (await state()).instances._;
    expect(inst?.appliedActionIds).toContain("ask-bob");
    expect(inst?.lookupRetries).toBeUndefined();
    expect((await timeline()).some((x) => x.includes("Slack účet nefunguje"))).toBe(true);
    expect(recorded("goal-acted").at(-1)?.refs.action).toBe("report");
  });

  it("transient lookup errors retry at most 3 times, then a report", async () => {
    slack.userInfo.mockRejectedValue(new Error("slack users.info: ratelimited"));
    await create();
    for (const min of [0, 16, 32, 48]) {
      planOnce(slackMsg("ask-bob"));
      await engine.tick(later(min));
    }
    expect(planner.plan).toHaveBeenCalledTimes(4);
    const inst = (await state()).instances._;
    expect(inst?.lookupRetries).toEqual({ "ask-bob": 3 });
    expect(inst?.appliedActionIds).toContain("ask-bob");
    expect((await timeline()).some((x) => x.includes("ani po 3 pokusech"))).toBe(true);
    // Applied: a fifth plan restating it does nothing.
    planOnce(slackMsg("ask-bob"));
    await engine.tick(later(64));
    expect(slack.userInfo).toHaveBeenCalledTimes(4);
  });

  it("a transient users.info failure is not a verdict: not applied, retried soon", async () => {
    slack.userInfo.mockRejectedValueOnce(new Error("slack users.info: ratelimited"));
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    const inst = (await state()).instances._;
    expect(inst?.appliedActionIds ?? []).not.toContain("ask-bob");
    expect(inst?.wakeAt).toBe(later(15).toISOString());
    const t = await timeline();
    expect(t.some((x) => x.includes("není uživatel Slacku"))).toBe(false);
    expect(t.some((x) => x.includes("odložena"))).toBe(true);
    expect(approvals.requestApproval).not.toHaveBeenCalled();
  });

  it("an operator edit with a mass mention is refused at approve, nothing sent", async () => {
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    await messages.resume("g/_/0/ask-bob", {
      messageText: "<!channel> mrkněte na PR #7",
    } as Approval);
    expect(slack.postMessage).not.toHaveBeenCalled();
    expect((await state()).messages).toMatchObject([{ status: "failed" }]);
    expect(recorded("goal-acted").at(-1)?.refs.action).toBe("report");
  });

  it("approved after the goal was disabled or its ceiling lowered to tier1: settled, nothing sent", async () => {
    await create();
    for (const [i, patch, why] of [
      [0, { enabled: false }, "cíl je vypnutý"],
      [1, { ceiling: "tier1" }, "strop cíle tier1"],
    ] as const) {
      await goals.update("g", { enabled: true, ceiling: "tier2" });
      await store.wake("g", NOW.toISOString());
      planOnce({
        ...slackMsg(`ask-${i}`),
        to: { kind: "slack-user", ref: `U12${i}` },
      } as GoalAction);
      await engine.tick(later(i));
      await goals.update("g", patch);
      await messages.resume(`g/_/0/ask-${i}`, {} as Approval);
      expect(slack.postMessage).not.toHaveBeenCalled();
      expect((await state()).messages?.[i]).toMatchObject({ status: "failed" });
      expect((await timeline()).some((x) => x.includes(why))).toBe(true);
    }
  });

  it("a new cycle rejects the old cycle's pending goal-message approvals", async () => {
    await create({ cadence: { every: "day", hour: 9 } });
    await store.write({
      goalId: "g",
      cycle: { index: 0, startedAt: NOW.toISOString() },
      instances: { _: { status: "waiting", taskIds: [] } },
      decisionsThisMonth: { month: "2026-11", count: 0 },
      nudges: {},
      messages: [
        {
          id: "_/ask-bob",
          instance: "_",
          actionId: "ask-bob",
          person: "slack:U123",
          to: "Bob · Slack DM",
          status: "pending",
          text: TEXT,
          target: { kind: "slack", integrationId: "slack-me", userId: "U123" },
          createdAt: NOW.toISOString(),
          approvalId: "ap-old",
        },
      ],
    });
    // A failing reject is visible on the timeline, not only in the log.
    approvals.reject.mockRejectedValueOnce(new Error("owned elsewhere"));
    await engine.tick(new Date("2026-11-27T08:05:00.000Z"));
    expect(approvals.reject).toHaveBeenCalledWith("ap-old", expect.any(String));
    expect((await timeline()).some((x) => x.includes("ap-old starého konceptu"))).toBe(true);
    expect((await state()).messages).toBeUndefined();
  });

  it("paused Autopilot: an auto level still drafts an approval", async () => {
    autopilot = { paused: true, level: "auto" };
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    expect(slack.postMessage).not.toHaveBeenCalled();
    expect(approvals.requestApproval).toHaveBeenCalledTimes(1);
    expect((planner.plan.mock.calls[0]?.[0] as GoalPlannerContext).autoCommunicate).toBe("paused");
  });

  it("tier1 ceiling + auto: the ceiling refuses it, nothing is sent or drafted", async () => {
    autopilot.level = "auto";
    await create({ ceiling: "tier1" });
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    expect(slack.postMessage).not.toHaveBeenCalled();
    expect(approvals.requestApproval).not.toHaveBeenCalled();
  });

  it("the third message to one person in a cycle is a report, not a send", async () => {
    autopilot.level = "auto";
    await create();
    planOnce(slackMsg("a1"), slackMsg("a2"), slackMsg("a3"));
    await engine.tick(NOW);
    expect(slack.postMessage).toHaveBeenCalledTimes(2);
    expect((await state()).nudges["slack:U123"]?.count).toBe(2);
    expect((await timeline()).some((t) => t.startsWith("report: Zpráva nenapsána (a3)"))).toBe(
      true,
    );
  });

  it("pending drafts count toward the cap; a rejected one frees its slot", async () => {
    await create();
    planOnce(slackMsg("a1"), slackMsg("a2"), slackMsg("a3"));
    await engine.tick(NOW);
    expect(approvals.requestApproval).toHaveBeenCalledTimes(2);
    await messages.cancel("g/_/0/a1");
    expect((await state()).messages?.find((m) => m.actionId === "a1")?.status).toBe("rejected");
    // The rejection is a fact: the next tick re-plans and may ask again.
    planOnce(slackMsg("a4"));
    await engine.tick(later(1));
    expect(planner.plan).toHaveBeenCalledTimes(2);
    const facts = (planner.plan.mock.calls[1]?.[0] as GoalPlannerContext).facts;
    expect(facts.messages).toContainEqual(
      expect.objectContaining({ actionId: "a1", status: "rejected" }),
    );
    expect(approvals.requestApproval).toHaveBeenCalledTimes(3);
  });

  it("Friday 18:00 → deferred to Monday 9:00, no approval, not applied", async () => {
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(new Date("2026-11-27T17:00:00.000Z"));
    expect(approvals.requestApproval).not.toHaveBeenCalled();
    const inst = (await state()).instances._;
    expect(inst?.wakeAt).toBe("2026-11-30T08:00:00.000Z");
    expect(inst?.appliedActionIds ?? []).not.toContain("ask-bob");
    expect((await state()).messages ?? []).toEqual([]);
  });

  it("approve sends exactly once (edited text), also across fresh service instances", async () => {
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    const edited = "Ahoj Bobe, stihneš dnes review PR #7?";
    await messages.resume("g/_/0/ask-bob", { messageText: edited } as Approval);
    await messages.resume("g/_/0/ask-bob", { messageText: edited } as Approval);
    await newMessages(new GoalActionExecutor()).resume("g/_/0/ask-bob");
    expect(slack.postMessage).toHaveBeenCalledTimes(1);
    expect(slack.postMessage).toHaveBeenCalledWith(expect.anything(), "U123", edited);
    const s = await state();
    expect(s.messages).toMatchObject([{ status: "sent", text: edited }]);
    expect(s.nudges["slack:U123"]?.count).toBe(1);
    // The approve path waits on the reply like the auto path does.
    expect(s.instances._?.waitingOn).toContainEqual({
      kind: "reply",
      ref: "slack-me:D999:1764151200.000100",
    });
    expect(s.instances._?.wakeAt).toBeDefined();
    // Restating the same action in a later plan never sends again.
    planOnce(slackMsg("ask-bob"));
    await engine.tick(later(1));
    expect(slack.postMessage).toHaveBeenCalledTimes(1);
  });

  it("approving a draft that is gone sends nothing and reports it", async () => {
    await create();
    await engine.tick(NOW);
    await messages.resume("g/_/0/gone");
    expect(slack.postMessage).not.toHaveBeenCalled();
    expect(recorded("goal-acted").at(-1)?.refs.action).toBe("report");
  });

  it("a failed send is recorded as failed and reported; resume never throws", async () => {
    await create();
    planOnce(slackMsg("ask-bob"));
    await engine.tick(NOW);
    slack.postMessage.mockRejectedValueOnce(new Error("slack chat.postMessage: not_in_channel"));
    await expect(messages.resume("g/_/0/ask-bob")).resolves.toBeUndefined();
    expect((await state()).messages).toMatchObject([{ status: "failed" }]);
    expect((await state()).nudges).toEqual({});
    expect(recorded("goal-acted").at(-1)?.refs.action).toBe("report");
  });

  it("placeholder text or an unknown Slack user: a report, no approval", async () => {
    slack.userInfo.mockResolvedValue(null);
    await create();
    planOnce(slackMsg("p1", "TODO: doplnit text zprávy"), slackMsg("p2"));
    await engine.tick(NOW);
    expect(approvals.requestApproval).not.toHaveBeenCalled();
    const t = await timeline();
    expect(t.some((x) => x.includes("(p1): text není konkrétní"))).toBe(true);
    expect(t.some((x) => x.includes("(p2): U123 není uživatel Slacku"))).toBe(true);
    expect((await state()).instances._?.appliedActionIds).toEqual(["p1", "p2"]);
  });

  it("PR: comments mentioning a reviewer; a non-reviewer or a foreign @mention is refused", async () => {
    autopilot.level = "auto";
    await create({ scope: { kind: "projects", projectIds: ["p1"] } });
    planOnce(
      prMsg("x1", "carol"),
      prMsg("x2", "bob", "Ahoj, mrkneš na to s @alice prosím?"),
      prMsg("x3", "@Bob"),
    );
    await engine.tick(NOW);
    expect(prThreads.comment).toHaveBeenCalledTimes(1);
    expect(prThreads.comment).toHaveBeenCalledWith("p1", "acme/app", 7, `@bob ${TEXT}`);
    const t = await timeline();
    expect(t.some((x) => x.includes("carol není autor ani reviewer"))).toBe(true);
    expect(t.some((x) => x.includes("zmiňuje @alice"))).toBe(true);
    expect((await state()).nudges["pr:bob"]?.count).toBe(1);
  });

  it("a PR outside a `_` instance's scope (not mine) is refused", async () => {
    prBucket = "team";
    await create();
    planOnce(prMsg("x1", "bob"));
    await engine.tick(NOW);
    expect(approvals.requestApproval).not.toHaveBeenCalled();
    expect((await timeline()).some((x) => x.includes("mimo rozsah cíle"))).toBe(true);
  });

  it("a failing post-action facts read still applies the actions and does not loop", async () => {
    let calls = 0;
    extraSources = [
      {
        name: "flaky",
        collect: async () => {
          calls += 1;
          if (calls === 2) throw new Error("disk hiccup");
          return "same";
        },
      },
    ];
    build();
    await create();
    planOnce({ type: "note", text: "Poznámka." });
    await engine.tick(NOW);
    expect(planner.plan).toHaveBeenCalledTimes(1);
    const inst = (await state()).instances._;
    expect(inst?.fingerprint).toBeDefined();
    expect((await timeline()).some((t) => t.includes("Facts after the actions unreadable"))).toBe(
      true,
    );
    // Same facts as the plan saw: no re-plan.
    await engine.tick(later(1));
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });
});
