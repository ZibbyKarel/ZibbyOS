import type { Integration, Project } from "@zibby/contracts";
import { describe, expect, it, vi } from "vitest";
import { fakeGlab } from "../../test/gitlab-fake";
import {
  gitlabReviewers,
  gitlabThreads,
  requestGitlabReview,
  resolveGitlabUserId,
} from "./inbox-pr-threads.gitlab";
import { InboxPrThreadsService } from "./inbox-pr-threads.service";

const link = { host: "gl.example.com", repo: "grp/app" };
const D1 = "a".repeat(40);
const D2 = "b".repeat(40);
const D3 = "c".repeat(40);

const note = (over: Record<string, unknown> = {}) => ({
  id: 11,
  system: false,
  body: "fix this",
  created_at: "2026-11-18T10:00:00.000Z",
  author: { username: "rev", avatar_url: "https://gl.example.com/a.png" },
  resolvable: true,
  resolved: false,
  ...over,
});

describe("gitlabThreads", () => {
  it("marks discussions started by the glab user as mine", async () => {
    const { client } = fakeGlab([
      [/^user$/, { username: "Me" }],
      [
        /merge_requests\/3\/discussions/,
        [
          { id: D1, notes: [note({ author: { username: "me" } })] },
          { id: D2, notes: [note({ id: 21 })] },
        ],
      ],
    ]);
    expect((await gitlabThreads(client, link, 3)).map((t) => t.mine)).toEqual([true, undefined]);
  });

  it("maps resolvable discussions: id, resolved flag, position, comments, url", async () => {
    const { client } = fakeGlab([
      [
        /merge_requests\/3\/discussions/,
        [
          {
            id: D1,
            notes: [
              note({
                position: {
                  new_path: "src/a.ts",
                  old_path: "src/a.ts",
                  new_line: 12,
                  old_line: null,
                  line_range: { start: { new_line: 10, old_line: null } },
                },
              }),
              note({ id: 12, body: "done", author: { username: "me" }, resolved: true }),
              note({ id: 13, system: true, body: "changed the description", resolvable: false }),
            ],
          },
          {
            id: D2,
            notes: [
              note({
                id: 21,
                resolved: true,
                position: { new_path: "b.ts", old_path: "old-b.ts", new_line: null, old_line: 7 },
              }),
            ],
          },
          { id: D3, notes: [note({ id: 31, resolvable: false })] }, // plain comment, not a thread
          { notes: [note()] }, // no id: unusable
        ],
      ],
    ]);
    expect(await gitlabThreads(client, link, 3)).toEqual([
      {
        id: D1,
        isResolved: false,
        isOutdated: false,
        path: "src/a.ts",
        line: 12,
        startLine: 10,
        diffHunk: "",
        url: "https://gl.example.com/grp/app/-/merge_requests/3#note_11",
        comments: [
          {
            id: "11",
            author: { login: "rev", avatarUrl: "https://gl.example.com/a.png" },
            createdAt: "2026-11-18T10:00:00.000Z",
            body: "fix this",
          },
          {
            id: "12",
            author: { login: "me", avatarUrl: "" },
            createdAt: "2026-11-18T10:00:00.000Z",
            body: "done",
          },
        ],
      },
      {
        id: D2,
        isResolved: true,
        isOutdated: false,
        path: "b.ts",
        line: 7,
        startLine: null,
        diffHunk: "",
        url: "https://gl.example.com/grp/app/-/merge_requests/3#note_21",
        comments: [expect.objectContaining({ id: "21" })],
      },
    ]);
  });

  it("skips notes without an id instead of emitting an empty comment id", async () => {
    const { client } = fakeGlab([
      [/discussions/, [{ id: D1, notes: [note(), note({ id: undefined, body: "ghost" })] }]],
    ]);
    const [thread] = await gitlabThreads(client, link, 3);
    expect(thread?.comments.map((c) => c.id)).toEqual(["11"]);
  });

  it("a thread is resolved only when every resolvable note is", async () => {
    const { client } = fakeGlab([
      [
        /discussions/,
        [{ id: D1, notes: [note({ resolved: true }), note({ id: 12, resolved: false })] }],
      ],
    ]);
    expect((await gitlabThreads(client, link, 3))[0]?.isResolved).toBe(false);
  });

  it("a failed read rejects instead of reading as 'no threads'", async () => {
    const { client } = fakeGlab([[/discussions/, { status: 500 }]]);
    await expect(gitlabThreads(client, link, 3)).rejects.toMatchObject({ status: 500 });
  });
});

