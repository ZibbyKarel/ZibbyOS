import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Approval, AutopilotAutomation } from "@zibby/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ApprovalsService } from "../approvals/approvals.service";
import {
  AUTOMATION_RAISE_MAX_PLACES,
  AutopilotService,
  automationRaises,
  autopilotCoversApproval,
} from "./autopilot.service";

type Covered = Pick<Approval, "kind" | "action" | "suggestedReviewEvent">;

describe("autopilotCoversApproval — the approval allowlist", () => {
  it.each<[Covered, string | undefined, boolean]>([
    [{ kind: "pr-review", action: "github.pr.review" }, undefined, true],
    [
      { kind: "workflow-gate", action: "stage-approval", suggestedReviewEvent: "APPROVE" },
      undefined,
      true,
    ],
    [{ kind: "workflow-gate", action: "stage-approval" }, undefined, false],
    [{ kind: "workflow-gate", action: "spend-past-cap" }, undefined, false],
    [{ kind: "pr-address-comments", action: "github.pr.comment" }, undefined, true],
    [{ kind: "pr-address-comments", action: "git.push" }, "zibby/run-1-x", true],
    [{ kind: "pr-address-comments", action: "git.push" }, "feature/x", false],
    [{ kind: "pr-fix-ci", action: "git.push" }, "zibby/run-1-x", true],
    [{ kind: "pr-fix-ci", action: "git.push" }, "main", false],
    [{ kind: "pr-fix-ci", action: "git.push" }, "feature/mine", false],
    [{ kind: "channel", action: "channel-reply" }, undefined, true],
    [{ kind: "pr-rebase", action: "git.force_push" }, "zibby/run-1-x", false],
    [{ kind: "workflow-output", action: "pr.open" }, undefined, false],
    [{ kind: "task", action: "spend-past-cap" }, undefined, false],
    [{ kind: "jira-issue", action: "jira.create" }, undefined, false],
    [{ kind: "comms-graduation", action: "graduate" }, undefined, false],
    // Goal decisions and messages answer to autoDecideGoals and the goal ceiling, never the allowlist.
    [{ kind: "goal-decision", action: "goal.decide" }, undefined, false],
    [{ kind: "goal-message", action: "message.send" }, undefined, false],
  ])("%o on %s → %s", (approval, head, expected) => {
    expect(autopilotCoversApproval(approval, head)).toBe(expected);
  });

  it("covers a push onto any head of the operator's own PR", () => {
    expect(
      autopilotCoversApproval({ kind: "pr-fix-ci", action: "git.push" }, "feature/mine", true),
    ).toBe(true);
    expect(
      autopilotCoversApproval({ kind: "pr-address-comments", action: "git.push" }, "fix/x", true),
    ).toBe(true);
    expect(
      autopilotCoversApproval({ kind: "pr-fix-ci", action: "git.push" }, undefined, true),
    ).toBe(false);
    expect(
      autopilotCoversApproval({ kind: "pr-rebase", action: "git.force_push" }, "fix/x", true),
    ).toBe(false);
  });
});

type Cells = Partial<AutopilotAutomation["global"]>;

const cells = (over: Cells = {}): AutopilotAutomation["global"] => ({
  autoReview: "manual",
  autoAddressComments: "manual",
  autoImplement: "manual",
  autoCommunicate: "manual",
  autoFixCi: "manual",
  autoDecideGoals: "manual",
  ...over,
});

const treeOf = (
  global: Cells = {},
  companies: AutopilotAutomation["companies"] = {},
  teams: AutopilotAutomation["teams"] = {},
  projects: AutopilotAutomation["projects"] = {},
): AutopilotAutomation => ({ global: cells(global), companies, teams, projects });

/** A global row that is not all-manual, so company/team exceptions apply (all-manual is a master off). */
const LIVE: Cells = { autoImplement: "semi" };

