import type { Integration, Project } from "@zibby/contracts";
import { Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { GitlabClient, type GitlabExecImpl } from "../git-host/gitlab-client";
import { InboxIssuesService } from "./inbox-issues.service";
import {
  type GitlabDiscussion,
  type GitlabJob,
  type GitlabMr,
  countUnresolvedDiscussions,
  jobAsCheckRun,
  listGitlabInboxPrs,
} from "./inbox.gitlab";
import { InboxService } from "./inbox.service";

const link = { host: "gl.example.com", repo: "grp/sub/app" };
const project = { id: "app", name: "App", ciIgnoredChecks: ["lint"] } as unknown as Project;
const SHA = "a".repeat(40);
const ago = (iso: string) => new Date(iso).toISOString();

interface MrFixture {
  mr?: Partial<GitlabMr>;
  jobs?: GitlabJob[];
  approvals?: unknown;
  /** The approvals call fails with this HTTP status. */
  approvalsStatus?: number;
  reviewers?: unknown[];
  discussions?: GitlabDiscussion[];
  /** The discussions call fails with this HTTP status. */
  discussionsStatus?: number;
}

/** A fake glab: lists by query, one fixture per iid, everything else 404s. */
function fakeGlab(
  lists: { authored?: number[]; assigned?: number[]; requested?: number[] },
  fx: Record<number, MrFixture>,
  extra: Record<string, unknown> = {},
) {
  const exec = vi.fn<GitlabExecImpl>(async (_file, args) => {
    const path = decodeURIComponent(args[1] ?? "");
    const out = (v: unknown) => ({ stdout: JSON.stringify(v), stderr: "" });
    if (path === "user") return out({ username: "karel.zibar" });
    for (const [needle, value] of Object.entries(extra))
      if (path.includes(needle)) return out(value);
    const iids = (ns: number[] = []) => out(ns.map((iid) => ({ iid })));
    if (path.includes("scope=created_by_me")) return iids(lists.authored);
    if (path.includes("scope=assigned_to_me")) return iids(lists.assigned);
    if (path.includes("reviewer_username=")) return iids(lists.requested);
    const m = /merge_requests\/(\d+)(\/approvals|\/reviewers|\/discussions)?/.exec(path);
    const f = m?.[1] ? fx[Number(m[1])] : undefined;
    if (m && f) {
      if (m[2] === "/approvals" && f.approvalsStatus) {
        throw Object.assign(new Error("x"), {
          stderr: `glab: ${f.approvalsStatus} Error (HTTP ${f.approvalsStatus})`,
        });
      }
      if (m[2] === "/discussions" && f.discussionsStatus) {
        throw Object.assign(new Error("x"), {
          stderr: `glab: ${f.discussionsStatus} Error (HTTP ${f.discussionsStatus})`,
        });
      }
      if (m[2] === "/approvals") return out(f.approvals ?? { approved: false, approved_by: [] });
      if (m[2] === "/reviewers") return out(f.reviewers ?? []);
      if (m[2] === "/discussions") return out(f.discussions ?? []);
      return out({
        iid: Number(m[1]),
        title: `MR ${m[1]}`,
        web_url: `https://gl.example.com/grp/sub/app/-/merge_requests/${m[1]}`,
        author: {
          username: "karel.zibar",
          name: "Karel Zíbar",
          avatar_url: "https://gl.example.com/a.png",
        },
        created_at: "2026-11-18T10:00:00.000Z",
        updated_at: "2026-11-18T11:00:00.000Z",
        source_branch: "feat/x",
        target_branch: "main",
        source_project_id: 1,
        target_project_id: 1,
        sha: SHA,
        draft: false,
        detailed_merge_status: "mergeable",
        has_conflicts: false,
        diverged_commits_count: 0,
        head_pipeline: f.jobs ? { id: 99 } : null,
        ...f.mr,
      });
    }
    if (/pipelines\/99\/jobs/.test(path)) {
      const jobs = Object.values(fx).find((x) => x.jobs)?.jobs;
      return out(jobs ?? []);
    }
    throw Object.assign(new Error("boom"), { stderr: "glab: 404 Not Found (HTTP 404)" });
  });
  return { exec, client: new GitlabClient(exec) };
}

const run = async (
  fx: Record<number, MrFixture>,
  lists = { authored: [1] } as Parameters<typeof fakeGlab>[0],
) => {
  const { client } = fakeGlab(lists, fx);
  const prs = await listGitlabInboxPrs(client, link, project);
  return Object.fromEntries(prs.map((p) => [p.number, p]));
};

describe("listGitlabInboxPrs mapping", () => {
  it("a green MR: maps the fields and settles passing", async () => {
    const prs = await run({
      1: {
        jobs: [{ name: "verify", status: "success", finished_at: "2026-11-18T10:30:00.000Z" }],
        mr: { description: "body" },
      },
    });
    expect(prs[1]).toMatchObject({
      source: "gitlab",
      number: 1,
      repo: "grp/sub/app",
      url: "https://gl.example.com/grp/sub/app/-/merge_requests/1",
      author: "karel.zibar",
      authorName: "Karel Zíbar",
      body: "body",
      draft: false,
      createdAt: ago("2026-11-18T10:00:00Z"),
      headRef: "feat/x",
      baseRef: "main",
      headSha: SHA,
      ci: "passing",
      ciSettled: true,
      ciFailingChecks: [],
      ciCompletedAt: ago("2026-11-18T10:30:00Z"),
      review: "none",
      mergeable: true,
      bucket: "mine",
      blocker: "awaiting-review",
      section: "waiting",
      projectId: "app",
      unresolvedThreads: 0,
    });
    expect(prs[1]?.behind).toBeUndefined();
  });

  it("a red MR: failed job names feed ciFailingChecks, an ignored one does not", async () => {
    const prs = await run({
      1: {
        jobs: [
          { name: "images", status: "failed" },
          { name: "lint", status: "failed" },
          { name: "flaky", status: "failed", allow_failure: true },
          { name: "e2e", status: "running" },
        ],
      },
    });
    expect(prs[1]).toMatchObject({
      ci: "failing",
      ciFailingChecks: ["images"],
      ciSettled: false,
      blocker: "ci-failing",
    });
  });

  it("only-ignored failures leave CI unknown; no pipeline is unknown too", async () => {
    const prs = await run(
      { 1: { jobs: [{ name: "lint", status: "failed" }] }, 2: {} },
      { authored: [1, 2] },
    );
    expect(prs[1]?.ci).toBe("unknown");
    expect(prs[2]).toMatchObject({ ci: "unknown", ciSettled: false });
  });

  it("an approved MR with passing CI is ready to merge", async () => {
    const prs = await run({
      1: {
        jobs: [{ name: "verify", status: "success" }],
        approvals: { approved: true, approved_by: [{ user: { username: "bob" } }] },
      },
    });
    expect(prs[1]).toMatchObject({
      review: "approved",
      blocker: "ready-to-merge",
      section: "ready-to-merge",
    });
  });

  it("a reviewer's requested_changes wins over approval; unresolved threads are counted", async () => {
    const prs = await run({
      1: {
        approvals: { approved: true },
        reviewers: [{ user: { username: "bob" }, state: "requested_changes" }],
        discussions: [
          { notes: [{ resolvable: true, resolved: false }] },
          { notes: [{ resolvable: true, resolved: true }] },
          { notes: [{ resolvable: false }] },
        ],
      },
    });
    expect(prs[1]).toMatchObject({
      review: "changes-requested",
      blocker: "changes-requested",
      unresolvedThreads: 1,
    });
  });

  it("conflict reads mergeable=false, need_rebase unknown (null); behind from diverged_commits_count", async () => {
    const prs = await run(
      {
        1: { mr: { detailed_merge_status: "conflict" } },
        2: { mr: { detailed_merge_status: "need_rebase", diverged_commits_count: 3 } },
        3: { mr: { detailed_merge_status: "not_approved", diverged_commits_count: 2 } },
      },
      { authored: [1, 2, 3] },
    );
    expect(prs[1]).toMatchObject({ mergeable: false, blocker: "merge-conflict" });
    expect(prs[2]).toMatchObject({ mergeable: null, behind: true });
    expect(prs[3]).toMatchObject({ mergeable: null, behind: true });
  });

  it("buckets: requested -> to-review (direct); my verdict moves it to reviewed; assigned -> mine", async () => {
    const prs = await run(
      {
        1: { mr: { author: { username: "bob" } } },
        2: {
          mr: { author: { username: "bob" } },
          reviewers: [{ user: { username: "karel.zibar" }, state: "approved" }],
        },
        3: {
          mr: { author: { username: "bob" } },
          reviewers: [{ user: { username: "karel.zibar" }, state: "requested_changes" }],
        },
        4: { mr: { author: { username: "bob" } } },
      },
      { requested: [1, 2, 3], assigned: [4] },
    );
    expect(prs[1]).toMatchObject({
      bucket: "to-review",
      reviewReason: "direct",
      section: "needs-your-review",
    });
    expect(prs[1]?.unresolvedThreads).toBeUndefined();
    expect(prs[2]).toMatchObject({
      bucket: "reviewed",
      myReview: "approved",
      section: "reviewed-by-you",
    });
    expect(prs[3]).toMatchObject({ bucket: "reviewed", myReview: "changes-requested" });
    expect(prs[4]).toMatchObject({ bucket: "mine" });
  });

  it("my reviewer state reviewed (comments only) reads as myReview commented", async () => {
    const prs = await run(
      {
        1: {
          mr: { author: { username: "bob" } },
          reviewers: [{ user: { username: "karel.zibar" }, state: "reviewed" }],
        },
      },
      { requested: [1] },
    );
    expect(prs[1]).toMatchObject({ bucket: "reviewed", myReview: "commented" });
  });

  it("the displayed title drops draft markers; the draft flag carries the state", async () => {
    const prs = await run({ 1: { mr: { title: "Draft: [Draft] Fix it", draft: true } } });
    expect(prs[1]).toMatchObject({ title: "Fix it", draft: true });
  });

  it("discussions 403/404 degrade to no thread count; a 500 rejects the MR", async () => {
    const ok = await run({ 1: { discussionsStatus: 403 } });
    expect(ok[1]?.unresolvedThreads).toBeUndefined();
    await expect(run({ 1: { discussionsStatus: 500 } })).rejects.toThrow(/500/);
  });

  it("a partial per-MR failure keeps the loaded MRs and reports a note", async () => {
    const { client } = fakeGlab({ authored: [1, 2] }, { 1: {} });
    const notes: string[] = [];
    const prs = await listGitlabInboxPrs(client, link, project, undefined, notes);
    expect(prs.map((p) => p.number)).toEqual([1]);
    expect(notes).toEqual([expect.stringContaining("grp/sub/app: 1 merge request(s) failed")]);
  });

  it("every MR failing rejects, so the caller records a source error", async () => {
    const { client } = fakeGlab({ authored: [1, 2] }, {});
    await expect(listGitlabInboxPrs(client, link, project)).rejects.toThrow(/404/);
  });

  it("an approvals failure is not read as neutral: it rejects the MR load", async () => {
    const { client } = fakeGlab({ authored: [1, 2] }, { 1: { approvalsStatus: 500 }, 2: {} });
    const notes: string[] = [];
    const prs = await listGitlabInboxPrs(client, link, project, undefined, notes);
    expect(prs.map((p) => p.number)).toEqual([2]);
    expect(notes[0]).toContain("500");
  });

  it("a 404 on approvals (endpoint not available) degrades to review none", async () => {
    const prs = await run({ 1: { approvalsStatus: 404 } });
    expect(prs[1]).toMatchObject({ review: "none" });
  });

  it("loads at most 4 MRs at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const inner = fakeGlab(
      { authored: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, {}])),
    ).exec;
    const client = new GitlabClient(async (file, args, opts) => {
      const isMr = /merge_requests\/\d+\?/.test(decodeURIComponent(args[1] ?? ""));
      if (isMr) peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      if (isMr) inFlight--;
      return inner(file, args, opts);
    });
    const prs = await listGitlabInboxPrs(client, link, project);
    expect(prs).toHaveLength(9);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("job status table", () => {
    const c = (status: string, allow_failure?: boolean) => jobAsCheckRun({ status, allow_failure });
    expect(c("success")).toMatchObject({ status: "completed", conclusion: "success" });
    expect(c("canceled")).toMatchObject({ conclusion: "cancelled" });
    expect(c("manual")).toMatchObject({ status: "completed", conclusion: "skipped" });
    expect(c("pending")).toMatchObject({ status: "in_progress", conclusion: null });
    expect(countUnresolvedDiscussions([])).toBe(0);
  });
});