const mr = { iid: 3, author: { username: "author" }, target_branch: "main" };
const CODEOWNERS = "* @nobody\nsrc/ @alice @grp/core\n";

const routes = (
  over: { approvals?: unknown; reviewers?: unknown[]; extra?: Parameters<typeof fakeGlab>[0] } = {},
) =>
  fakeGlab([
    ...(over.extra ?? []),
    [
      /merge_requests\/3\/reviewers/,
      over.reviewers ?? [
        { user: { id: 1, username: "alice" }, state: "unreviewed" },
        { user: { id: 2, username: "bob" }, state: "requested_changes" },
        { user: { id: 3, username: "carol" }, state: "approved" },
        { user: { id: 9, username: "author" }, state: "unreviewed" },
      ],
    ],
    [
      /merge_requests\/3\/approvals/,
      over.approvals ?? { approved_by: [{ user: { username: "dave" } }] },
    ],
    [
      /merge_requests\/3\/discussions/,
      [{ id: D1, notes: [note({ author: { username: "bob" } })] }],
    ],
    [/merge_requests\/3\/diffs/, [{ old_path: "src/x.ts", new_path: "src/x.ts", diff: "" }]],
    [/files\/CODEOWNERS\/raw\?ref=main/, { raw: CODEOWNERS }],
    [/groups\/grp\/core\/members\/all/, [{ username: "carol" }, { username: "zed" }]],
    [
      /projects\/grp\/app\/members\/all/,
      [
        { username: "zed", access_level: 30, state: "active" },
        { username: "alice", access_level: 40, state: "active" },
        { username: "author", access_level: 40, state: "active" },
        { username: "guest", access_level: 10, state: "active" },
        { username: "gone", access_level: 50, state: "deactivated" },
        { username: "bob", access_level: 30, state: "active" },
      ],
    ],
    [/merge_requests\/3(\?|$)/, mr],
  ]);

describe("gitlabReviewers", () => {
  it("reviewers with verdicts, approvers added, author left out, CODEOWNERS groups as teams", async () => {
    expect(await gitlabReviewers(routes().client, link, 3)).toEqual({
      teams: [
        {
          slug: "grp/core",
          name: "grp/core",
          codeOwner: true,
          requested: false,
          members: [{ login: "carol", state: "approved", commented: false }],
        },
      ],
      users: [
        { login: "alice", state: "pending", commented: false },
        { login: "bob", state: "changesRequested", commented: true },
        { login: "dave", state: "approved", commented: false },
      ],
    });
  });

  it("an approval overrides a pending reviewer state", async () => {
    const { client } = routes({
      reviewers: [{ user: { id: 1, username: "alice" }, state: "review_started" }],
      approvals: { approved_by: [{ user: { username: "Alice" } }] },
    });
    expect((await gitlabReviewers(client, link, 3)).users).toEqual([
      { login: "alice", state: "approved", commented: false },
    ]);
  });

  it("a reviewer GitLab marks reviewed (comments, no verdict) reads as commented", async () => {
    const { client } = routes({
      reviewers: [{ user: { id: 1, username: "alice" }, state: "reviewed" }],
      approvals: {},
    });
    expect((await gitlabReviewers(client, link, 3)).users).toEqual([
      { login: "alice", state: "commented", commented: false },
    ]);
  });

  it("approvals 404 (not on this tier) degrade; a 500 rejects", async () => {
    const ok = routes({ extra: [[/approvals/, { status: 404 }]] });
    expect((await gitlabReviewers(ok.client, link, 3)).users.map((u) => u.login)).toEqual([
      "alice",
      "bob",
    ]);
    const bad = routes({ extra: [[/approvals/, { status: 500 }]] });
    await expect(gitlabReviewers(bad.client, link, 3)).rejects.toMatchObject({ status: 500 });
  });

  it("a failed reviewers read rejects", async () => {
    const { client } = routes({ extra: [[/merge_requests\/3\/reviewers/, { status: 502 }]] });
    await expect(gitlabReviewers(client, link, 3)).rejects.toMatchObject({ status: 502 });
  });
});

