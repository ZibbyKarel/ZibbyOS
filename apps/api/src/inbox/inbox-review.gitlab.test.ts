import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Integration, Project } from "@zibby/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGlab } from "../../test/gitlab-fake";
import { GitlabApiError } from "../git-host/gitlab-client";
import { ScheduledTasksStorageService } from "../tasks/scheduled-tasks.storage.service";
import { CodeOwnersService } from "./code-owners.service";
import { commentableLines, postGitlabReview } from "./inbox-review.gitlab";
import {
  InboxReviewService,
  ReviewRepoMismatchError,
  reviewTaskText,
} from "./inbox-review.service";

const link = { host: "gl.example.com", repo: "grp/app", username: "me" };
const HEAD = "d".repeat(40);
const BASE = "b".repeat(40);
const MR = {
  iid: 3,
  state: "opened",
  sha: HEAD,
  target_branch: "main",
  diff_refs: { base_sha: BASE, start_sha: BASE, head_sha: HEAD },
};
// new lines: 1 context (old 1), 2 added, 3 context (old 2), 4 context (old 4; old 3 was removed)
const DIFF = "@@ -1,3 +1,4 @@\n ctx\n+added\n ctx2\n-gone\n tail\n";
const FILES = [{ old_path: "a.ts", new_path: "a.ts", diff: DIFF }];

type Call = { method: string; path: string; body?: Record<string, unknown> };
function calls(exec: ReturnType<typeof fakeGlab>["exec"]): Call[] {
  return exec.mock.calls.map(([, args, opts]) => ({
    method:
      args[args.indexOf("-X") + 1] === undefined || !args.includes("-X")
        ? "GET"
        : (args[args.indexOf("-X") + 1] ?? "GET"),
    path: decodeURIComponent(args[1] ?? ""),
    ...(opts.input ? { body: JSON.parse(opts.input) as Record<string, unknown> } : {}),
  }));
}
const writes = (exec: ReturnType<typeof fakeGlab>["exec"]) =>
  calls(exec).filter((c) => c.method !== "GET");

function routes(over: [RegExp, unknown][] = []): [RegExp, unknown][] {
  return [
    ...over,
    [/merge_requests\/3(\?|$)/, MR],
    [/merge_requests\/3\/diffs/, FILES],
    [/merge_requests\/3\/discussions$/, { id: "x" }],
    [/merge_requests\/3\/notes$/, { id: 77 }],
    [/merge_requests\/3\/approve$/, {}],
    [/merge_requests\/3\/unapprove$/, {}],
    [/merge_requests\/3\/approvals$/, { approved_by: [{ user: { username: "me" } }] }],
  ];
}

describe("commentableLines", () => {
  it("maps added lines (no old line) and context lines (with their old line)", () => {
    expect([...commentableLines(DIFF)]).toEqual([
      [1, 1],
      [2, undefined],
      [3, 2],
      [4, 4],
    ]);
    expect(commentableLines(undefined).size).toBe(0);
  });
});

