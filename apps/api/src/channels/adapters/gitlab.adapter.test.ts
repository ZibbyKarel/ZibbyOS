import type { ChannelItem, Integration } from "@zibby/contracts";
import { describe, expect, it, vi } from "vitest";
import { GitlabClient, type GitlabExecImpl } from "../../git-host/gitlab-client";
import { GitlabChannelAdapter } from "./gitlab.adapter";

const HOST = "gitlab.example.com";
const PROJECT = "projects/acme%2Fplatform%2Fapp";

const gl: Integration = {
  id: "acme-gl",
  kind: "gitlab",
  projectId: "acme-app",
  enabled: true,
  config: {
    kind: "gitlab",
    host: HOST,
    repo: "acme/platform/app",
    streams: ["issues", "pulls"],
    username: "karel.zibar",
  },
  status: "disconnected",
  hasCredentials: true,
};
const NO_CREDS = { token: "-" };
const CURSOR = "2026-06-17T08:00:00.000Z";

type Routes = Record<string, unknown | (() => never)>;

/** Fake exec: the route key is a substring of the requested path (`path?query`). */
function adapterFor(routes: Routes) {
  const calls: string[] = [];
  const exec: GitlabExecImpl = async (_file, args) => {
    const path = args[1] ?? "";
    calls.push(path);
    const hit = Object.entries(routes).find(([key]) => path.includes(key));
    if (!hit) return { stdout: "[]", stderr: "" };
    const value = hit[1];
    if (typeof value === "function") return value() as never;
    return { stdout: JSON.stringify(value), stderr: "" };
  };
  return { calls, adapter: new GitlabChannelAdapter(new GitlabClient(vi.fn(exec))) };
}

const issue = (iid: number, updated_at: string, extra = {}) => ({
  iid,
  title: `issue ${iid}`,
  description: "body",
  updated_at,
  web_url: `https://${HOST}/acme/platform/app/-/issues/${iid}`,
  author: { username: "dana" },
  ...extra,
});
const mr = (iid: number, updated_at: string) => ({
  iid,
  title: `mr ${iid}`,
  description: null,
  updated_at,
  web_url: `https://${HOST}/acme/platform/app/-/merge_requests/${iid}`,
  author: { username: "eli" },
});
const todo = (type: string, target: unknown, project = "acme/platform/app") => ({
  target_type: type,
  target,
  project: { path_with_namespace: project },
});
const fails = (stderr: string) => () => {
  throw Object.assign(new Error("Command failed"), { stderr });
};