const gitlabIntegration = {
  id: "gl1",
  companyId: "c",
  config: { kind: "gitlab", host: "gl.example.com", repo: "grp/sub/app" },
} as unknown as Integration;

describe("InboxService with a GitLab project", () => {
  const build = (client: GitlabClient) =>
    new InboxService(
      { list: async () => [project] } as never,
      { resolveIntegrations: async () => [gitlabIntegration] } as never,
      { read: async () => null } as never, // no stored credential: a gitlab link must not need one
      { dropCache: () => undefined } as never,
      {} as never,
      { list: async () => [] } as never,
      { onPrChanged: () => undefined } as never,
      { stream: () => new Subject().asObservable() } as never,
      { list: async () => [] } as never,
      undefined,
      client,
    );

  it("lists MRs without any credential", async () => {
    const { client } = fakeGlab(
      { authored: [1] },
      { 1: { jobs: [{ name: "v", status: "success" }] } },
    );
    const { prs, errors } = await build(client).listPrs();
    expect(errors).toEqual([]);
    expect(prs.map((p) => `${p.source}:${p.number}`)).toEqual(["gitlab:1"]);
  });

  it("MR loads failing after a good list surface a gitlab source error", async () => {
    const { client } = fakeGlab({ authored: [1, 2] }, { 1: {} });
    const { prs, errors } = await build(client).listPrs();
    expect(prs.map((p) => p.number)).toEqual([1]);
    expect(errors).toEqual([
      { projectId: "app", source: "gitlab", message: expect.stringContaining("failed to load") },
    ]);
    const all = fakeGlab({ authored: [1] }, {});
    expect((await build(all.client).listPrs()).errors[0]).toMatchObject({ source: "gitlab" });
  });

  it("a failing project becomes a gitlab source error", async () => {
    const client = new GitlabClient(async () => {
      throw Object.assign(new Error("x"), { stderr: "glab: 401 Unauthorized (HTTP 401)" });
    });
    const { prs, errors } = await build(client).listPrs();
    expect(prs).toEqual([]);
    expect(errors).toEqual([
      { projectId: "app", source: "gitlab", message: expect.stringContaining("grp/sub/app: ") },
    ]);
  });
});