describe("automationRaises", () => {
  it("raising a cell (manual < semi < auto) anywhere raises; lowering and no-ops do not", () => {
    const base = treeOf({ autoReview: "semi" });
    expect(automationRaises(undefined, treeOf())).toBe(false);
    expect(automationRaises(undefined, treeOf({ autoReview: "semi" }))).toBe(true);
    expect(automationRaises(base, treeOf({ autoReview: "auto" }))).toBe(true);
    expect(automationRaises(base, treeOf({ autoReview: "manual" }))).toBe(false);
    expect(automationRaises(base, base)).toBe(false);
    expect(automationRaises(treeOf({ autoReview: "auto" }), treeOf({ autoReview: "semi" }))).toBe(
      false,
    );
  });

  it("a company override that raises over global raises", () => {
    expect(automationRaises(treeOf(LIVE), treeOf(LIVE, { co: { autoFixCi: "auto" } }))).toBe(true);
    expect(
      automationRaises(treeOf({ autoFixCi: "auto" }), treeOf({}, { co: { autoFixCi: "manual" } })),
    ).toBe(false);
  });

  it("a team override is checked under every company, so it is never missed", () => {
    const prev = treeOf(LIVE, { co: { autoReview: "auto" } }, { t: { autoReview: "manual" } });
    // Removing the team's manual override re-exposes the company's auto at (co, t).
    expect(automationRaises(prev, treeOf(LIVE, { co: { autoReview: "auto" } }))).toBe(true);
    // A team raised on its own.
    expect(automationRaises(treeOf(LIVE), treeOf(LIVE, {}, { t: { autoFixCi: "semi" } }))).toBe(
      true,
    );
    // Under an all-manual global row an exception is dormant, so adding one raises nothing.
    expect(automationRaises(treeOf(), treeOf({}, {}, { t: { autoReview: "auto" } }))).toBe(false);
    // A team lowered below its company.
    expect(
      automationRaises(
        treeOf({}, { co: { autoReview: "auto" } }, { t: { autoReview: "auto" } }),
        treeOf({}, { co: { autoReview: "auto" } }, { t: { autoReview: "manual" } }),
      ),
    ).toBe(false);
  });
});

describe("automationRaises — project cells", () => {
  it("raising a project cell raises, on its own and under any company or team", () => {
    expect(
      automationRaises(treeOf(LIVE), treeOf(LIVE, {}, {}, { p: { autoReview: "semi" } })),
    ).toBe(true);
    expect(
      automationRaises(treeOf(LIVE), treeOf(LIVE, {}, {}, { p: { autoDecideGoals: "auto" } })),
    ).toBe(true);
    // A project already semi under a company that is semi: going auto raises.
    expect(
      automationRaises(
        treeOf(LIVE, {}, {}, { p: { autoReview: "semi" } }),
        treeOf(LIVE, {}, {}, { p: { autoReview: "auto" } }),
      ),
    ).toBe(true);
  });

  it("removing a project's manual override re-exposes a team/company auto: a raise", () => {
    const company = { co: { autoReview: "auto" as const } };
    const team = { t: { autoFixCi: "auto" as const } };
    expect(
      automationRaises(
        treeOf(LIVE, company, {}, { p: { autoReview: "manual" } }),
        treeOf(LIVE, company),
      ),
    ).toBe(true);
    expect(
      automationRaises(
        treeOf(LIVE, {}, team, { p: { autoFixCi: "manual" } }),
        treeOf(LIVE, {}, team),
      ),
    ).toBe(true);
    // Under company AND team only (neither alone shows it).
    expect(
      automationRaises(
        treeOf(
          LIVE,
          { co: { autoImplement: "manual" } },
          { t: { autoImplement: "auto" } },
          {
            p: { autoImplement: "manual" },
          },
        ),
        treeOf(LIVE, { co: { autoImplement: "manual" } }, { t: { autoImplement: "auto" } }),
      ),
    ).toBe(true);
  });

  it("a tree too big to enumerate fails closed: it counts as a raise", () => {
    const many = (n: number, prefix: string) =>
      Object.fromEntries(
        Array.from({ length: n }, (_, i) => [`${prefix}${i}`, { autoReview: "manual" as const }]),
      );
    const huge = treeOf(LIVE, many(30, "c"), many(30, "t"), many(30, "p"));
    expect(30 ** 3).toBeGreaterThan(AUTOMATION_RAISE_MAX_PLACES);
    // Only lowers, yet too many places to check: the token is asked for.
    expect(automationRaises(huge, huge)).toBe(true);
    const small = treeOf(LIVE, many(10, "c"), many(10, "t"), many(10, "p"));
    expect(automationRaises(small, small)).toBe(false);
  });

  it("lowering or keeping a project cell is not a raise", () => {
    const up = treeOf(LIVE, {}, {}, { p: { autoReview: "auto" } });
    expect(automationRaises(up, treeOf(LIVE, {}, {}, { p: { autoReview: "semi" } }))).toBe(false);
    expect(automationRaises(up, treeOf(LIVE))).toBe(false);
    expect(automationRaises(up, up)).toBe(false);
  });
});