describe("resolveGitlabUserId", () => {
  it("takes the exact username match (dots and case), 422 when unknown", async () => {
    const { client, paths } = fakeGlab([
      [
        /^users\?username=karel\.zibar$/,
        [
          { id: 5, username: "karel.zibar2" },
          { id: 4309, username: "Karel.Zibar" },
        ],
      ],
      [/^users\?username=ghost/, []],
    ]);
    expect(await resolveGitlabUserId(client, "gl.example.com", "karel.zibar")).toBe(4309);
    expect(paths()).toEqual(["users?username=karel.zibar"]);
    await expect(resolveGitlabUserId(client, "gl.example.com", "ghost")).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe("requestGitlabReview", () => {
  const put = vi.fn();
  const setup = (reviewers: unknown[]) =>
    fakeGlab([
      [/^users\?username=zed/, [{ id: 7, username: "zed" }]],
      [/merge_requests\/3\/reviewers/, reviewers],
      [
        /merge_requests\/3$/,
        (args: string[], input?: string) => {
          put(args, input);
          return {};
        },
      ],
    ]);

  it("PUTs reviewer_ids with the existing reviewers preserved", async () => {
    put.mockClear();
    const { client } = setup([
      { user: { id: 1, username: "alice" } },
      { user: { id: 2, username: "bob" } },
    ]);
    await requestGitlabReview(client, link, 3, "zed");
    const [args, input] = put.mock.calls[0] as [string[], string];
    expect(args).toEqual(expect.arrayContaining(["-X", "PUT"]));
    expect(JSON.parse(input)).toEqual({ reviewer_ids: [1, 2, 7] });
  });

  it("does not claim a re-request for a reviewer already on the MR (no PUT)", async () => {
    put.mockClear();
    const { client } = setup([{ user: { id: 7, username: "zed" } }]);
    await expect(requestGitlabReview(client, link, 3, "zed")).resolves.toBe(false);
    expect(put).not.toHaveBeenCalled();
  });

  it("refuses to write when an existing reviewer has no id (it would be dropped)", async () => {
    put.mockClear();
    const { client } = setup([{ user: { username: "alice" } }]);
    await expect(requestGitlabReview(client, link, 3, "zed")).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("no id"),
    });
    expect(put).not.toHaveBeenCalled();
  });
});

describe("InboxPrThreadsService on a GitLab project", () => {
  const gitlab = {
    id: "gl",
    config: { kind: "gitlab", host: link.host },
  } as unknown as Integration;
  const make = (client: ReturnType<typeof fakeGlab>["client"]) => {
    const dropPrsCache = vi.fn();
    const record = vi.fn(async () => undefined);
    const service = new InboxPrThreadsService(
      {
        get: async () =>
          ({
            id: "app",
            name: "App",
            path: "~/app",
            gitRemote: `git@${link.host}:${link.repo}.git`,
          }) as Project,
      } as never,
      { resolveIntegrations: async () => [gitlab] } as never,
      {
        read: async () => {
          throw new Error("no credential read for gitlab");
        },
      } as never,
      { dropPrsCache } as never,
      undefined,
      { record } as never,
      undefined,
      client,
    );
    return { service, dropPrsCache, record };
  };

  it("list reads discussions through glab", async () => {
    const { client } = fakeGlab([
      [/discussions/, [{ id: D1, notes: [note({ position: { new_path: "a.ts", new_line: 1 } })] }]],
    ]);
    const threads = await make(client).service.list("app", 3);
    expect(threads.map((t) => t.id)).toEqual([D1]);
  });

  it("requestReview sets reviewer_ids, drops the cache, records activity, returns the tree", async () => {
    const { client } = routes({
      extra: [
        [/^users\?username=zed/, [{ id: 7, username: "zed" }]],
        [/merge_requests\/3$/, {}],
      ],
    });
    const { service, dropPrsCache, record } = make(client);
    const tree = await service.requestReview("app", 3, "zed");
    expect(tree.users.length).toBeGreaterThan(0);
    expect(dropPrsCache).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ summary: "requested review from zed on grp/app!3" }),
    );
  });

  it("requestReview: a live request survives a failed re-read as a pending fallback", async () => {
    const { client } = fakeGlab([
      [/^users\?username=zed/, [{ id: 7, username: "zed" }]],
      [/merge_requests\/3\/reviewers/, []],
      [/merge_requests\/3$/, {}],
      [/merge_requests\/3\?/, { status: 500 }],
    ]);
    expect(await make(client).service.requestReview("app", 3, "zed")).toEqual({
      teams: [],
      users: [{ login: "zed", state: "pending", commented: false }],
    });
  });

  it("reviewers rejects when a read fails", async () => {
    const { client } = fakeGlab([[/merge_requests\/3/, { status: 500 }]]);
    await expect(make(client).service.reviewers("app", 3)).rejects.toMatchObject({ status: 500 });
  });

  it("requestReview of someone already reviewing is a 422, with no PUT and no activity", async () => {
    const { client, exec } = routes({
      extra: [[/^users\?username=alice/, [{ id: 1, username: "alice" }]]],
    });
    const { service, record } = make(client);
    await expect(service.requestReview("app", 3, "alice")).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("already a reviewer, not re-requested"),
    });
    expect(exec.mock.calls.some(([, args]) => args.includes("-X"))).toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  describe("reply, resolve and submit review", () => {
    const discussions = [
      [
        /merge_requests\/3\/discussions\?/,
        [{ id: D1, notes: [note({ position: { new_path: "a.ts", new_line: 1 } })] }],
      ],
    ] as [RegExp, unknown][];
    const writes = (exec: ReturnType<typeof fakeGlab>["exec"]) =>
      exec.mock.calls
        .filter(([, args]) => args.includes("-X"))
        .map(([, args, opts]) => ({
          method: args[args.indexOf("-X") + 1],
          path: decodeURIComponent(args[1] ?? ""),
          ...(opts.input ? { body: JSON.parse(opts.input) as unknown } : {}),
        }));
    const replyRoutes = (): [RegExp, unknown][] => [
      ...discussions,
      [/discussions\/[0-9a-f]{40}\/notes$/, { id: 9 }],
      [/discussions\/[0-9a-f]{40}\?resolved=true$/, {}],
    ];

    it("reply resolves first, then posts the note, drops the cache and records activity", async () => {
      const { client, exec } = fakeGlab(replyRoutes());
      const { service, dropPrsCache, record } = make(client);
      const thread = await service.reply("app", 3, D1, { body: "Done.", resolve: true });
      expect(thread.id).toBe(D1);
      expect(writes(exec)).toEqual([
        {
          method: "PUT",
          path: `projects/grp/app/merge_requests/3/discussions/${D1}?resolved=true`,
        },
        {
          method: "POST",
          path: `projects/grp/app/merge_requests/3/discussions/${D1}/notes`,
          body: { body: "Done." },
        },
      ]);
      expect(dropPrsCache).toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: "replied on grp/app!3",
          refs: { projectId: "app", itemId: D1 },
        }),
      );
    });

    it("reply refuses a discussion that is not a thread of this MR, without writing", async () => {
      const { client, exec } = fakeGlab(replyRoutes());
      await expect(make(client).service.reply("app", 3, D2, { body: "x" })).rejects.toThrow(
        /is not on grp\/app#3/,
      );
      expect(writes(exec)).toEqual([]);
    });

    it("a failed resolve or reply propagates (the reply is not posted after a failed resolve)", async () => {
      const resolveFails = fakeGlab([[/\?resolved=true$/, { status: 500 }], ...replyRoutes()]);
      await expect(
        make(resolveFails.client).service.reply("app", 3, D1, { body: "x", resolve: true }),
      ).rejects.toMatchObject({ status: 500 });
      expect(writes(resolveFails.exec).map((w) => w.method)).toEqual(["PUT"]);

      const replyFails = fakeGlab([[/\/notes$/, { status: 403 }], ...replyRoutes()]);
      await expect(
        make(replyFails.client).service.reply("app", 3, D1, { body: "x" }),
      ).rejects.toMatchObject({ status: 403 });
    });

    const reviewRoutes = (): [RegExp, unknown][] => [
      [/merge_requests\/3\/notes$/, { id: 77 }],
      [/merge_requests\/3\/approve$/, {}],
      [/merge_requests\/3\/unapprove$/, {}],
      [/merge_requests\/3\/approvals$/, { approved_by: [{ user: { username: "me" } }] }],
      [/^user$/, { username: "me" }],
    ];

    it("submitReview: verdict then note; the id is the note id", async () => {
      const { client, exec } = fakeGlab(reviewRoutes());
      const { service, dropPrsCache } = make(client);
      await expect(
        service.submitReview("app", 3, { event: "REQUEST_CHANGES", body: "Needs work." }),
      ).resolves.toEqual({ id: 77 });
      expect(writes(exec).map((w) => [w.method, w.path.split("/").pop()])).toEqual([
        ["POST", "unapprove"],
        ["POST", "notes"],
      ]);
      expect(dropPrsCache).toHaveBeenCalled();
    });

    it("submitReview: a bare approve posts no note and returns the MR number", async () => {
      const { client, exec } = fakeGlab(reviewRoutes());
      await expect(
        make(client).service.submitReview("app", 3, { event: "APPROVE" }),
      ).resolves.toEqual({
        id: 3,
      });
      expect(writes(exec).map((w) => w.path.split("/").pop())).toEqual(["approve"]);
    });

    it("submitReview: a refused verdict leaves no note behind", async () => {
      const { client, exec } = fakeGlab([[/approve$/, { status: 403 }], ...reviewRoutes()]);
      await expect(
        make(client).service.submitReview("app", 3, { event: "APPROVE", body: "LGTM" }),
      ).rejects.toMatchObject({ status: 403 });
      expect(writes(exec).map((w) => w.path.split("/").pop())).toEqual(["approve"]);
    });

    it("submitReview: GitLab's refusal propagates", async () => {
      const { client } = fakeGlab([[/approve$/, { status: 401 }], ...reviewRoutes()]);
      await expect(
        make(client).service.submitReview("app", 3, { event: "APPROVE" }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it("submitReview: an empty REQUEST_CHANGES is refused (422) before any write", async () => {
      const { client, exec } = fakeGlab(reviewRoutes());
      await expect(
        make(client).service.submitReview("app", 3, { event: "REQUEST_CHANGES", body: "  " }),
      ).rejects.toMatchObject({ status: 422 });
      expect(writes(exec)).toEqual([]);
    });

    it("submitReview: unapprove 404 is nothing to undo; a 403 surfaces and posts no note", async () => {
      const gone = fakeGlab([[/unapprove$/, { status: 404 }], ...reviewRoutes()]);
      await expect(
        make(gone.client).service.submitReview("app", 3, { event: "REQUEST_CHANGES", body: "x" }),
      ).resolves.toEqual({ id: 77 });
      const denied = fakeGlab([[/unapprove$/, { status: 403 }], ...reviewRoutes()]);
      await expect(
        make(denied.client).service.submitReview("app", 3, {
          event: "REQUEST_CHANGES",
          body: "x",
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(writes(denied.exec).map((w) => w.path.split("/").pop())).toEqual(["unapprove"]);
    });
  });
});
