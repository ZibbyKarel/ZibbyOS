import { describe, expect, it, vi } from "vitest";
import { GitlabClient, type GitlabExecImpl } from "../git-host/gitlab-client";
import { fakeGlab } from "../../test/gitlab-fake";
import {
  closeGitlabMr,
  getGitlabMr,
  listOpenGitlabMrs,
  mergeGitlabMr,
  setGitlabMrDraft,
} from "./project-pr.gitlab";
import { PrNotMergeableError, PrUpdateRefusedError } from "./projects.errors";

describe("listOpenGitlabMrs", () => {
  it("maps open merge requests to ProjectPr (number = iid)", async () => {
    const exec = vi.fn<GitlabExecImpl>(async () => ({
      stdout: JSON.stringify([
        {
          iid: 3,
          title: "Move CI",
          web_url: "https://gl.example.com/grp/app/-/merge_requests/3",
          author: { username: "karel.zibar" },
          source_branch: "chore/ci",
          draft: true,
          created_at: "2026-11-18T10:25:28.456Z",
        },
        { title: "no iid, skipped" },
        { iid: 4 },
      ]),
      stderr: "",
    }));
    const prs = await listOpenGitlabMrs(new GitlabClient(exec), {
      host: "gl.example.com",
      repo: "grp/app",
    });
    expect(exec.mock.calls[0]?.[1]).toEqual([
      "api",
      "projects/grp%2Fapp/merge_requests?state=opened&per_page=50",
      "--hostname",
      "gl.example.com",
    ]);
    expect(prs).toEqual([
      {
        number: 3,
        title: "Move CI",
        url: "https://gl.example.com/grp/app/-/merge_requests/3",
        author: "karel.zibar",
        branch: "chore/ci",
        draft: true,
        createdAt: "2026-11-18T10:25:28.456Z",
      },
      { number: 4, title: "", url: "", draft: false },
    ]);
  });

  it("an empty response is no PRs", async () => {
    const exec: GitlabExecImpl = async () => ({ stdout: "", stderr: "" });
    expect(await listOpenGitlabMrs(new GitlabClient(exec), { host: "h", repo: "a/b" })).toEqual([]);
  });
});

const link = { host: "gl.example.com", repo: "grp/app" };
const MR = /projects\/grp\/app\/merge_requests\/3$/;