describe("postGitlabReview", () => {
  const input = {
    event: "COMMENT" as const,
    summary: "Overall fine.",
    comments: [] as { path: string; line: number; body: string }[],
    headSha: HEAD,
  };

  it("posts one discussion per inline finding with a text position, then the summary note", async () => {
    const { client, exec } = fakeGlab(routes());
    const result = await postGitlabReview(client, link, 3, {
      ...input,
      comments: [
        { path: "a.ts", line: 2, body: "added line" },
        { path: "a.ts", line: 3, body: "context line" },
      ],
    });
    expect(result).toEqual({ inline: 2 });
    expect(writes(exec)).toEqual([
      {
        method: "POST",
        path: "projects/grp/app/merge_requests/3/discussions",
        body: {
          body: "added line",
          position: {
            position_type: "text",
            base_sha: BASE,
            start_sha: BASE,
            head_sha: HEAD,
            new_path: "a.ts",
            old_path: "a.ts",
            new_line: 2,
          },
        },
      },
      {
        method: "POST",
        path: "projects/grp/app/merge_requests/3/discussions",
        body: {
          body: "context line",
          position: expect.objectContaining({ new_line: 3, old_line: 2 }),
        },
      },
      {
        method: "POST",
        path: "projects/grp/app/merge_requests/3/notes",
        body: { body: "Overall fine." },
      },
    ]);
  });

  it("a finding off the diff (or on an unknown file) falls back into the summary note", async () => {
    const { client, exec } = fakeGlab(routes());
    const result = await postGitlabReview(client, link, 3, {
      ...input,
      comments: [
        { path: "a.ts", line: 99, body: "off diff" },
        { path: "z.ts", line: 1, body: "unknown file" },
      ],
    });
    expect(result.inline).toBe(0);
    expect(result.note).toContain("2 not on a line of the diff");
    expect(writes(exec)).toEqual([
      {
        method: "POST",
        path: "projects/grp/app/merge_requests/3/notes",
        body: {
          body: expect.stringMatching(
            /Overall fine\.[\s\S]*a\.ts:99` off diff[\s\S]*z\.ts:1` unknown file/,
          ),
        },
      },
    ]);
  });

  it("a position GitLab rejects with 400 is folded; any other failure propagates with what was posted", async () => {
    const reject = fakeGlab(routes([[/discussions$/, { status: 400 }]]));
    const folded = await postGitlabReview(reject.client, link, 3, {
      ...input,
      comments: [{ path: "a.ts", line: 2, body: "x" }],
    });
    expect(folded.note).toContain("1 rejected by GitLab");

    const broken = fakeGlab(
      routes([
        [/discussions$/, { id: "x" }],
        [/notes$/, { status: 500 }],
      ]),
    );
    await expect(
      postGitlabReview(broken.client, link, 3, {
        ...input,
        comments: [{ path: "a.ts", line: 2, body: "x" }],
      }),
    ).rejects.toThrow(/glab: 500.*already posted: a\.ts:2/);
  });

  it("a head that moved since the review started folds everything into the note", async () => {
    const moved = {
      ...MR,
      sha: "e".repeat(40),
      diff_refs: { ...MR.diff_refs, head_sha: "e".repeat(40) },
    };
    const { client, exec } = fakeGlab(routes([[/merge_requests\/3(\?|$)/, moved]]));
    const result = await postGitlabReview(client, link, 3, {
      ...input,
      comments: [{ path: "a.ts", line: 2, body: "x" }],
    });
    expect(result).toMatchObject({ inline: 0, note: expect.stringContaining("head moved") });
    expect(writes(exec).map((c) => c.path)).toEqual(["projects/grp/app/merge_requests/3/notes"]);
  });

  it("APPROVE: approve pinned to the reviewed sha; no summary → bare approve", async () => {
    const { client, exec } = fakeGlab(routes());
    await postGitlabReview(client, link, 3, { ...input, event: "APPROVE" });
    expect(writes(exec).map((c) => [c.path.split("/").pop(), c.body])).toEqual([
      ["approve", { sha: HEAD }],
      ["notes", { body: "Overall fine." }],
    ]);
    const bare = fakeGlab(routes());
    await postGitlabReview(bare.client, link, 3, { ...input, event: "APPROVE", summary: "" });
    expect(writes(bare.exec).map((c) => c.path.split("/").pop())).toEqual(["approve"]);
  });

  it("APPROVE on a head that moved fails up front and posts nothing", async () => {
    const moved = {
      ...MR,
      sha: "e".repeat(40),
      diff_refs: { ...MR.diff_refs, head_sha: "e".repeat(40) },
    };
    const { client, exec } = fakeGlab(routes([[/merge_requests\/3(\?|$)/, moved]]));
    await expect(postGitlabReview(client, link, 3, { ...input, event: "APPROVE" })).rejects.toThrow(
      /head changed.*nothing was posted/,
    );
    expect(writes(exec)).toEqual([]);
  });

  it("a refused approve leaves no inline discussion or note behind", async () => {
    const { client, exec } = fakeGlab(routes([[/approve$/, { status: 403 }]]));
    await expect(
      postGitlabReview(client, link, 3, {
        ...input,
        event: "APPROVE",
        comments: [{ path: "a.ts", line: 2, body: "x" }],
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(writes(exec).map((c) => c.path.split("/").pop())).toEqual(["approve"]);
  });

  it("REQUEST_CHANGES with an unresolvable viewer propagates instead of skipping the unapprove", async () => {
    const { client, exec } = fakeGlab(routes([[/^user$/, { status: 500 }]]));
    await expect(
      postGitlabReview(client, { host: link.host, repo: link.repo }, 3, {
        ...input,
        event: "REQUEST_CHANGES",
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(writes(exec)).toEqual([]);
  });

  it("REQUEST_CHANGES: summary note only; unapproves when the operator had approved (404 ignored)", async () => {
    const approved = fakeGlab(routes());
    await postGitlabReview(approved.client, link, 3, { ...input, event: "REQUEST_CHANGES" });
    expect(writes(approved.exec).map((c) => c.path.split("/").pop())).toEqual([
      "unapprove",
      "notes",
    ]);

    const gone = fakeGlab(routes([[/unapprove$/, { status: 404 }]]));
    await postGitlabReview(gone.client, link, 3, { ...input, event: "REQUEST_CHANGES" });

    const notApproved = fakeGlab(routes([[/approvals$/, { approved_by: [] }]]));
    await postGitlabReview(notApproved.client, link, 3, { ...input, event: "REQUEST_CHANGES" });
    expect(writes(notApproved.exec).map((c) => c.path.split("/").pop())).toEqual(["notes"]);
  });

  it("an unapprove failure other than 404 propagates; COMMENT never approves", async () => {
    const { client } = fakeGlab(routes([[/unapprove$/, { status: 500 }]]));
    await expect(
      postGitlabReview(client, link, 3, { ...input, event: "REQUEST_CHANGES" }),
    ).rejects.toBeInstanceOf(Error);
    const comment = fakeGlab(routes());
    await postGitlabReview(comment.client, link, 3, input);
    expect(writes(comment.exec).map((c) => c.path.split("/").pop())).toEqual(["notes"]);
  });

  it("a failed read of the MR propagates instead of posting blind", async () => {
    const { client, exec } = fakeGlab(routes([[/merge_requests\/3(\?|$)/, { status: 500 }]]));
    await expect(postGitlabReview(client, link, 3, input)).rejects.toBeInstanceOf(GitlabApiError);
    expect(writes(exec)).toEqual([]);
  });
});

describe("reviewTaskText", () => {
  const gl = { kind: "gitlab", host: "gl.example.com", repo: "grp/app" } as const;

  it("a GitLab link gets glab commands, MR wording and every prohibition in glab terms", () => {
    const text = reviewTaskText(
      "grp/app",
      3,
      "https://gl.example.com/grp/app/-/merge_requests/3",
      "T",
      "quick",
      HEAD,
      undefined,
      gl,
    );
    expect(text).toContain(
      "Code review of GitLab merge request grp/app!3 (https://gl.example.com/grp/app/-/merge_requests/3)",
    );
    expect(text).toContain(
      "`glab mr view 3 -R gl.example.com/grp/app` and `glab mr diff 3 -R gl.example.com/grp/app`",
    );
    expect(text).toContain(
      `\`glab mr checkout 3 -R gl.example.com/grp/app\` then \`git checkout --detach ${HEAD}\``,
    );
    expect(text).toContain("comments on GitLab. Write ONLY");
    expect(text).toContain("new side of `glab mr diff`");
    expect(text).toContain(
      "Do NOT post anything to GitLab yourself — no `glab mr note`, `glab mr approve`, `glab mr merge`, and no mutating `glab api` call — and do not commit or push.",
    );
    expect(text).not.toMatch(/\bgh\b|GitHub/);
  });

  it("without a pinned sha the head is read with glab", () => {
    const text = reviewTaskText("grp/app", 3, "u", "T", "quick", undefined, undefined, gl);
    expect(text).toContain("`glab mr view 3 -R gl.example.com/grp/app --output json --jq .sha`");
  });
});

describe("InboxReviewService on a GitLab project", () => {
  const PROJECT: Project = { id: "app", name: "App", path: "~/app" };
  const GITLAB = {
    id: "gl",
    config: { kind: "gitlab", host: link.host, repo: link.repo, username: "me" },
  } as unknown as Integration;
  let dir: string;
  let storage: ScheduledTasksStorageService;
  let createTask: ReturnType<typeof vi.fn>;
  let dropPrsCache: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(tmpdir(), "zibby-inbox-review-gl-"));
    storage = new ScheduledTasksStorageService(path.join(dir, "tasks"));
    await storage.onModuleInit();
    createTask = vi.fn(async (input: { text: string }, _now: number, projectId: string) => ({
      outcome: "dispatched",
      runRef: "run_1",
      target: { kind: "workflow", id: "pr-review-quick", name: "pr-review-quick" },
      task: await storage.createDispatched(
        "task_g1",
        input,
        "run_1",
        { kind: "workflow", id: "pr-review-quick", name: "pr-review-quick" },
        Date.now(),
        projectId,
      ),
    }));
    dropPrsCache = vi.fn();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  const make = (client: ReturnType<typeof fakeGlab>["client"]) =>
    new InboxReviewService(
      { get: async () => PROJECT } as never,
      { resolveIntegrations: async () => [GITLAB] } as never,
      {
        read: async () => {
          throw new Error("no credential read for gitlab");
        },
      } as never,
      { createTask } as never,
      storage,
      { register: vi.fn() } as never,
      { dropPrsCache } as never,
      undefined,
      undefined,
      client,
    );

  it("start pins the MR head, scopes by CODEOWNERS through glab and stamps the MR url", async () => {
    const scope = vi
      .spyOn(CodeOwnersService.prototype, "reviewScopeGitlab")
      .mockResolvedValue({ kind: "all", reason: "test" });
    const { client } = fakeGlab(routes());
    await expect(
      make(client).start({ projectId: "app", repo: "Grp/App", number: 3, title: "Fix" }),
    ).resolves.toEqual({ taskId: "task_g1" });
    expect(scope).toHaveBeenCalledWith(
      expect.objectContaining({ host: link.host, repo: "grp/app" }),
      "main",
      [{ filename: "a.ts", additions: 1, deletions: 1 }],
    );
    const [task] = createTask.mock.calls[0] ?? [];
    expect(task.title).toBe("Code review: grp/app#3 Fix");
    expect(task.text).toContain("Code review of GitLab merge request grp/app!3");
    expect(task.text).toContain(`Review exactly commit \`${HEAD}\``);
    expect((await storage.get("task_g1")).prReview).toEqual({
      repo: "grp/app",
      number: 3,
      url: "https://gl.example.com/grp/app/-/merge_requests/3",
      state: "running",
      headSha: HEAD,
    });
  });

  it("start refuses a foreign repo and does not swallow a failed MR read", async () => {
    const { client } = fakeGlab(routes([[/merge_requests\/3(\?|$)/, { status: 500 }]]));
    const service = make(client);
    await expect(service.start({ projectId: "app", repo: "other/app", number: 3 })).rejects.toThrow(
      ReviewRepoMismatchError,
    );
    await expect(
      service.start({ projectId: "app", repo: "grp/app", number: 3 }),
    ).rejects.toBeInstanceOf(GitlabApiError);
    expect(createTask).not.toHaveBeenCalled();
  });

  async function parked(service: InboxReviewService, body: string) {
    await service.start({ projectId: "app", repo: "grp/app", number: 3 });
    await storage.setPrReview("task_g1", (c) =>
      c ? { ...c, state: "awaiting-approval", body, approvalId: "a1" } : c,
    );
  }

  it("post sends inline findings, the summary and the operator's verdict through glab", async () => {
    vi.spyOn(CodeOwnersService.prototype, "reviewScopeGitlab").mockResolvedValue({
      kind: "all",
      reason: "test",
    });
    const { client, exec } = fakeGlab(routes());
    const service = make(client);
    await parked(
      service,
      "Looks fine.\n\n### a.ts:2 (Minor)\nNit.\n\n### a.ts:50 (Minor)\nOff diff.",
    );
    exec.mockClear();
    await service.post("task_g1", "APPROVE");
    expect(writes(exec).map((c) => c.path.split("/").pop())).toEqual([
      "approve",
      "discussions",
      "notes",
    ]);
    expect((await storage.get("task_g1")).prReview).toMatchObject({
      state: "posted",
      note: expect.stringContaining("1 inline comment(s) folded"),
    });
    expect(dropPrsCache).toHaveBeenCalledOnce();
  });

  it("a GitLab failure marks the review failed and throws", async () => {
    vi.spyOn(CodeOwnersService.prototype, "reviewScopeGitlab").mockResolvedValue({
      kind: "all",
      reason: "test",
    });
    const { client, exec } = fakeGlab(routes());
    const service = make(client);
    await parked(service, "Summary only");
    exec.mockImplementation(async () => {
      throw Object.assign(new Error("x"), { stderr: "glab: 500 boom (HTTP 500)" });
    });
    await expect(service.post("task_g1", "COMMENT")).rejects.toThrow(/gitlab review post/);
    expect((await storage.get("task_g1")).prReview).toMatchObject({ state: "failed" });
    expect(dropPrsCache).not.toHaveBeenCalled();
  });
});