describe("GitlabChannelAdapter.poll", () => {
  it("paginates every list call (bounded by updated_after)", async () => {
    const argvs: string[][] = [];
    const exec: GitlabExecImpl = async (_file, args) => {
      argvs.push(args);
      return { stdout: "[]", stderr: "" };
    };
    await new GitlabChannelAdapter(new GitlabClient(exec)).poll(gl, NO_CREDS, CURSOR);
    expect(argvs.length).toBeGreaterThan(0);
    for (const args of argvs) expect(args, args[1]).toContain("--paginate");
  });

  it("first poll seeds the cursor to now and calls glab never", async () => {
    const { adapter, calls } = adapterFor({});
    const res = await adapter.poll(gl, NO_CREDS, undefined);
    expect(res.items).toEqual([]);
    expect(Date.parse(res.cursor ?? "")).not.toBeNaN();
    expect(calls).toEqual([]);
  });

  it("issues stream: assigned + authored (deduped by iid), nested repo, dotted username", async () => {
    const { adapter, calls } = adapterFor({
      [`${PROJECT}/issues?`]: [issue(4, "2026-06-17T09:00:00.000Z")],
    });
    const { items, cursor } = await adapter.poll(
      { ...gl, config: { ...gl.config, streams: ["issues"] } as Integration["config"] },
      NO_CREDS,
      CURSOR,
    );
    expect(items).toHaveLength(1); // same iid from both queries
    expect(items[0]).toMatchObject({
      id: "gl-acme-platform-app-issue-4",
      externalRef: { channel: "acme/platform/app", messageId: "4" },
      from: "dana",
      url: `https://${HOST}/acme/platform/app/-/issues/4`,
      text: "#4 issue 4\n\nbody",
    });
    expect(cursor).toBe("2026-06-17T09:00:00.000Z");
    expect(calls.filter((c) => c.includes("/issues?"))).toHaveLength(2);
    expect(calls[0]).toContain("assignee_username=karel.zibar");
    expect(calls[0]).toContain("updated_after=2026-06-17T08%3A00%3A00.000Z");
    expect(calls[1]).toContain("author_username=karel.zibar");
  });

  it("pulls stream: author, assignee and reviewer queries; MR ids differ from issue ids", async () => {
    const { adapter, calls } = adapterFor({
      [`${PROJECT}/merge_requests?`]: [mr(4, "2026-06-17T10:00:00.000Z")],
      [`${PROJECT}/issues?`]: [issue(4, "2026-06-17T09:00:00.000Z")],
    });
    const { items, cursor } = await adapter.poll(gl, NO_CREDS, CURSOR);
    expect(items.map((i) => i.id)).toEqual([
      "gl-acme-platform-app-issue-4",
      "gl-acme-platform-app-mr-4",
    ]);
    expect(items[1]!.url).toBe(`https://${HOST}/acme/platform/app/-/merge_requests/4`);
    expect(cursor).toBe("2026-06-17T10:00:00.000Z");
    const mrCalls = calls.filter((c) => c.includes("/merge_requests?"));
    expect(mrCalls.map((c) => /(author|assignee|reviewer)_username/.exec(c)?.[1])).toEqual([
      "author",
      "assignee",
      "reviewer",
    ]);
  });

  it("a disabled stream is not queried and its mentions are dropped", async () => {
    const { adapter, calls } = adapterFor({
      todos: [todo("MergeRequest", mr(7, "2026-06-17T09:30:00.000Z"))],
    });
    const { items } = await adapter.poll(
      { ...gl, config: { ...gl.config, streams: ["issues"] } as Integration["config"] },
      NO_CREDS,
      CURSOR,
    );
    expect(items).toEqual([]);
    expect(calls.some((c) => c.includes("/merge_requests?"))).toBe(false);
  });

  it("mentions: pending mention todos for this project become items, other projects are ignored", async () => {
    const { adapter, calls } = adapterFor({
      "action=mentioned": [
        todo("Issue", issue(9, "2026-06-17T09:15:00.000Z")),
        todo("Issue", issue(10, "2026-06-17T09:16:00.000Z"), "other/repo"),
        todo("MergeRequest", mr(2, "2026-06-17T07:00:00.000Z")), // before the cursor
      ],
      "action=directly_addressed": [todo("MergeRequest", mr(3, "2026-06-17T09:20:00.000Z"))],
    });
    const { items } = await adapter.poll(gl, NO_CREDS, CURSOR);
    expect(items.map((i) => i.id)).toEqual([
      "gl-acme-platform-app-issue-9",
      "gl-acme-platform-app-mr-3",
    ]);
    expect(calls.filter((c) => c.startsWith("todos?"))).toHaveLength(2);
    expect(calls.find((c) => c.startsWith("todos?"))).toContain("state=pending");
  });

  it("a mention that is also assigned ingests exactly once", async () => {
    const { adapter } = adapterFor({
      [`${PROJECT}/issues?`]: [issue(9, "2026-06-17T09:15:00.000Z")],
      "action=mentioned": [todo("Issue", issue(9, "2026-06-17T09:15:00.000Z"))],
    });
    const { items } = await adapter.poll(gl, NO_CREDS, CURSOR);
    expect(items.map((i) => i.id)).toEqual(["gl-acme-platform-app-issue-9"]);
  });

  it("a failing todos read degrades to a note; assigned items still ingest", async () => {
    const { adapter } = adapterFor({
      [`${PROJECT}/issues?`]: [issue(1, "2026-06-17T09:00:00.000Z")],
      todos: fails("glab: 403 Forbidden (HTTP 403)"),
    });
    const res = await adapter.poll(gl, NO_CREDS, CURSOR);
    expect(res.items).toHaveLength(1);
    expect(res.notes?.[0]).toMatch(/mentions unavailable for acme-gl.*403/);
  });

  it("a 429 on todos is transient and throws (watcher retry)", async () => {
    const { adapter } = adapterFor({ todos: fails("glab: 429 Too Many Requests (HTTP 429)") });
    await expect(adapter.poll(gl, NO_CREDS, CURSOR)).rejects.toThrow(/429/);
  });

  it("a failing issue/MR read throws to the watcher (cursor must not advance)", async () => {
    const { adapter } = adapterFor({
      [`${PROJECT}/issues?`]: fails("glab: 404 Project Not Found (HTTP 404)"),
    });
    await expect(adapter.poll(gl, NO_CREDS, CURSOR)).rejects.toThrow(/404/);
  });

  it("refuses a repo-less integration and a non-gitlab one", async () => {
    const { adapter } = adapterFor({});
    const repoless = { ...gl, config: { ...gl.config, repo: undefined } } as Integration;
    await expect(adapter.poll(repoless, NO_CREDS, CURSOR)).rejects.toThrow("no repo");
    const slack = {
      ...gl,
      kind: "calendar",
      config: { kind: "calendar", calendarId: "p", lookaheadDays: 1 },
    } as Integration;
    await expect(adapter.poll(slack, NO_CREDS, CURSOR)).rejects.toThrow("not a gitlab");
  });
});

