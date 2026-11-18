import { describe, expect, it, vi } from "vitest";
import { GitlabClient, type GitlabExecImpl } from "../git-host/gitlab-client";
import { listOpenGitlabMrs } from "./project-pr.gitlab";

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
