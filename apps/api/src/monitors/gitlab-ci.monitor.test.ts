import type { Integration } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import { GitlabClient, type GitlabExecImpl } from "../git-host/gitlab-client";
import { GitlabCiMonitor } from "./gitlab-ci.monitor";

const INTEGRATION: Integration = {
  id: "acme-gitlab",
  kind: "gitlab",
  projectId: "acme",
  enabled: true,
  status: "connected",
  hasCredentials: true,
  config: {
    kind: "gitlab",
    host: "gl.example.com",
    repo: "grp/sub/app",
    streams: ["issues", "pulls", "ci"],
    username: "karel.zibar",
  },
};
const CREDS = { token: "-" };

const pipeline = (over: Record<string, unknown>) => ({
  id: 7,
  sha: "abc",
  ref: "main",
  status: "failed",
  created_at: "2026-07-02T08:00:00Z",
  updated_at: "2026-07-02T08:12:00Z",
  web_url: "https://gl.example.com/grp/sub/app/-/pipelines/7",
  ...over,
});

/** Routes by the API path's suffix; records every call. */
function monitorWith(pipelines: unknown[], mrs: unknown[] = []) {
  const calls: string[] = [];
  const exec: GitlabExecImpl = async (_file, args) => {
    const path = args[1] ?? "";
    calls.push(path);
    const body = path.includes("/pipelines")
      ? pipelines
      : path.includes("/merge_requests")
        ? mrs
        : { default_branch: "main" };
    return { stdout: JSON.stringify(body), stderr: "" };
  };
  return { monitor: new GitlabCiMonitor(new GitlabClient(exec)), calls };
}

describe("GitlabCiMonitor", () => {
  it("wants only gitlab integrations that opted into the ci stream", () => {
    const { monitor } = monitorWith([]);
    expect(monitor.wants(INTEGRATION)).toBe(true);
    expect(
      monitor.wants({
        ...INTEGRATION,
        config: { ...INTEGRATION.config, streams: ["issues", "pulls"] } as never,
      }),
    ).toBe(false);
    expect(
      monitor.wants({
        ...INTEGRATION,
        config: { kind: "github", repo: "a/b", streams: ["ci"], username: "x" },
      }),
    ).toBe(false);
  });

  it("emits only failed pipelines on the default branch, with a deterministic id", async () => {
    const { monitor, calls } = monitorWith([
      pipeline({}),
      pipeline({ id: 8, status: "success" }),
      pipeline({ id: 9, status: "running" }),
      pipeline({ id: 10, ref: "someone-elses-branch" }),
    ]);
    const { events, cursor } = await monitor.poll(INTEGRATION, CREDS, undefined);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "ci-grp-sub-app-7-20260702081200",
      kind: "ci-run-failed",
      url: "https://gl.example.com/grp/sub/app/-/pipelines/7",
      occurredAt: "2026-07-02T08:12:00.000Z",
    });
    expect(events[0]?.detail).toContain("main @ abc");
    expect(cursor).toBe("2026-07-02T08:12:00Z");
    expect(calls[0]).toBe("projects/grp%2Fsub%2Fapp");
  });

  it("includes failed pipelines of the operator's open MRs (merge-request ref or source branch)", async () => {
    const { monitor } = monitorWith(
      [
        pipeline({ id: 1, ref: "refs/merge-requests/5/head" }),
        pipeline({ id: 2, ref: "feat/x" }),
        pipeline({ id: 3, ref: "refs/merge-requests/6/head" }),
        pipeline({ id: 4, ref: "refs/merge-requests/5/merge" }),
        pipeline({ id: 5, ref: "refs/merge-requests/6/merge" }),
      ],
      [{ iid: 5, source_branch: "feat/x" }],
    );
    const { events } = await monitor.poll(INTEGRATION, CREDS, undefined);
    expect(events.map((e) => e.id.split("-")[4])).toEqual(["1", "2", "4"]);
  });

  it("a retried pipeline that fails again alerts again (id carries updated_at)", async () => {
    const { monitor: m1 } = monitorWith([pipeline({ updated_at: "2026-07-02T08:12:00Z" })]);
    const first = await m1.poll(INTEGRATION, CREDS, undefined);
    const { monitor: m2 } = monitorWith([pipeline({ updated_at: "2026-07-02T09:30:00Z" })]);
    const second = await m2.poll(INTEGRATION, CREDS, first.cursor);
    expect(second.events).toHaveLength(1);
    expect(second.events[0]?.id).not.toBe(first.events[0]?.id);
  });

  it("is replay-safe: the same page again, with the advanced cursor, yields nothing new", async () => {
    const page = [pipeline({})];
    const { monitor } = monitorWith(page);
    const first = await monitor.poll(INTEGRATION, CREDS, undefined);
    const second = await monitor.poll(INTEGRATION, CREDS, first.cursor);
    expect(second.events).toEqual([]);
    expect(second.cursor).toBe(first.cursor);
  });

  it("derives the status snapshot from the default-branch pipelines", async () => {
    const { monitor } = monitorWith([
      pipeline({ id: 3, status: "failed", updated_at: "2026-07-02T09:00:00Z" }),
      pipeline({ id: 2, status: "failed", updated_at: "2026-07-02T08:00:00Z" }),
      pipeline({ id: 1, status: "success", updated_at: "2026-07-02T07:00:00Z" }),
    ]);
    const { status } = await monitor.poll(INTEGRATION, CREDS, undefined);
    expect(status).toMatchObject({ state: "red", sinceAt: "2026-07-02T08:00:00.000Z" });
  });

  it("without a repo (company integration not yet scoped) it throws", async () => {
    const { monitor } = monitorWith([]);
    await expect(
      monitor.poll(
        { ...INTEGRATION, config: { ...INTEGRATION.config, repo: undefined } as never },
        CREDS,
        undefined,
      ),
    ).rejects.toThrow("no repo");
  });
});