describe("AutopilotService", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "autopilot-svc-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const boot = async () => {
    const svc = new AutopilotService(dir);
    await svc.onModuleInit();
    return svc;
  };

  it("is off (and covers nothing) by default and on a malformed file", async () => {
    await fs.writeFile(path.join(dir, "autopilot.json"), "{ nope");
    const svc = await boot();
    expect(svc.isOn()).toBe(false);
    expect(svc.isPaused()).toBe(false);
    expect(svc.coversApproval({ kind: "channel", action: "channel-reply" })).toBe(false);
  });

  it("reports the pending count but never decides a pending approval", async () => {
    const approve = { calls: 0 };
    const approvals = {
      list: async () => [{ id: "a1" }, { id: "a2" }],
      approve: async () => {
        approve.calls++;
      },
    } as unknown as ApprovalsService;
    const svc = new AutopilotService(dir, approvals);
    await svc.onModuleInit();
    expect(await svc.set({ automation: treeOf({ autoReview: "auto" }) }, "operator")).toMatchObject(
      { paused: false, pendingApprovals: 2 },
    );
    expect(approve.calls).toBe(0);
  });

  it("the tree's auto cells drive the overlay; ci covers the fix-ci push", async () => {
    const svc = await boot();
    await svc.set({ automation: treeOf({ autoAddressComments: "auto" }) }, "operator");
    expect(svc.coversApproval({ kind: "pr-review", action: "github.pr.review" })).toBe(false);
    expect(svc.coversApproval({ kind: "channel", action: "channel-reply" })).toBe(false);
    expect(svc.coversApproval({ kind: "pr-address-comments", action: "github.pr.comment" })).toBe(
      true,
    );
    // CI is its own class now: autoFixCi manual -> a fix-ci push is not covered.
    expect(svc.coversApproval({ kind: "pr-fix-ci", action: "git.push" }, "f/x", true)).toBe(false);
    await svc.set({ automation: treeOf({ autoFixCi: "auto" }) }, "operator");
    expect(svc.coversApproval({ kind: "pr-fix-ci", action: "git.push" }, "f/x", true)).toBe(true);
    // Persisted, and reloaded on boot.
    const reloaded = await boot();
    expect(reloaded.scope()).toEqual({
      reviews: false,
      comments: false,
      communication: false,
      ci: true,
    });
  });

  it("semi does not cover the overlay but starts work", async () => {
    const svc = await boot();
    await svc.set(
      { automation: treeOf({ autoReview: "semi", autoImplement: "semi" }) },
      "operator",
    );
    expect(svc.scope().reviews).toBe(false);
    expect(svc.coversApproval({ kind: "pr-review", action: "github.pr.review" })).toBe(false);
    expect(svc.automationFor({})).toMatchObject({ autoReview: true, autoImplement: true });
    expect(svc.isOn()).toBe(false);
  });

  it("resolves the overlay where the approval acts (team > company > global)", async () => {
    const svc = await boot();
    await svc.set(
      {
        automation: treeOf(
          LIVE,
          { co: { autoCommunicate: "auto" } },
          { quiet: { autoCommunicate: "manual" } },
        ),
      },
      "operator",
    );
    const reply = { kind: "channel", action: "channel-reply" } as const;
    expect(svc.coversApproval(reply)).toBe(false);
    expect(svc.coversApproval(reply, undefined, undefined, { companyId: "co" })).toBe(true);
    expect(
      svc.coversApproval(reply, undefined, undefined, { companyId: "co", teamId: "quiet" }),
    ).toBe(false);
  });

  it("a team-only tree covers a PR of that team, at both the approval and the gate check", async () => {
    const svc = await boot();
    await svc.set(
      {
        automation: treeOf(
          LIVE,
          {},
          { devrel: { autoReview: "auto", autoAddressComments: "auto" } },
        ),
      },
      "operator",
    );
    const review = { kind: "pr-review", action: "github.pr.review" } as const;
    const devrelPr = [
      { companyId: "co", teamId: "other" },
      { companyId: "co", teamId: "devrel" },
    ];
    expect(svc.coversApproval(review)).toBe(false);
    expect(svc.coversApproval(review, undefined, undefined, devrelPr)).toBe(true);
    expect(svc.coversApproval(review, undefined, undefined, [{ teamId: "other" }])).toBe(false);
    const comment = { action: "gh.pr_comment" } as const;
    expect(svc.coversRule("floor-gh.pr_comment", comment, { scope: "reviews" })).toBe(false);
    expect(svc.coversRule("floor-gh.pr_comment", comment, { scope: "reviews", at: devrelPr })).toBe(
      true,
    );
  });

  it("isOn: not paused and some cell anywhere is auto", async () => {
    const svc = await boot();
    expect(svc.isOn()).toBe(false);
    await svc.set({ automation: treeOf(LIVE, {}, { t: { autoReview: "auto" } }) }, "operator");
    expect(svc.isOn()).toBe(true);
    expect(svc.scopeAnywhere().reviews).toBe(true);
    expect(svc.scope().reviews).toBe(false);
    await svc.set({ paused: true }, "chat");
    expect(svc.isOn()).toBe(false);
    expect(svc.isPaused()).toBe(true);
  });

  it("isOn: a project-only auto cell turns the overlay on, and covers only that project", async () => {
    const svc = await boot();
    await svc.set(
      { automation: treeOf(LIVE, {}, {}, { p: { autoAddressComments: "auto" } }) },
      "operator",
    );
    expect(svc.isOn()).toBe(true);
    expect(svc.scope({ projectId: "p" }).comments).toBe(true);
    expect(svc.scope({ projectId: "other" }).comments).toBe(false);
    expect(svc.scope().comments).toBe(false);
  });

  it("an all-manual global row (TopBar Ručně) switches every exception off", async () => {
    const svc = await boot();
    const devrel = { companyId: "co", teamId: "devrel" };
    await svc.set(
      { automation: treeOf({}, { co: { autoFixCi: "auto" } }, { devrel: { autoReview: "auto" } }) },
      "operator",
    );
    expect(svc.isOn()).toBe(false);
    expect(Object.values(svc.automationFor(devrel)).some(Boolean)).toBe(false);
    expect(svc.scopeAnywhere()).toEqual({
      reviews: false,
      comments: false,
      communication: false,
      ci: false,
    });
    expect(
      svc.coversApproval({ kind: "pr-review", action: "github.pr.review" }, undefined, undefined, [
        devrel,
      ]),
    ).toBe(false);
  });

  it("paused blocks the scope and every start, but keeps the tree for resume", async () => {
    const svc = await boot();
    const all = treeOf({
      autoReview: "auto",
      autoAddressComments: "auto",
      autoImplement: "auto",
      autoCommunicate: "auto",
      autoFixCi: "auto",
      autoDecideGoals: "auto",
    });
    await svc.set({ automation: all }, "operator");
    expect(svc.scope()).toEqual({ reviews: true, comments: true, communication: true, ci: true });
    await svc.set({ paused: true }, "chat");
    expect(svc.scope()).toEqual({
      reviews: false,
      comments: false,
      communication: false,
      ci: false,
    });
    expect(svc.scopeAnywhere().reviews).toBe(false);
    expect(Object.values(svc.automationFor({})).some(Boolean)).toBe(false);
    expect(svc.coversApproval({ kind: "pr-review", action: "github.pr.review" })).toBe(false);
    expect((await svc.status()).automation).toEqual(all);
    await svc.set({ paused: false }, "operator");
    expect(svc.scope().reviews).toBe(true);
    const reloaded = await boot();
    expect(reloaded.isOn()).toBe(true);
  });

  it("migrates a legacy file on read: autoCommunicate from scope, toggles to auto (level full)", async () => {
    await fs.writeFile(
      path.join(dir, "autopilot.json"),
      JSON.stringify({
        level: "full",
        scope: { reviews: true, comments: true, communication: true },
        automation: {
          global: { autoImplement: false, autoReview: true, autoAddressComments: false },
        },
      }),
    );
    const svc = await boot();
    expect(svc.scope()).toEqual({
      reviews: true,
      comments: false,
      communication: true,
      ci: false,
    });
  });

  it("a legacy full state without a tree now starts nothing and covers nothing", async () => {
    await fs.writeFile(path.join(dir, "autopilot.json"), JSON.stringify({ level: "full" }));
    const svc = await boot();
    expect(svc.scope()).toEqual({
      reviews: false,
      comments: false,
      communication: false,
      ci: false,
    });
    expect(svc.isOn()).toBe(false);
  });

  it("a legacy off toggle starts work (semi) but covers nothing", async () => {
    await fs.writeFile(
      path.join(dir, "autopilot.json"),
      JSON.stringify({
        level: "off",
        automation: {
          global: {
            autoImplement: true,
            autoReview: false,
            autoAddressComments: false,
            autoCommunicate: false,
            autoFixCi: false,
            autoDecideGoals: false,
          },
        },
      }),
    );
    const svc = await boot();
    expect(svc.automationFor({}).autoImplement).toBe(true);
    expect(svc.scopeAnywhere().reviews).toBe(false);
    expect(svc.isOn()).toBe(false);
  });

  it("re-setting the current state is a no-op (no file write)", async () => {
    const svc = await boot();
    await svc.set({ paused: false }, "chat");
    await expect(fs.readFile(path.join(dir, "autopilot.json"), "utf8")).rejects.toThrow();
  });

  const tree = treeOf({ autoImplement: "semi" });

  it("stores the tree, keeps it across pause, and resolves starts only while running", async () => {
    const svc = await boot();
    await svc.set({ automation: tree }, "operator");
    expect(svc.automationFor({}).autoImplement).toBe(true);
    expect(
      JSON.parse(await fs.readFile(path.join(dir, "autopilot.json"), "utf8")).automation,
    ).toEqual(tree);

    await svc.set({ paused: true }, "chat");
    expect(svc.automationFor({}).autoImplement).toBe(false);
    expect((await svc.status()).automation).toEqual(tree);

    await svc.set({ paused: false }, "operator");
    expect(svc.automationFor({}).autoImplement).toBe(true);

    const reloaded = await boot();
    expect(reloaded.automationFor({}).autoImplement).toBe(true);
  });

  it("a changed tree alone counts as a change", async () => {
    const svc = await boot();
    await svc.set({ automation: tree }, "operator");
    await svc.set(
      { automation: { ...tree, global: { ...tree.global, autoReview: "semi" } } },
      "operator",
    );
    expect(svc.automationFor({}).autoReview).toBe(true);
  });

  it("a malformed automation block makes the whole file read as the default", async () => {
    await fs.writeFile(
      path.join(dir, "autopilot.json"),
      JSON.stringify({ paused: false, automation: { global: { autoImplement: "yes" } } }),
    );
    const svc = await boot();
    expect(svc.isOn()).toBe(false);
    expect(svc.automation()).toBeUndefined();
  });

  // autoDecideGoals resolves on its own (outside the master switch).
  const devrel = { companyId: "co", teamId: "devrel" };

  it("a global goal-decision cell alone wakes no dormant exception of another capability", async () => {
    const svc = await boot();
    await svc.set(
      {
        automation: treeOf({ autoDecideGoals: "semi" }, {}, { devrel: { autoFixCi: "auto" } }),
      },
      "operator",
    );
    expect(svc.levelsAt(devrel)).toEqual({ ...cells(), autoDecideGoals: "semi" });
    expect(svc.automationFor(devrel).autoFixCi).toBe(false);
    expect(svc.scope(devrel).ci).toBe(false);
  });

  it("a project goal-decision cell under an all-manual global row is auto there only", async () => {
    const svc = await boot();
    await svc.set(
      { automation: treeOf({}, {}, {}, { p: { autoDecideGoals: "auto" } }) },
      "operator",
    );
    expect(svc.levelsAt({ projectId: "p" }).autoDecideGoals).toBe("auto");
    expect(svc.levelsAt({ projectId: "other" }).autoDecideGoals).toBe("manual");
    expect(svc.levelsAt({}).autoDecideGoals).toBe("manual");
    // The rest of Autopilot stays off: a goal-only cell does not turn isOn() true.
    expect(svc.isOn()).toBe(false);
  });

  it("raising a project goal-decision cell under an all-manual global row is a raise (token)", () => {
    expect(automationRaises(treeOf(), treeOf({}, {}, {}, { p: { autoDecideGoals: "semi" } }))).toBe(
      true,
    );
  });
});