describe("gitlab MR actions", () => {
  it("getGitlabMr maps state and 404 to null", async () => {
    const merged = fakeGlab([[MR, { iid: 3, state: "merged" }]]);
    expect(await getGitlabMr(merged.client, link, 3)).toEqual({
      number: 3,
      merged: true,
      state: "closed",
    });
    const open = fakeGlab([[MR, { iid: 3, state: "opened" }]]);
    expect(await getGitlabMr(open.client, link, 3)).toEqual({
      number: 3,
      merged: false,
      state: "open",
    });
    expect(await getGitlabMr(fakeGlab([]).client, link, 3)).toBeNull();
  });

  it("merge: squash + branch delete params, sha, and refusal statuses", async () => {
    const ok = fakeGlab([
      [
        /merge_requests\/3\/merge/,
        {
          state: "merged",
          merge_commit_sha: "abc",
          should_remove_source_branch: true,
          web_url: "https://x/-/merge_requests/3",
        },
      ],
    ]);
    expect(await mergeGitlabMr(ok.client, link, "p", 3, "squash", true)).toEqual({
      merged: true,
      url: "https://x/-/merge_requests/3",
      sha: "abc",
      branchDeleted: true,
    });
    expect(ok.paths()[0]).toBe(
      "projects/grp/app/merge_requests/3/merge?squash=true&should_remove_source_branch=true",
    );
    expect(ok.exec.mock.calls[0]?.[1]).toContain("PUT");
    // An explicit merge / keep-branch choice is sent, so it wins over the MR / project defaults.
    await mergeGitlabMr(ok.client, link, "p", 3, "merge", false);
    expect(ok.paths()[1]).toBe(
      "projects/grp/app/merge_requests/3/merge?squash=false&should_remove_source_branch=false",
    );
    await mergeGitlabMr(ok.client, link, "p", 3, undefined, false);
    expect(ok.paths()[2]).toBe(
      "projects/grp/app/merge_requests/3/merge?should_remove_source_branch=false",
    );
    for (const status of [405, 406, 409, 422]) {
      const bad = fakeGlab([[/merge(\?|$)/, { status }]]);
      await expect(
        mergeGitlabMr(bad.client, link, "p", 3, undefined, false),
      ).rejects.toBeInstanceOf(PrNotMergeableError);
    }
    const boom = fakeGlab([[/merge(\?|$)/, { status: 500 }]]);
    await expect(
      mergeGitlabMr(boom.client, link, "p", 3, undefined, false),
    ).rejects.not.toBeInstanceOf(PrNotMergeableError);
  });

  it("merge: rebase is refused before any glab call; unconfirmed branch removal is not claimed", async () => {
    const f = fakeGlab([[/merge/, { state: "merged", web_url: "u" }]]);
    await expect(mergeGitlabMr(f.client, link, "p", 3, "rebase", false)).rejects.toThrow(
      /rebase merge is not available on GitLab/,
    );
    expect(f.exec).not.toHaveBeenCalled();
    const r = await mergeGitlabMr(f.client, link, "p", 3, undefined, true);
    expect(r).toMatchObject({ merged: true, branchDeleted: false });
  });

  it("getGitlabMr surfaces a rate limit; close only reports a change when the MR ended up closed", async () => {
    await expect(getGitlabMr(fakeGlab([[MR, { status: 429 }]]).client, link, 3)).rejects.toThrow(
      /gitlab rate limited \(HTTP 429\)/,
    );
    const stuck = fakeGlab([
      [
        MR,
        (args: string[]) =>
          args.includes("PUT")
            ? { state: "opened", web_url: "u" }
            : { state: "opened", web_url: "u" },
      ],
    ]);
    const r = await closeGitlabMr(stuck.client, link, "p", 3);
    expect(r.changed).toBe(false);
    expect(r.result.state).toBe("open");
  });

  it("close: PUTs state_event=close; already closed is a no-op", async () => {
    const f = fakeGlab([
      [
        MR,
        (args: string[]) =>
          args.includes("PUT")
            ? { state: "closed", web_url: "u" }
            : { state: "opened", web_url: "u" },
      ],
    ]);
    const r = await closeGitlabMr(f.client, link, "p", 3);
    expect(r).toEqual({ result: { url: "u", state: "closed", draft: false }, changed: true });
    const put = f.exec.mock.calls.find(([, a]) => a.includes("PUT"));
    expect(put?.[2].input).toBe(JSON.stringify({ state_event: "close" }));
    const done = fakeGlab([[MR, { state: "merged", web_url: "u" }]]);
    expect((await closeGitlabMr(done.client, link, "p", 3)).changed).toBe(false);
    await expect(closeGitlabMr(fakeGlab([]).client, link, "p", 3)).rejects.toBeInstanceOf(
      PrUpdateRefusedError,
    );
  });

  it("draft toggle rewrites the title prefix and no-ops when already there", async () => {
    const f = fakeGlab([
      [
        MR,
        (args: string[]) =>
          args.includes("PUT")
            ? { draft: false }
            : { state: "opened", title: "Draft: [Draft] Fix it", draft: true, web_url: "u" },
      ],
    ]);
    const ready = await setGitlabMrDraft(f.client, link, "p", 3, false);
    expect(ready).toMatchObject({ changed: true, result: { draft: false } });
    expect(f.exec.mock.calls.find(([, a]) => a.includes("PUT"))?.[2].input).toBe(
      JSON.stringify({ title: "Fix it" }),
    );
    const again = await setGitlabMrDraft(f.client, link, "p", 3, true);
    expect(again.changed).toBe(false);
    const plain = fakeGlab([
      [
        MR,
        (args: string[]) =>
          args.includes("PUT")
            ? { draft: true }
            : { state: "opened", title: "Fix it", draft: false, web_url: "u" },
      ],
    ]);
    expect(await setGitlabMrDraft(plain.client, link, "p", 3, true)).toMatchObject({
      changed: true,
      result: { draft: true },
    });
    expect(plain.exec.mock.calls.find(([, a]) => a.includes("PUT"))?.[2].input).toBe(
      JSON.stringify({ title: "Draft: Fix it" }),
    );
    // GitLab answering with the old state is not reported as a change.
    const ignored = fakeGlab([
      [
        MR,
        (args: string[]) =>
          args.includes("PUT")
            ? { draft: false }
            : { state: "opened", title: "Fix it", draft: false, web_url: "u" },
      ],
    ]);
    expect(await setGitlabMrDraft(ignored.client, link, "p", 3, true)).toMatchObject({
      changed: false,
      result: { draft: false },
    });
    const closed = fakeGlab([[MR, { state: "closed", title: "x", web_url: "u" }]]);
    await expect(setGitlabMrDraft(closed.client, link, "p", 3, true)).rejects.toBeInstanceOf(
      PrUpdateRefusedError,
    );
  });
});
