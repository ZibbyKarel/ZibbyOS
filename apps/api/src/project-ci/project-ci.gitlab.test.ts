import { describe, expect, it } from "vitest";
import { GitlabClient, type GitlabExecImpl } from "../git-host/gitlab-client";
import { gitlabCiStateOf, readGitlabCi } from "./project-ci.gitlab";
import { fixBaseCiText } from "./project-ci.service";

const LINK = { host: "gl.example.com", repo: "grp/sub/app" };
const BASE = { projectId: "acme", checkedAt: "2026-07-02T10:00:00.000Z" };

function clientWith(routes: Record<string, unknown>) {
  const exec: GitlabExecImpl = async (_f, args) => {
    const body = routes[args[1] ?? ""];
    if (body === undefined) throw Object.assign(new Error("x"), { stderr: "glab: 404 (HTTP 404)" });
    return { stdout: JSON.stringify(body), stderr: "" };
  };
  return new GitlabClient(exec);
}
const P = "projects/grp%2Fsub%2Fapp";

describe("gitlabCiStateOf", () => {
  it.each([
    ["success", "passing"],
    ["failed", "failing"],
    ["running", "running"],
    ["pending", "pending"],
    ["created", "pending"],
    ["waiting_for_resource", "pending"],
    ["canceled", "cancelled"],
    ["skipped", "skipped"],
    ["manual", "skipped"],
    [undefined, "none"],
  ])("%s -> %s", (status, state) => {
    expect(gitlabCiStateOf(status)).toBe(state);
  });
});

describe("readGitlabCi", () => {
  const routes = {
    [P]: { default_branch: "main" },
    [`${P}/pipelines?ref=main&order_by=id&sort=desc&per_page=20`]: [
      { id: 12, sha: "new", status: "failed", web_url: "https://gl.example.com/p/12" },
      { id: 11, sha: "new", status: "running", web_url: "https://gl.example.com/p/11" },
      { id: 10, sha: "old", status: "success" },
    ],
    [`${P}/pipelines/12/jobs?per_page=100`]: [
      { id: 1, name: "test", status: "failed", web_url: "https://gl.example.com/j/1" },
      { id: 2, name: "lint", status: "success" },
    ],
    [`${P}/pipelines/11/jobs?per_page=100`]: [{ id: 3, name: "e2e", status: "running" }],
  };

  it("maps the newest commit's pipelines into the project-CI contract", async () => {
    const ci = await readGitlabCi(clientWith(routes), LINK, BASE);
    expect(ci).toMatchObject({
      projectId: "acme",
      provider: "gitlab",
      repoUrl: "https://gl.example.com/grp/sub/app",
      branch: "main",
      headSha: "new",
      state: "failing",
    });
    expect(ci.workflows.map((w) => [w.id, w.name, w.state, w.url])).toEqual([
      [12, "Pipeline #12", "failing", "https://gl.example.com/p/12"],
      [11, "Pipeline #11", "running", "https://gl.example.com/p/11"],
    ]);
    expect(ci.workflows[0]?.jobs).toEqual([
      { id: 1, name: "test", url: "https://gl.example.com/j/1", state: "failing", steps: [] },
      { id: 2, name: "lint", state: "passing", steps: [] },
    ]);
  });

  it("no pipelines is state none; an unreadable project is state error (provider gitlab)", async () => {
    const empty = await readGitlabCi(
      clientWith({ [P]: { default_branch: "main" }, [Object.keys(routes)[1] ?? ""]: [] }),
      LINK,
      BASE,
    );
    expect(empty).toMatchObject({ provider: "gitlab", state: "none", workflows: [] });
    const broken = await readGitlabCi(clientWith({}), LINK, BASE);
    expect(broken).toMatchObject({ provider: "gitlab", state: "error", workflows: [] });
    expect(broken.error).toContain("404");
  });

  it("the fix brief uses glab wording for a GitLab link", async () => {
    const text = fixBaseCiText(await readGitlabCi(clientWith(routes), LINK, BASE));
    expect(text).toContain("grp/sub/app at new");
    expect(text).toContain("glab ci view main");
    expect(text).toContain("glab ci trace <job>");
    expect(text).toContain("pipeline 12");
    expect(text).not.toContain("gh run view");
  });
});