describe("InboxIssuesService with a GitLab project", () => {
  const build = (client: GitlabClient) =>
    new InboxIssuesService(
      { list: async () => [project] } as never,
      { resolveIntegrations: async () => [gitlabIntegration] } as never,
      { read: async () => null } as never,
      { list: async () => [] } as never,
      { read: async () => ({ hidden: [] }) } as never,
      {} as never,
      undefined,
      client,
    );
  const noPrs = async () => ({ prs: [], errors: [] });

  it("maps assigned issues into roadmap items", async () => {
    const { client, exec } = fakeGlab(
      {},
      {},
      {
        "/issues?": [
          {
            iid: 5,
            title: "Fix it",
            description: "why",
            web_url: "https://gl.example.com/grp/sub/app/-/issues/5",
            updated_at: "2026-11-18T09:00:00.000Z",
          },
          { title: "no iid" },
        ],
      },
    );
    const res = await build(client).list(true, noPrs);
    expect(exec.mock.calls[0]?.[1][1]).toContain("scope=assigned_to_me");
    expect(res.syncProjectIds).toEqual(["app"]);
    expect(res.errors).toEqual([]);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      name: "Fix it",
      description: "why",
      lifecycle: "todo",
      scopeReasons: ["assigned"],
      updatedAt: ago("2026-11-18T09:00:00Z"),
      source: {
        kind: "gitlab",
        integrationId: "gl1",
        externalId: "issue:5",
        externalKey: "#5",
        url: "https://gl.example.com/grp/sub/app/-/issues/5",
      },
    });
  });

  it("a failing project becomes a gitlab source error", async () => {
    const client = new GitlabClient(async () => {
      throw Object.assign(new Error("x"), { stderr: "glab: 500 Server Error (HTTP 500)" });
    });
    const res = await build(client).list(true, noPrs);
    expect(res.items).toEqual([]);
    expect(res.errors[0]).toMatchObject({ projectId: "app", source: "gitlab" });
  });
});