describe("GitlabChannelAdapter.test", () => {
  it("ok when /user returns the configured username (case-insensitive)", async () => {
    const { adapter, calls } = adapterFor({ user: { username: "Karel.Zibar" } });
    const res = await adapter.test(gl);
    expect(res).toEqual({ ok: true, detail: `authenticated as Karel.Zibar on ${HOST}` });
    expect(calls).toEqual(["user"]);
  });

  it("fails with a clear message on a username mismatch", async () => {
    const { adapter } = adapterFor({ user: { username: "someone.else" } });
    const res = await adapter.test(gl);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain("logged in as someone.else, not karel.zibar");
  });

  it("fails when /user has no username", async () => {
    const { adapter } = adapterFor({ user: {} });
    expect((await adapter.test(gl)).ok).toBe(false);
  });

  it("glab not logged in -> names the host and the login command", async () => {
    const { adapter } = adapterFor({ user: fails("glab: 401 Unauthorized (HTTP 401)") });
    const res = await adapter.test(gl);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain(HOST);
    expect(res.detail).toContain(`glab auth login --hostname ${HOST}`);
  });

  it("the 401 login hint appears once; a 404 also gets it", async () => {
    const hint = `glab auth login --hostname ${HOST}`;
    const unauthorized = await adapterFor({
      user: fails("glab: 401 Unauthorized (HTTP 401)"),
    }).adapter.test(gl);
    expect(unauthorized.detail.split(hint)).toHaveLength(2);
    const notFound = await adapterFor({ user: fails("glab: HTTP 404\n") }).adapter.test(gl);
    expect(notFound.detail).toContain(hint);
  });

  it("glab missing -> failed test with the same login hint", async () => {
    const exec: GitlabExecImpl = async () => {
      throw Object.assign(new Error("spawn glab ENOENT"), { code: "ENOENT" });
    };
    const res = await new GitlabChannelAdapter(new GitlabClient(exec)).test(gl);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain("glab is not installed or not on PATH");
    expect(res.detail).toContain(`glab auth login --hostname ${HOST}`);
  });
});

describe("GitlabChannelAdapter.send", () => {
  const item = (id: string): ChannelItem =>
    ({
      id,
      integrationId: "acme-gl",
      kind: "gitlab",
      externalRef: { channel: "acme/platform/app", messageId: "4" },
      receivedAt: CURSOR,
      text: "t",
      state: "new",
    }) as ChannelItem;

  async function sendTo(id: string) {
    const exec = vi.fn<GitlabExecImpl>(async () => ({ stdout: "{}", stderr: "" }));
    await new GitlabChannelAdapter(new GitlabClient(exec)).send(gl, NO_CREDS, item(id), "hello");
    return exec.mock.calls[0]!;
  }

  it("posts a note on the issue", async () => {
    const [, args, opts] = await sendTo("gl-acme-platform-app-issue-4");
    expect(args[1]).toBe(`${PROJECT}/issues/4/notes`);
    expect(args).toContain("POST");
    expect(JSON.parse(opts.input ?? "")).toEqual({ body: "hello" });
  });

  it("posts a note on the merge request", async () => {
    const [, args] = await sendTo("gl-acme-platform-app-mr-4");
    expect(args[1]).toBe(`${PROJECT}/merge_requests/4/notes`);
  });
});
